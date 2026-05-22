import { withClient } from "./db";
import type {
  Job,
  CreateJobInput,
  UpdateJobInput,
  JobStore,
  TranslationCacheEntry,
  Company,
  CreateCompanyInput,
  CompanyStore,
  Report,
  CreateReportInput,
  ReportWithPreview,
  ReportStore,
  ExtractedData,
} from "./contracts";
import type { FileStore } from "./file-store";
import { createAutoFileStore } from "./file-store";
import { BALTIC_COMPANIES } from "./seed-companies";
import { buildReportPreview } from "./preview-metrics";

// Must be defined here (not in index.ts) to avoid circular import
// since index.ts re-exports from pg-store
export class DuplicateReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateReportError";
  }
}

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    state: row.state as Job["state"],
    originalFilename: row.original_filename as string,
    outputLanguage: (row.output_language as Job["outputLanguage"]) ?? "en",
    extractedText: (row.extracted_text as string | null) ?? null,
    extractedJson: (row.extracted_json as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    companyId: (row.company_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTranslation(row: Record<string, unknown>): TranslationCacheEntry {
  return {
    sourceText: row.source_text as string,
    et: row.et as string | null,
    lv: row.lv as string | null,
    lt: row.lt as string | null,
  };
}

export function createPostgresStore(): JobStore {
  return {
    async createJob(input: CreateJobInput): Promise<Job> {
      return withClient(async (client) => {
        const columns = ["original_filename", "output_language", "company_id"];
        const values: unknown[] = [
          input.originalFilename,
          input.outputLanguage ?? "en",
          input.companyId ?? null,
        ];
        if (input.id) {
          columns.unshift("id");
          values.unshift(input.id);
        }
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const result = await client.query(
          `INSERT INTO jobs (${columns.join(", ")})
           VALUES (${placeholders})
           RETURNING *`,
          values,
        );
        return rowToJob(result.rows[0]);
      });
    },

    async getJob(id: string): Promise<Job | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT * FROM jobs WHERE id = $1`,
          [id],
        );
        return result.rows.length > 0 ? rowToJob(result.rows[0]) : null;
      });
    },

    async updateJob(id: string, input: UpdateJobInput): Promise<Job> {
      return withClient(async (client) => {
        const sets: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (input.state !== undefined) {
          sets.push(`state = $` + paramIndex);
          values.push(input.state);
          paramIndex++;
        }
        if (input.extractedText !== undefined) {
          sets.push(`extracted_text = $` + paramIndex);
          values.push(input.extractedText ?? null);
          paramIndex++;
        }
        if (input.extractedJson !== undefined) {
          sets.push(`extracted_json = $` + paramIndex);
          values.push(input.extractedJson ?? null);
          paramIndex++;
        }
        if (input.error !== undefined) {
          sets.push(`error = $` + paramIndex);
          values.push(input.error ?? null);
          paramIndex++;
        }

        if (sets.length === 0) {
          const result = await client.query(
            `SELECT * FROM jobs WHERE id = $1`,
            [id],
          );
          if (result.rows.length === 0) throw new Error(`Job ${id} not found`);
          return rowToJob(result.rows[0]);
        }

        sets.push(`updated_at = NOW()`);
        values.push(id);

        const result = await client.query(
          `UPDATE jobs SET ` + sets.join(", ") + ` WHERE id = $` + paramIndex + ` RETURNING *`,
          values,
        );

        if (result.rows.length === 0) throw new Error(`Job ${id} not found`);
        return rowToJob(result.rows[0]);
      });
    },

    async pollNextPending(): Promise<Job | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `UPDATE jobs
           SET state = 'parsing', updated_at = NOW()
           WHERE id = (
             SELECT id FROM jobs
             WHERE state = 'pending'
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           RETURNING *`,
        );

        if (result.rows.length > 0) {
          return rowToJob(result.rows[0]);
        }
        return null;
      });
    },

    async resetStaleJobs(staleAfterMs: number): Promise<number> {
      return withClient(async (client) => {
        const result = await client.query(
          `UPDATE jobs
           SET state = 'pending', updated_at = NOW()
           WHERE state = ANY($1::text[])
             AND updated_at < NOW() - ($2 * INTERVAL '1 millisecond')`,
          [["parsing", "extracting", "translating", "assembling"], staleAfterMs],
        );
        return result.rowCount ?? 0;
      });
    },

    async deleteOldJobs(retentionMs: number, minCount: number): Promise<number> {
      return withClient(async (client) => {
        // Count terminal jobs
        const countResult = await client.query(
          `SELECT COUNT(*) AS total FROM jobs WHERE state = ANY($1::text[])`,
          [["complete", "failed"]],
        );
        const total = parseInt(countResult.rows[0].total, 10);
        if (total <= minCount) return 0;

        // Delete old terminal jobs in batches, keeping at least minCount
        const toDelete = total - minCount;
        const batchSize = 100;
        let deleted = 0;

        while (deleted < toDelete) {
          const limit = Math.min(batchSize, toDelete - deleted);
          const result = await client.query(
            `DELETE FROM jobs
             WHERE id IN (
               SELECT id FROM jobs
               WHERE state = ANY($1::text[])
                 AND updated_at < NOW() - ($2 * INTERVAL '1 millisecond')
               ORDER BY updated_at ASC
               LIMIT $3
             )`,
            [["complete", "failed"], retentionMs, limit],
          );
          const rowsDeleted = result.rowCount ?? 0;
          if (rowsDeleted === 0) break;
          deleted += rowsDeleted;
        }

        return deleted;
      });
    },

    async getCachedTranslations(sourceTexts: string[]): Promise<Map<string, TranslationCacheEntry>> {
      if (sourceTexts.length === 0) return new Map();

      return withClient(async (client) => {
        const result = await client.query(
          `SELECT source_text, et, lv, lt
           FROM translation_cache
           WHERE source_text = ANY($1::text[])`,
          [sourceTexts],
        );

        return new Map(result.rows.map((row) => {
          const entry = rowToTranslation(row);
          return [entry.sourceText, entry];
        }));
      });
    },

    async saveCachedTranslations(entries: TranslationCacheEntry[]): Promise<void> {
      if (entries.length === 0) return;

      await withClient(async (client) => {
        // Batch all entries into a single multi-row INSERT to reduce DB roundtrips
        const params: unknown[] = [];
        const placeholders: string[] = [];

        for (let i = 0; i < entries.length; i++) {
          const base = i * 4;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
          params.push(
            entries[i].sourceText,
            entries[i].et ?? null,
            entries[i].lv ?? null,
            entries[i].lt ?? null,
          );
        }

        await client.query(
          `INSERT INTO translation_cache (source_text, et, lv, lt)
           VALUES ${placeholders.join(", ")}
           ON CONFLICT (source_text) DO UPDATE SET
             et = COALESCE(EXCLUDED.et, translation_cache.et),
             lv = COALESCE(EXCLUDED.lv, translation_cache.lv),
             lt = COALESCE(EXCLUDED.lt, translation_cache.lt),
             updated_at = NOW()`,
          params,
        );
      });
    },
  };
}

export function createPostgresFileStore(): FileStore {
  return createAutoFileStore("./bei-data");
}

// ── Company store ──────────────────────────────────────────────────────────

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    ticker: (row.ticker as string | null) ?? null,
    exchange: row.exchange as string,
    slug: row.slug as string,
    country: (row.country as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    reportCount: (row.report_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCount(row: Record<string, unknown> | undefined): number {
  const total = row?.total;
  if (typeof total === "number") return total;
  if (typeof total === "string") return Number.parseInt(total, 10) || 0;
  return 0;
}

export function createCompanyStore(): CompanyStore {
  return {
    async listCompanies(): Promise<Company[]> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT *,
                  (SELECT COUNT(*)::int FROM reports r WHERE r.company_id = companies.id) AS report_count
           FROM companies
           ORDER BY exchange, name`,
        );
        return result.rows.map(rowToCompany);
      });
    },

    async countCompanies(): Promise<number> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS total FROM companies`,
        );
        return rowToCount(result.rows[0]);
      });
    },

    async getCompanyBySlug(slug: string): Promise<Company | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT *,
                  (SELECT COUNT(*)::int FROM reports r WHERE r.company_id = companies.id) AS report_count
           FROM companies
           WHERE slug = $1`,
          [slug],
        );
        return result.rows.length > 0 ? rowToCompany(result.rows[0]) : null;
      });
    },

    async createCompany(input: CreateCompanyInput): Promise<Company> {
      return withClient(async (client) => {
        const result = await client.query(
          `INSERT INTO companies (name, ticker, exchange, slug, country, sector)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             ticker = EXCLUDED.ticker,
             exchange = EXCLUDED.exchange,
             country = EXCLUDED.country,
             sector = EXCLUDED.sector,
             updated_at = NOW()
           RETURNING *`,
          [input.name, input.ticker ?? null, input.exchange, input.slug, input.country ?? null, input.sector ?? null],
        );
        const company = rowToCompany(result.rows[0]);
        company.reportCount = 0;
        return company;
      });
    },
  };
}

