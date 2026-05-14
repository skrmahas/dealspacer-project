export { createPostgresStore } from "./pg-store.js";
export { getPool, closePool } from "./db.js";

export type JobState = "pending" | "parsing" | "extracting" | "assembling" | "complete" | "failed";

export interface Job {
  id: string;
  state: JobState;
  originalFilename: string;
  extractedText: string | null;
  extractedJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobInput = Pick<Job, "originalFilename">;
export type UpdateJobInput = {
  state?: JobState;
  extractedText?: string;
  extractedJson?: string;
  error?: string;
};

export interface JobStore {
  createJob(input: CreateJobInput): Promise<Job>;
  getJob(id: string): Promise<Job | null>;
  updateJob(id: string, input: UpdateJobInput): Promise<Job>;
  pollNextPending(): Promise<Job | null>;
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
  };
  metrics: ExtractedMetric[];
  narratives: ExtractedNarrative[];
  sentiment: ExtractedSentiment;
  revenueBreakdown?: RevenueBreakdown;
  profitabilityTrends?: ProfitabilityTrends;
}
