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
  formatHeadlineMetricIssue,
  validateHeadlineMetric,
  validateHeadlineMetrics,
} from "./headline-metric-validation";
export type { HeadlineMetricId, HeadlineMetricIssue } from "./headline-metric-validation";
export {
  assessReportSanity,
  formatReportSanityIssue,
} from "./report-sanity";
export type { HistoricalReportSnapshot, ReportSanityIssue } from "./report-sanity";
export {
  canonicalizeExtractedData,
  canonicalizeMetric,
  getCanonicalMetricLabel,
  getMetricValue,
  inferCanonicalMetricId,
} from "./canonical-metrics";
export {
  buildReportPreview,
  buildRevenueBreakdownSegments,
  resolvePreviewMetric,
  resolvePriorPreviewMetric,
  findMetricByKey,
  buildTrendChartFromSnapshot,
  hasProfitabilityTrendSeries,
} from "./preview-metrics";
export type { PreviewBreakdownSegment, PreviewMetricKey } from "./preview-metrics";
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
  CanonicalMetricId,
  ExtractedEvidence,
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
