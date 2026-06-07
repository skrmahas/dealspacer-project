import type { Company, Report, ReportWithPreview } from "./contracts";

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