// ── Seed ───────────────────────────────────────────────────────────────────

/** Seed Baltic listed companies — idempotent via ON CONFLICT (slug). */
export async function seedCompanies(): Promise<number> {
  const store = createCompanyStore();
  let count = 0;
  for (const c of BALTIC_COMPANIES) {
    await store.createCompany(c);
    count++;
  }
  return count;
}

// ── Report store ───────────────────────────────────────────────────────────

function rowToReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    companyId: (row.company_id as string | null) ?? null,
    fiscalYear: row.fiscal_year as number,
    reportType: row.report_type as Report["reportType"],
    language: row.language as Report["language"],
    jobId: (row.job_id as string | null) ?? null,
    s3Key: row.s3_key as string,
    extractedJsonSnapshot: parseJsonSnapshot(row.extracted_json_snapshot),
    createdAt: row.created_at as string,
  };
}

function rowToReportWithPreview(row: Record<string, unknown>): ReportWithPreview {
  const base = rowToReport(row);
  const snapshot = base.extractedJsonSnapshot;
  const preview = buildReportPreview(snapshot);
  return {
    ...base,
    companyName: (row.company_name as string | null) ?? null,
    companySlug: (row.company_slug as string | null) ?? null,
    ...preview,
    previewGuidanceSentiment: snapshot?.sentiment?.guidanceDirection ?? null,
  };
}

