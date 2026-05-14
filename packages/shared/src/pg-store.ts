import { withClient } from "./db";
import type { Job, CreateJobInput, UpdateJobInput, JobStore, TranslationCacheEntry } from "./index";

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    state: row.state as Job["state"],
    originalFilename: row.original_filename as string,
    outputLanguage: (row.output_language as Job["outputLanguage"]) ?? "en",
    extractedText: (row.extracted_text as string | null) ?? null,
    extractedJson: (row.extracted_json as string | null) ?? null,
    error: (row.error as string | null) ?? null,
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
        const result = await client.query(
          `INSERT INTO jobs (original_filename, output_language)
           VALUES ($1, $2)
           RETURNING *`,
          [input.originalFilename, input.outputLanguage ?? "en"],
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
          values.push(input.extractedText);
          paramIndex++;
        }
        if (input.extractedJson !== undefined) {
          sets.push(`extracted_json = $` + paramIndex);
          values.push(input.extractedJson);
          paramIndex++;
        }
        if (input.error !== undefined) {
          sets.push(`error = $` + paramIndex);
          values.push(input.error);
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
          await client.query(
            `UPDATE jobs SET state = 'pending' WHERE id = $1`,
            [result.rows[0].id],
          );
          return rowToJob(result.rows[0]);
        }
        return null;
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
        for (const entry of entries) {
          await client.query(
            `INSERT INTO translation_cache (source_text, et, lv, lt)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (source_text) DO UPDATE SET
               et = COALESCE(EXCLUDED.et, translation_cache.et),
               lv = COALESCE(EXCLUDED.lv, translation_cache.lv),
               lt = COALESCE(EXCLUDED.lt, translation_cache.lt),
               updated_at = NOW()`,
            [entry.sourceText, entry.et ?? null, entry.lv ?? null, entry.lt ?? null],
          );
        }
      });
    },
  };
}
