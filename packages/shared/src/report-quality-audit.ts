import type { Company, Report, ReportWithPreview, ExtractedData, ExtractedNarrative } from "./contracts";
import { inferCanonicalMetricId } from "./canonical-metrics";

export interface ReportMismatchAudit {
  reportId: string;
  jobId: string | null;
  s3Key: string;
  catalogCompanyId: string | null;
  catalogCompanyName: string | null;
  extractedCompanyName: string;
  fiscalYear: number;
  reportType: Report["reportType"];
  language: Report["language"];
  currentCompanyConfidence: number;
  suggestedCompanyId: string | null;
  suggestedCompanyName: string | null;
  suggestedConfidence: number;
  reason: string;
}

export type ReportQualitySeverity = "high" | "medium" | "low";

export interface ReportQualityAudit {
  reportId: string;
  jobId: string | null;
  s3Key: string;
  catalogCompanyId: string | null;
  catalogCompanyName: string | null;
  extractedCompanyName: string | null;
  fiscalYear: number;
  reportType: Report["reportType"];
  language: Report["language"];
  severity: ReportQualitySeverity;
  issueCodes: string[];
  warnings: string[];
  suggestedCompanyId?: string | null;
  suggestedCompanyName?: string | null;
  suggestedConfidence?: number;
}

type CandidateCompany = Pick<Company, "id" | "name" | "ticker">;

const LEGAL_FORM_TOKENS = new Set([
  "ab",
  "as",
  "ou",
  "oü",
  "uab",
  "sia",
  "ipas",
  "asa",
  "oyj",
  "plc",
  "ltd",
  "inc",
]);

const A_SLASH_S = /\ba\s*\/\s*s\b/gi;

const CANONICAL_NARRATIVE_SECTIONS = new Set([
  "executive_summary",
  "management_commentary",
  "business_overview",
  "segment_performance",
  "strategic_priorities",
  "outlook",
  "other",
]);

const CORE_METRIC_IDS = new Set(["revenue", "ebitda", "net_profit", "free_cash_flow"]);

const SEVERITY_SCORE: Record<ReportQualitySeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function tokenize(name: string): string[] {
  return name
    .replace(A_SLASH_S, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()'"„“”‘’/\\&]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeCompanyNameForAudit(name: string): string[] {
  return tokenize(name).filter((token) => !LEGAL_FORM_TOKENS.has(token));
}

function osaDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }

  return d[m]![n]!;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function scoreCompanyNameMatch(extractedName: string, company: CandidateCompany): number {
  const extractedTokens = normalizeCompanyNameForAudit(extractedName);
  const companyTokens = normalizeCompanyNameForAudit(company.name);
  const extractedNormalized = extractedTokens.join(" ");
  const companyNormalized = companyTokens.join(" ");

  if (!extractedNormalized || !companyNormalized) return 0;

  const distance = osaDistance(extractedNormalized, companyNormalized);
  const maxLength = Math.max(extractedNormalized.length, companyNormalized.length);
  const distanceConfidence = maxLength === 0 ? 0 : 1 - distance / maxLength;
  const tokenConfidence = jaccard(new Set(extractedTokens), new Set(companyTokens));

  let tickerConfidence = 0;
  if (company.ticker && tokenize(extractedName).includes(company.ticker.toLowerCase())) {
    tickerConfidence = 1;
  }

  return Math.max(distanceConfidence, tokenConfidence, tickerConfidence);
}

export function findSuggestedCompany(
  extractedName: string,
  companies: CandidateCompany[],
): { company: CandidateCompany | null; confidence: number } {
  let best: { company: CandidateCompany | null; confidence: number } = {
    company: null,
    confidence: 0,
  };

  for (const company of companies) {
    const confidence = scoreCompanyNameMatch(extractedName, company);
    if (confidence > best.confidence) {
      best = { company, confidence };
    }
  }

  return best;
}

export function auditReportCompanyMismatch(
  report: ReportWithPreview,
  companies: CandidateCompany[],
  threshold = 0.85,
): ReportMismatchAudit | null {
  if (!report.companyId) return null;

  const extractedCompanyName = report.extractedJsonSnapshot?.metadata.companyName.trim() ?? "";
  if (!extractedCompanyName) return null;

  const catalogCompany = companies.find((company) => company.id === report.companyId);
  if (!catalogCompany) {
    return {
      reportId: report.id,
      jobId: report.jobId,
      s3Key: report.s3Key,
      catalogCompanyId: report.companyId,
      catalogCompanyName: report.companyName ?? null,
      extractedCompanyName,
      fiscalYear: report.fiscalYear,
      reportType: report.reportType,
      language: report.language,
      currentCompanyConfidence: 0,
      suggestedCompanyId: null,
      suggestedCompanyName: null,
      suggestedConfidence: 0,
      reason: "catalog company id is missing from companies table",
    };
  }

  const currentCompanyConfidence = scoreCompanyNameMatch(extractedCompanyName, catalogCompany);
  if (currentCompanyConfidence >= threshold) return null;

  const suggested = findSuggestedCompany(extractedCompanyName, companies);

  return {
    reportId: report.id,
    jobId: report.jobId,
    s3Key: report.s3Key,
    catalogCompanyId: report.companyId,
    catalogCompanyName: catalogCompany.name,
    extractedCompanyName,
    fiscalYear: report.fiscalYear,
    reportType: report.reportType,
    language: report.language,
    currentCompanyConfidence,
    suggestedCompanyId: suggested.confidence >= threshold ? suggested.company?.id ?? null : null,
    suggestedCompanyName: suggested.confidence >= threshold ? suggested.company?.name ?? null : null,
    suggestedConfidence: suggested.confidence,
    reason: `extracted company does not match catalog company above ${threshold.toFixed(2)} confidence`,
  };
}

