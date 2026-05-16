export { createPostgresStore, createPostgresFileStore, createCompanyStore, createReportStore, seedCompanies, DuplicateReportError } from "./pg-store";
export { BALTIC_COMPANIES } from "./seed-companies";
export { getPool, closePool } from "./db";
export { createFileStore, createEnvFileStore, createS3FileStore, createAutoFileStore } from "./file-store";
export type { FileStore, EnvFileStoreOptions } from "./file-store";
export { runMigrations } from "./migrate";
export { assessPipelineHealth } from "./pipeline-health";
export type { PipelineHealthSnapshot } from "./pipeline-health";
export { normalizeMetricToEur, isPerShareOrRatioMetric } from "./metric-units";
export {
  buildReportPreview,
  resolvePreviewMetric,
  resolvePriorPreviewMetric,
  findMetricByKey,
  buildTrendChartFromSnapshot,
  hasProfitabilityTrendSeries,
} from "./preview-metrics";
export type { PreviewMetricKey } from "./preview-metrics";
export {
  pickHeadlineReports,
  pickTrendReports,
  formatReportPeriodLabel,
  compareReportRecency,
  reportRecencyScore,
} from "./report-metrics";

export type {
  JobState,
  OutputLanguage,
  Job,
  CreateJobInput,
  UpdateJobInput,
  JobStore,
  TranslationCacheEntry,
  ExtractedMetric,
  ExtractedNarrative,
  ExtractedSentiment,
  RevenueBreakdown,
  ProfitabilityTrends,
  ExtractedData,
  Company,
  CreateCompanyInput,
  CompanyStore,
  SeedCompany,
  ReportType,
  Report,
  ReportWithPreview,
  CreateReportInput,
  ReportStore,
} from "./contracts";
