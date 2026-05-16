/** Client-safe exports for the company analytics page (no Node/pg dependencies). */

export type { ExtractedData, ReportType } from "./contracts";

export {
  buildTrendChartFromSnapshot,
  hasProfitabilityTrendSeries,
  resolvePriorPreviewMetric,
} from "./preview-metrics";
export type { PreviewMetricKey } from "./preview-metrics";

export {
  formatReportPeriodLabel,
  pickHeadlineReports,
  pickTrendReports,
} from "./report-metrics";