function normalizeNarrativeSection(section: string): string {
  return section
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function findNonCanonicalNarrativeSections(narratives: ExtractedNarrative[]): string[] {
  const sections = new Set<string>();
  for (const narrative of narratives) {
    const section = narrative.section?.trim();
    if (!section) continue;
    if (!CANONICAL_NARRATIVE_SECTIONS.has(normalizeNarrativeSection(section))) {
      sections.add(section);
    }
  }
  return Array.from(sections);
}

function hasExecutiveSummary(narratives: ExtractedNarrative[]): boolean {
  return narratives.some((narrative) => normalizeNarrativeSection(narrative.section) === "executive_summary");
}

function getMetricCanonicalId(metric: ExtractedData["metrics"][number]): string | null {
  return metric.canonicalId ?? inferCanonicalMetricId(metric.originalLabel ?? metric.label);
}

function findMissingCoreMetrics(snapshot: ExtractedData): string[] {
  const present = new Set(
    snapshot.metrics
      .filter((metric) => metric.value != null)
      .map(getMetricCanonicalId)
      .filter((id): id is string => id !== null),
  );

  return Array.from(CORE_METRIC_IDS).filter((id) => !present.has(id));
}

function hasAnyFiniteTrendValue(values: unknown): boolean {
  return Array.isArray(values) && values.some((value) => typeof value === "number" && Number.isFinite(value));
}

function auditTrendData(snapshot: ExtractedData, issueCodes: string[], warnings: string[]): void {
  const trends = snapshot.profitabilityTrends;
  if (!trends) return;

  const periods = Array.isArray(trends.periods) ? trends.periods : [];
  const series = [
    ["revenue", trends.revenue],
    ["ebitda", trends.ebitda],
    ["netProfit", trends.netProfit],
    ["freeCashFlow", trends.freeCashFlow],
  ] as const;

  const duplicatePeriods = new Set<string>();
  const seenPeriods = new Set<string>();
  for (const period of periods) {
    const normalized = period.trim().toLowerCase();
    if (!normalized) continue;
    if (seenPeriods.has(normalized)) duplicatePeriods.add(period);
    seenPeriods.add(normalized);
  }
  if (duplicatePeriods.size > 0) {
    issueCodes.push("duplicate_trend_periods");
    warnings.push(`Duplicate profitability trend period(s): ${Array.from(duplicatePeriods).join(", ")}.`);
  }

  const mismatchedSeries = series
    .filter(([, values]) => Array.isArray(values) && values.length !== periods.length)
    .map(([name, values]) => `${name}(${values?.length ?? 0}/${periods.length})`);
  if (mismatchedSeries.length > 0) {
    issueCodes.push("trend_series_length_mismatch");
    warnings.push(`Trend series length mismatch: ${mismatchedSeries.join(", ")}.`);
  }

  const hasAnyValue = series.some(([, values]) => hasAnyFiniteTrendValue(values));
  if (periods.length > 0 && !hasAnyValue) {
    issueCodes.push("all_null_trends");
    warnings.push("Profitability trends contain periods but no finite series values.");
  }
}

function normalizedBreakdownName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function findDuplicateBreakdownNames(items: { name: string; value: number }[] | undefined): string[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const normalized = normalizedBreakdownName(item.name);
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(item.name);
    seen.add(normalized);
  }
  return Array.from(duplicates);
}

function auditRevenueBreakdown(snapshot: ExtractedData, issueCodes: string[], warnings: string[]): void {
  const breakdown = snapshot.revenueBreakdown;
  if (!breakdown) return;

  const duplicateSegments = findDuplicateBreakdownNames(breakdown.bySegment);
  const duplicateGeographies = findDuplicateBreakdownNames(breakdown.byGeography);
  if (duplicateSegments.length > 0 || duplicateGeographies.length > 0) {
    issueCodes.push("duplicate_revenue_breakdown_entries");
    warnings.push(
      `Duplicate revenue breakdown entries: ${[
        duplicateSegments.length > 0 ? `segments=${duplicateSegments.join(", ")}` : null,
        duplicateGeographies.length > 0 ? `geographies=${duplicateGeographies.join(", ")}` : null,
      ].filter(Boolean).join("; ")}.`,
    );
  }
}

