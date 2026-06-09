import type { CanonicalMetricId, ExtractedData, ExtractedMetric } from "./contracts";
import { inferCanonicalMetricId } from "./canonical-metrics";

export type HeadlineMetricId = "revenue" | "ebitda" | "net_profit" | "free_cash_flow";

export interface HeadlineMetricIssue {
  metricId: HeadlineMetricId;
  label: string;
  reason: string;
}

const HEADLINE_METRIC_IDS = new Set<CanonicalMetricId>([
  "revenue",
  "ebitda",
  "net_profit",
  "free_cash_flow",
]);

function headlineMetricId(metric: ExtractedMetric): HeadlineMetricId | null {
  const canonicalId = metric.canonicalId ?? inferCanonicalMetricId(metric.originalLabel ?? metric.label);
  return canonicalId && HEADLINE_METRIC_IDS.has(canonicalId)
    ? canonicalId as HeadlineMetricId
    : null;
}

function firstYear(value: string | undefined): string | null {
  return value?.match(/\b(20\d{2}|19\d{2})\b/)?.[1] ?? null;
}

function hasClearUnit(metric: ExtractedMetric): boolean {
  return Boolean(metric.unit?.trim() || metric.normalizedUnit?.trim());
}

function hasEvidenceSnippet(metric: ExtractedMetric): boolean {
  return Boolean(metric.evidence?.snippet?.trim());
}

function hasLowConfidence(metric: ExtractedMetric): boolean {
  const confidence = metric.evidence?.confidence;
  return typeof confidence === "number" && Number.isFinite(confidence) && confidence < 0.6;
}

function hasPeriodContext(metric: ExtractedMetric, reportPeriod: string): boolean {
  return Boolean(metric.period?.trim() || reportPeriod.trim());
}

function hasPeriodMismatch(metric: ExtractedMetric, reportPeriod: string): boolean {
  const metricYear = firstYear(metric.period);
  const reportYear = firstYear(reportPeriod);
  return Boolean(metricYear && reportYear && metricYear !== reportYear);
}

function issue(metricId: HeadlineMetricId, metric: ExtractedMetric, reason: string): HeadlineMetricIssue {
  return { metricId, label: metric.label, reason };
}

export function validateHeadlineMetric(
  metric: ExtractedMetric,
  reportPeriod: string,
): HeadlineMetricIssue[] {
  const metricId = headlineMetricId(metric);
  if (!metricId || metric.value == null || !Number.isFinite(metric.value)) return [];

  const issues: HeadlineMetricIssue[] = [];
  if (!hasEvidenceSnippet(metric)) {
    issues.push(issue(metricId, metric, "missing source evidence snippet"));
  }
  if (!hasClearUnit(metric)) {
    issues.push(issue(metricId, metric, "missing unit"));
  }
  if (!hasPeriodContext(metric, reportPeriod)) {
    issues.push(issue(metricId, metric, "missing period context"));
  }
  if (hasPeriodMismatch(metric, reportPeriod)) {
    issues.push(issue(metricId, metric, `period "${metric.period}" does not match report period "${reportPeriod}"`));
  }
  if (hasLowConfidence(metric)) {
    issues.push(issue(metricId, metric, `evidence confidence is low (${metric.evidence!.confidence!.toFixed(2)})`));
  }

  return issues;
}

export function validateHeadlineMetrics(data: Pick<ExtractedData, "metadata" | "metrics">): HeadlineMetricIssue[] {
  const reportPeriod = data.metadata.reportPeriod ?? "";
  return data.metrics.flatMap((metric) => validateHeadlineMetric(metric, reportPeriod));
}

export function formatHeadlineMetricIssue(issue: HeadlineMetricIssue): string {
  return `Headline metric "${issue.label}" is invalid: ${issue.reason}.`;
}