function parseJsonSnapshot(raw: unknown): ExtractedData | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "metadata" in raw) return raw as ExtractedData;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as ExtractedData; }
    catch { return null; }
  }
  return null;
}

export function createReportStore(): ReportStore {
  return {
    async createReport(input: CreateReportInput): Promise<Report> {
      return withClient(async (client) => {
        try {
          const result = await client.query(
            `INSERT INTO reports (company_id, fiscal_year, report_type, language, job_id, s3_key, extracted_json_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              input.companyId ?? null,
              input.fiscalYear,
              input.reportType,
              input.language,
              input.jobId ?? null,
              input.s3Key,
              input.extractedJsonSnapshot ? JSON.stringify(input.extractedJsonSnapshot) : null,
            ],
          );
          return rowToReport(result.rows[0]);
        } catch (err: any) {
          if (err?.code === "23505") {
            throw new DuplicateReportError(
              `Duplicate report: company=${input.companyId ?? "unmatched"}, year=${input.fiscalYear}, type=${input.reportType}, lang=${input.language}`,
            );
          }
          throw err;
        }
      });
    },

    async getReportById(id: string): Promise<Report | null> {
      return withClient(async (client) => {
        const result = await client.query(`SELECT * FROM reports WHERE id = $1`, [id]);
        return result.rows.length > 0 ? rowToReport(result.rows[0]) : null;
      });
    },

    async getReportByJobId(jobId: string): Promise<Report | null> {
      return withClient(async (client) => {
        const result = await client.query(`SELECT * FROM reports WHERE job_id = $1`, [jobId]);
        return result.rows.length > 0 ? rowToReport(result.rows[0]) : null;
      });
    },

    async getReportByMatch(
      companyId: string | null,
      fiscalYear: number,
      reportType: Report["reportType"],
      language: Report["language"],
    ): Promise<Report | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT * FROM reports WHERE company_id IS NOT DISTINCT FROM $1 AND fiscal_year = $2 AND report_type = $3 AND language = $4`,
          [companyId ?? null, fiscalYear, reportType, language],
        );
        return result.rows.length > 0 ? rowToReport(result.rows[0]) : null;
      });
    },

    async listReportsByCompany(companyId: string): Promise<ReportWithPreview[]> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT r.*, c.name AS company_name, c.slug AS company_slug
           FROM reports r
           LEFT JOIN companies c ON c.id = r.company_id
           WHERE r.company_id = $1
           ORDER BY r.fiscal_year DESC, r.report_type`,
          [companyId],
        );
        return result.rows.map(rowToReportWithPreview);
      });
    },

    async listUnmatchedReports(): Promise<Report[]> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT * FROM reports WHERE company_id IS NULL ORDER BY created_at DESC`,
        );
        return result.rows.map(rowToReport);
      });
    },

    async countProcessedReports(): Promise<number> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS total FROM reports`,
        );
        return rowToCount(result.rows[0]);
      });
    },

    async updateReportCompany(reportId: string, companyId: string): Promise<Report> {
      return withClient(async (client) => {
        const result = await client.query(
          `UPDATE reports SET company_id = $2 WHERE id = $1 RETURNING *`,
          [reportId, companyId],
        );
        if (result.rows.length === 0) throw new Error(`Report ${reportId} not found`);
        return rowToReport(result.rows[0]);
      });
    },

    async replaceReport(
      reportId: string,
      newJobId: string,
      newS3Key: string,
      newSnapshot: ExtractedData,
    ): Promise<Report> {
      return withClient(async (client) => {
        const result = await client.query(
          `UPDATE reports
           SET job_id = $2, s3_key = $3, extracted_json_snapshot = $4
           WHERE id = $1
           RETURNING *`,
          [reportId, newJobId, newS3Key, JSON.stringify(newSnapshot)],
        );
        if (result.rows.length === 0) throw new Error(`Report ${reportId} not found`);
        return rowToReport(result.rows[0]);
      });
    },

    async listRecentReports(limit: number): Promise<ReportWithPreview[]> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT r.*, c.name AS company_name, c.slug AS company_slug
           FROM reports r
           LEFT JOIN companies c ON c.id = r.company_id
           ORDER BY r.created_at DESC
           LIMIT $1`,
          [limit],
        );
        return result.rows.map(rowToReportWithPreview);
      });
    },

    async listReportsForCompare(options?: {
      query?: string;
      limit?: number;
    }): Promise<ReportWithPreview[]> {
      const rawQuery = options?.query?.trim() ?? "";
      const search = rawQuery.length > 0 ? rawQuery : null;
      const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);

      return withClient(async (client) => {
        const result = await client.query(
          `SELECT r.*, c.name AS company_name, c.slug AS company_slug
           FROM reports r
           LEFT JOIN companies c ON c.id = r.company_id
           WHERE (
             $1::text IS NULL
             OR c.name ILIKE '%' || $1 || '%'
             OR COALESCE(c.ticker, '') ILIKE '%' || $1 || '%'
             OR COALESCE(c.slug, '') ILIKE '%' || $1 || '%'
             OR r.fiscal_year::text LIKE $1 || '%'
           )
           ORDER BY c.name NULLS LAST, r.fiscal_year DESC, r.report_type
           LIMIT $2`,
          [search, limit],
        );
        return result.rows.map(rowToReportWithPreview);
      });
    },
  };
}