function addIssue(
  issueCodes: string[],
  warnings: string[],
  code: string,
  warning: string,
): void {
  issueCodes.push(code);
  warnings.push(warning);
}

function highestSeverityForIssueCodes(issueCodes: string[]): ReportQualitySeverity {
  let severity: ReportQualitySeverity = "low";
  for (const code of issueCodes) {
    const next: ReportQualitySeverity =
      code === "company_mismatch" ||
      code === "missing_snapshot" ||
      code === "missing_company_metadata" ||
      code === "missing_report_period_metadata" ||
      code === "zero_metrics"
        ? "high"
        : code === "missing_core_metrics" ||
            code === "mostly_null_metrics" ||
            code === "all_null_trends" ||
            code === "trend_series_length_mismatch"
          ? "medium"
          : "low";
    if (SEVERITY_SCORE[next] > SEVERITY_SCORE[severity]) severity = next;
  }
  return severity;
}

export function auditReportQuality(
  report: ReportWithPreview,
  companies: CandidateCompany[],
  threshold = 0.85,
): ReportQualityAudit | null {
  const issueCodes: string[] = [];
  const warnings: string[] = [];
  const snapshot = report.extractedJsonSnapshot;

  const mismatch = auditReportCompanyMismatch(report, companies, threshold);
  if (mismatch) {
    addIssue(
      issueCodes,
      warnings,
      "company_mismatch",
      `Extracted company "${mismatch.extractedCompanyName}" does not match catalog company "${mismatch.catalogCompanyName ?? "-"}" (${mismatch.currentCompanyConfidence.toFixed(2)} confidence).`,
    );
  }

  if (!snapshot) {
    addIssue(issueCodes, warnings, "missing_snapshot", "Report has no extracted JSON snapshot.");
  } else {
    const extractedCompanyName = snapshot.metadata?.companyName?.trim() ?? "";
    const reportPeriod = snapshot.metadata?.reportPeriod?.trim() ?? "";

    if (!extractedCompanyName) {
      addIssue(issueCodes, warnings, "missing_company_metadata", "Extracted company metadata is missing.");
    }
    if (!reportPeriod) {
      addIssue(issueCodes, warnings, "missing_report_period_metadata", "Extracted report period metadata is missing.");
    }

    if (snapshot.metrics.length === 0) {
      addIssue(issueCodes, warnings, "zero_metrics", "No metrics were extracted.");
    } else {
      const nullMetricCount = snapshot.metrics.filter((metric) => metric.value == null).length;
      if (nullMetricCount / snapshot.metrics.length >= 0.5) {
        addIssue(
          issueCodes,
          warnings,
          "mostly_null_metrics",
          `Most metrics have null values (${nullMetricCount}/${snapshot.metrics.length}).`,
        );
      }

      const missingCoreMetrics = findMissingCoreMetrics(snapshot);
      if (missingCoreMetrics.length > 0) {
        addIssue(
          issueCodes,
          warnings,
          "missing_core_metrics",
          `Missing core metric(s): ${missingCoreMetrics.join(", ")}.`,
        );
      }
    }

    auditTrendData(snapshot, issueCodes, warnings);
    auditRevenueBreakdown(snapshot, issueCodes, warnings);

    const nonCanonicalSections = findNonCanonicalNarrativeSections(snapshot.narratives);
    if (nonCanonicalSections.length > 0) {
      addIssue(
        issueCodes,
        warnings,
        "non_canonical_narrative_sections",
        `Non-canonical narrative section(s): ${nonCanonicalSections.join(", ")}.`,
      );
    }
    if (snapshot.narratives.length > 0 && !hasExecutiveSummary(snapshot.narratives)) {
      addIssue(issueCodes, warnings, "missing_executive_summary", "Narratives are present but executive_summary is missing.");
    }
  }

  if (issueCodes.length === 0) return null;

  return {
    reportId: report.id,
    jobId: report.jobId,
    s3Key: report.s3Key,
    catalogCompanyId: report.companyId,
    catalogCompanyName: report.companyName ?? null,
    extractedCompanyName: snapshot?.metadata?.companyName?.trim() || mismatch?.extractedCompanyName || null,
    fiscalYear: report.fiscalYear,
    reportType: report.reportType,
    language: report.language,
    severity: highestSeverityForIssueCodes(issueCodes),
    issueCodes: Array.from(new Set(issueCodes)),
    warnings,
    suggestedCompanyId: mismatch?.suggestedCompanyId ?? null,
    suggestedCompanyName: mismatch?.suggestedCompanyName ?? null,
    suggestedConfidence: mismatch?.suggestedConfidence ?? 0,
  };
}
