/** Domain types shared by stores (no imports from pg-store/db — avoids barrel cycles). */

export type JobState = "pending" | "parsing" | "extracting" | "translating" | "assembling" | "complete" | "failed" | "duplicate";
export type OutputLanguage = "en" | "et" | "lv" | "lt";

export interface Job {
  id: string;
  state: JobState;
  originalFilename: string;
  outputLanguage: OutputLanguage;
  extractedText: string | null;
  extractedJson: string | null;
  error: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobInput = Pick<Job, "originalFilename"> & {
  id?: string;
  outputLanguage?: OutputLanguage;
  companyId?: string | null;
};
export type UpdateJobInput = {
  state?: JobState;
  extractedText?: string | null;
  extractedJson?: string | null;
  error?: string | null;
};

export interface JobStore {
  createJob(input: CreateJobInput): Promise<Job>;
  getJob(id: string): Promise<Job | null>;
  updateJob(id: string, input: UpdateJobInput): Promise<Job>;
  pollNextPending(): Promise<Job | null>;
  resetStaleJobs?(staleAfterMs: number): Promise<number>;
  getCachedTranslations(sourceTexts: string[]): Promise<Map<string, TranslationCacheEntry>>;
  saveCachedTranslations(entries: TranslationCacheEntry[]): Promise<void>;
  deleteOldJobs?(retentionMs: number, minCount: number): Promise<number>;
}

export interface TranslationCacheEntry {
  sourceText: string;
  et?: string | null;
  lv?: string | null;
  lt?: string | null;
}

export interface ExtractedMetric {
  label: string;
  value: number | null;
  unit?: string;
  period?: string;
  /** Stable metric identifier used for previews, charts, comparisons, and quality checks. */
  canonicalId?: CanonicalMetricId;
  /** Source label before localization or display edits. */
  originalLabel?: string;
  /** Source unit before normalization. */
  originalUnit?: string;
  /** Value normalized into `normalizedUnit` where the unit can be inferred safely. */
  normalizedValue?: number | null;
  normalizedUnit?: string;
  evidence?: ExtractedEvidence;
}

export interface ExtractedEvidence {
  /** 1-based source page when available from OCR/parser context. */
  page?: number | null;
  /** 0-based extraction chunk index for large filings or targeted extraction fallback. */
  chunkIndex?: number | null;
  /** Compact nearby source text. Keep short enough for report snapshots. */
  snippet?: string;
  /** Extractor confidence from 0 to 1. */
  confidence?: number | null;
  /** Short rationale for computed or inferred facts. */
  rationale?: string;
}

export type CanonicalMetricId =
  | "revenue"
  | "ebitda"
  | "net_profit"
  | "free_cash_flow"
  | "operating_cash_flow"
  | "capex"
  | "total_assets"
  | "equity"
  | "liabilities"
  | "eps"
  | "dividends";

export interface ExtractedNarrative {
  section: string;
  text: string;
}

export interface ExtractedSentiment {
  managementTone: string;
  outlook: string;
  riskFactors: string[];
  guidanceDirection?: "raised" | "maintained" | "lowered" | null;
}

export interface RevenueBreakdown {
  bySegment?: { name: string; value: number }[];
  byGeography?: { name: string; value: number }[];
}

export interface ProfitabilityTrends {
  periods: string[];
  revenue?: (number | null)[];
  ebitda?: (number | null)[];
  netProfit?: (number | null)[];
  freeCashFlow?: (number | null)[];
}

export interface ExtractedData {
  metadata: {
    companyName: string;
    reportPeriod: string;
    sourceLanguage: string;
    outputLanguage?: OutputLanguage;
    evidence?: {
      companyName?: ExtractedEvidence;
      reportPeriod?: ExtractedEvidence;
    };
  };
  metrics: ExtractedMetric[];
  narratives: ExtractedNarrative[];
  sentiment: ExtractedSentiment;
  revenueBreakdown?: RevenueBreakdown;
  profitabilityTrends?: ProfitabilityTrends;
  chartWarnings?: string[];
}

export interface Company {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string;
  slug: string;
  country: string | null;
  sector: string | null;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateCompanyInput = Pick<Company, "name" | "exchange" | "slug"> & {
  ticker?: string | null;
  country?: string | null;
  sector?: string | null;
};

export interface CompanyStore {
  listCompanies(): Promise<Company[]>;
  countCompanies(): Promise<number>;
  getCompanyBySlug(slug: string): Promise<Company | null>;
  createCompany(input: CreateCompanyInput): Promise<Company>;
}

export interface SeedCompany {
  name: string;
  ticker: string | null;
  exchange: string;
  slug: string;
  country: string | null;
  sector: string | null;
}

export type ReportType = "annual" | "q1" | "q2" | "q3" | "q4" | "semi-annual" | "other";

export interface Report {
  id: string;
  companyId: string | null;
  fiscalYear: number;
  reportType: ReportType;
  language: OutputLanguage;
  jobId: string | null;
  s3Key: string;
  extractedJsonSnapshot: ExtractedData | null;
  createdAt: string;
}

export interface ReportWithPreview extends Report {
  companyName?: string | null;
  companySlug?: string | null;
  previewRevenue?: number | null;
  previewEbitda?: number | null;
  previewNetProfit?: number | null;
  previewFcf?: number | null;
  previewGuidanceSentiment?: string | null;
}

export type ReportRerunCandidateStatus = "pending_review" | "failed_quality" | "approved" | "rejected";

export interface ReportRerunCandidate {
  id: string;
  reportId: string;
  jobId: string;
  s3Key: string;
  extractedJsonSnapshot: ExtractedData;
  status: ReportRerunCandidateStatus;
  qualityWarnings: string[];
  createdAt: string;
  approvedAt: string | null;
}

export interface CreateReportInput {
  companyId?: string | null;
  fiscalYear: number;
  reportType: ReportType;
  language: OutputLanguage;
  jobId?: string | null;
  s3Key: string;
  extractedJsonSnapshot?: ExtractedData | null;
}

export interface CreateReportRerunCandidateInput {
  reportId: string;
  jobId: string;
  s3Key: string;
  extractedJsonSnapshot: ExtractedData;
  status?: Extract<ReportRerunCandidateStatus, "pending_review" | "failed_quality">;
  qualityWarnings?: string[];
}

export interface ReportStore {
  createReport(input: CreateReportInput): Promise<Report>;
  getReportById(id: string): Promise<Report | null>;
  getReportByJobId(jobId: string): Promise<Report | null>;
  getReportByMatch(companyId: string | null, fiscalYear: number, reportType: ReportType, language: OutputLanguage): Promise<Report | null>;
  listReportsByCompany(companyId: string): Promise<ReportWithPreview[]>;
  listUnmatchedReports(): Promise<Report[]>;
  /** Counts all completed report rows, including unmatched rows awaiting admin mapping. */
  countProcessedReports(): Promise<number>;
  updateReportCompany(reportId: string, companyId: string): Promise<Report>;
  replaceReport(reportId: string, newJobId: string, newS3Key: string, newSnapshot: ExtractedData): Promise<Report>;
  createReportRerunCandidate(input: CreateReportRerunCandidateInput): Promise<ReportRerunCandidate>;
  getReportRerunCandidateById(id: string): Promise<ReportRerunCandidate | null>;
  promoteReportRerunCandidate(candidateId: string): Promise<Report>;
  listRecentReports(limit: number): Promise<ReportWithPreview[]>;
  listReportsForCompare(options?: { query?: string; limit?: number }): Promise<ReportWithPreview[]>;
}
