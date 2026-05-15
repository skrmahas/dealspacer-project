export { createPostgresStore, createPostgresFileStore, createCompanyStore, seedCompanies } from "./pg-store";
export { BALTIC_COMPANIES } from "./seed-companies";
export { getPool, closePool } from "./db";
export { createFileStore, createEnvFileStore, createS3FileStore, createAutoFileStore } from "./file-store";
export type { FileStore, EnvFileStoreOptions } from "./file-store";
export { runMigrations } from "./migrate";

export type JobState = "pending" | "parsing" | "extracting" | "translating" | "assembling" | "complete" | "failed";
export type OutputLanguage = "en" | "et" | "lv" | "lt";

export interface Job {
  id: string;
  state: JobState;
  originalFilename: string;
  outputLanguage: OutputLanguage;
  extractedText: string | null;
  extractedJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobInput = Pick<Job, "originalFilename"> & {
  outputLanguage?: OutputLanguage;
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

// Semi-structured extraction result from GPT-4o
export interface ExtractedMetric {
  label: string;
  value: number | null;
  unit?: string;
  period?: string;
}

export interface ExtractedNarrative {
  section: string;
  text: string;
}

export interface ExtractedSentiment {
  managementTone: string;
  outlook: string;
  riskFactors: string[];
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
}

export interface ExtractedData {
  metadata: {
    companyName: string;
    reportPeriod: string;
    sourceLanguage: string;
    outputLanguage?: OutputLanguage;
  };
  metrics: ExtractedMetric[];
  narratives: ExtractedNarrative[];
  sentiment: ExtractedSentiment;
  revenueBreakdown?: RevenueBreakdown;
  profitabilityTrends?: ProfitabilityTrends;
}

// ── Companies data layer ────────────────────────────────────────────────────

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
