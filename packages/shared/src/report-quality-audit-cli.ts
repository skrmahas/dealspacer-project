#!/usr/bin/env tsx
import { closePool, getPool } from "./db";
import type { Company, ExtractedData, ReportType, OutputLanguage, ReportWithPreview } from "./contracts";
import {
  auditReportCompanyMismatch,
  auditReportQuality,
  type ReportMismatchAudit,
  type ReportQualityAudit,
} from "./report-quality-audit";

type Format = "table" | "json";

interface CliOptions {
  format: Format;
  threshold: number;
  moveToUnmatchedIds: string[];
  confirm: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    format: "table",
    threshold: 0.85,
    moveToUnmatchedIds: [],
    confirm: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--format") {
      const value = argv[++i];
      if (value !== "table" && value !== "json") throw new Error("--format must be table or json");
      options.format = value;
    } else if (arg === "--threshold") {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new Error("--threshold must be a number between 0 and 1");
      }
      options.threshold = value;
    } else if (arg === "--move-to-unmatched") {
      const value = argv[++i];
      if (!value) throw new Error("--move-to-unmatched requires a comma-separated report id list");
      options.moveToUnmatchedIds = value.split(",").map((id) => id.trim()).filter(Boolean);
    } else if (arg === "--confirm") {
      options.confirm = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage:
  npm run reports:audit --workspace @bei/shared
  npm run reports:audit --workspace @bei/shared -- --format json
  npm run reports:audit --workspace @bei/shared -- --move-to-unmatched <report-id>[,<report-id>] --confirm

Options:
  --format table|json           Output format. Defaults to table.
  --threshold <0..1>            Match confidence threshold. Defaults to 0.85.
  --move-to-unmatched <ids>     Move audited mismatch reports to company_id = null.
  --confirm                     Required for mutation. Without it, mutation is dry-run.
`);
}

function parseSnapshot(raw: unknown): ExtractedData | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "metadata" in raw) return raw as ExtractedData;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ExtractedData;
    } catch {
      return null;
    }
  }
  return null;
}

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    ticker: (row.ticker as string | null) ?? null,
    exchange: row.exchange as string,
    slug: row.slug as string,
    country: (row.country as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    reportCount: 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToReport(row: Record<string, unknown>): ReportWithPreview {
  return {
    id: row.id as string,
    companyId: (row.company_id as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    fiscalYear: row.fiscal_year as number,
    reportType: row.report_type as ReportType,
    language: row.language as OutputLanguage,
    jobId: (row.job_id as string | null) ?? null,
    s3Key: row.s3_key as string,
    extractedJsonSnapshot: parseSnapshot(row.extracted_json_snapshot),
    createdAt: row.created_at as string,
  };
}

async function loadCatalog(): Promise<{ companies: Company[]; reports: ReportWithPreview[] }> {
  const pool = getPool();
  const [companiesResult, reportsResult] = await Promise.all([
    pool.query(`SELECT * FROM companies ORDER BY exchange, name`),
    pool.query(`
      SELECT r.*, c.name AS company_name
      FROM reports r
      LEFT JOIN companies c ON c.id = r.company_id
      ORDER BY r.created_at DESC
    `),
  ]);

  return {
    companies: companiesResult.rows.map(rowToCompany),
    reports: reportsResult.rows.map(rowToReport),
  };
}

function severityRank(severity: ReportQualityAudit["severity"]): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function sortQualityAudits(audits: ReportQualityAudit[]): ReportQualityAudit[] {
  return [...audits].sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    return b.warnings.length - a.warnings.length;
  });
}

function printTable(audits: ReportQualityAudit[]): void {
  if (audits.length === 0) {
    console.log("No report quality issues found.");
    return;
  }

  console.log(`Found ${audits.length} report(s) with quality issue(s):`);
  for (const audit of audits) {
    console.log("");
    console.log(`report:    ${audit.reportId}`);
    console.log(`job:       ${audit.jobId ?? "-"}`);
    console.log(`period:    FY ${audit.fiscalYear} ${audit.reportType} (${audit.language})`);
    console.log(`severity:  ${audit.severity}`);
    console.log(`catalog:   ${audit.catalogCompanyName ?? "-"} (${audit.catalogCompanyId ?? "-"})`);
    console.log(`extracted: ${audit.extractedCompanyName ?? "-"}`);
    console.log(`issues:    ${audit.issueCodes.join(", ")}`);
    if (audit.suggestedCompanyId) {
      console.log(`suggested: ${audit.suggestedCompanyName ?? "-"} (${audit.suggestedCompanyId}, ${(audit.suggestedConfidence ?? 0).toFixed(2)})`);
    }
    console.log(`s3 key:    ${audit.s3Key}`);
    for (const warning of audit.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

async function moveToUnmatched(audits: ReportMismatchAudit[], ids: string[], confirm: boolean): Promise<void> {
  if (ids.length === 0) return;

  const auditedIds = new Set(audits.map((audit) => audit.reportId));
  const invalidIds = ids.filter((id) => !auditedIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error(
      `Refusing to move report id(s) not present in the current mismatch audit: ${invalidIds.join(", ")}`,
    );
  }

  if (!confirm) {
    console.log(`[dry-run] Would move ${ids.length} report(s) to unmatched: ${ids.join(", ")}`);
    console.log("[dry-run] Add --confirm to mutate the database.");
    return;
  }

  const pool = getPool();
  await pool.query(
    `UPDATE reports SET company_id = NULL WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  console.log(`Moved ${ids.length} report(s) to unmatched: ${ids.join(", ")}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { companies, reports } = await loadCatalog();
  const mismatchAudits = reports
    .map((report) => auditReportCompanyMismatch(report, companies, options.threshold))
    .filter((audit): audit is ReportMismatchAudit => audit !== null);
  const audits = sortQualityAudits(
    reports
      .map((report) => auditReportQuality(report, companies, options.threshold))
      .filter((audit): audit is ReportQualityAudit => audit !== null),
  );

  if (options.format === "json") {
    const issueCounts = audits.reduce<Record<string, number>>((counts, audit) => {
      for (const issueCode of audit.issueCodes) {
        counts[issueCode] = (counts[issueCode] ?? 0) + 1;
      }
      return counts;
    }, {});
    console.log(JSON.stringify({
      reportCount: reports.length,
      issueReportCount: audits.length,
      mismatchCount: mismatchAudits.length,
      issueCounts,
      audits,
    }, null, 2));
  } else {
    printTable(audits);
  }

  await moveToUnmatched(mismatchAudits, options.moveToUnmatchedIds, options.confirm);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
