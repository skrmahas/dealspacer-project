import {
  formatHeadlineMetricIssue,
  inferCanonicalMetricId,
  validateHeadlineMetrics,
  type ExtractedData,
  type ExtractedMetric,
} from "@bei/shared";
import type { SanitizationWarnings } from "./sanitizer.js";

export interface QualityGateResult {
  passed: boolean;
  warnings: string[];
}

const CORE_METRIC_PATTERNS = [
  /revenue/i,
  /sales/i,
  /turnover/i,
  /ebitda/i,
  /net\s+(profit|income)/i,
  /profit\s+for\s+the\s+period/i,
  /\bfcf\b/i,
  /free\s+cash\s+flow/i,
  /operating\s+cash\s+flow/i,
  /cash\s+flow\s+from\s+operating/i,
  /\bcapex\b/i,
  /capital\s+expenditure/i,
];

function hasMeaningfulNarrative(data: ExtractedData): boolean {
  return data.narratives.some((narrative) => narrative.text.trim().length > 50);
}

function isNumericMetric(metric: ExtractedMetric): boolean {
  return metric.value !== null && Number.isFinite(metric.value);
}

function isCoreMetric(metric: ExtractedMetric): boolean {
  const canonicalId = metric.canonicalId ?? inferCanonicalMetricId(metric.originalLabel ?? metric.label);
  if (
    canonicalId === "revenue" ||
    canonicalId === "ebitda" ||
    canonicalId === "net_profit" ||
    canonicalId === "free_cash_flow" ||
    canonicalId === "operating_cash_flow" ||
    canonicalId === "capex"
  ) {
    return true;
  }
  return CORE_METRIC_PATTERNS.some((pattern) => pattern.test(metric.originalLabel ?? metric.label));
}

function hasLowConfidence(metric: ExtractedMetric): boolean {
  const confidence = metric.evidence?.confidence;
  return typeof confidence === "number" && Number.isFinite(confidence) && confidence < 0.6;
}

export function assessReportQuality(
  data: ExtractedData,
  sanitizationWarnings?: SanitizationWarnings,
): QualityGateResult {
  const warnings: string[] = [];
  const companyName = data.metadata.companyName.trim();
  const reportPeriod = data.metadata.reportPeriod.trim();
  const numericMetrics = data.metrics.filter(isNumericMetric);
  const nullMetrics = data.metrics.filter((metric) => metric.value === null);
  const numericCoreMetrics = numericMetrics.filter(isCoreMetric);
  const lowConfidenceCoreMetrics = numericCoreMetrics.filter(hasLowConfidence);

  if (!companyName) warnings.push("Missing company name in extracted metadata.");
  if (!reportPeriod) warnings.push("Missing report period in extracted metadata.");

  if (data.metrics.length === 0) {
    warnings.push("No metrics were extracted.");
  } else if (numericMetrics.length === 0) {
    warnings.push("No metrics with numeric values were extracted.");
  }

  if (data.metrics.length > 0 && nullMetrics.length / data.metrics.length >= 0.5) {
    warnings.push(
      `Extraction is dominated by null-valued metrics (${nullMetrics.length}/${data.metrics.length}).`,
    );
  }

  if (numericCoreMetrics.length === 0) {
    warnings.push("No core financial metric with a numeric value was extracted.");
  }

  const companyConfidence = data.metadata.evidence?.companyName?.confidence;
  if (typeof companyConfidence === "number" && Number.isFinite(companyConfidence) && companyConfidence < 0.6) {
    warnings.push(`Company name evidence confidence is low (${companyConfidence.toFixed(2)}).`);
  }

  const periodConfidence = data.metadata.evidence?.reportPeriod?.confidence;
  if (typeof periodConfidence === "number" && Number.isFinite(periodConfidence) && periodConfidence < 0.6) {
    warnings.push(`Report period evidence confidence is low (${periodConfidence.toFixed(2)}).`);
  }

  for (const metric of lowConfidenceCoreMetrics) {
    warnings.push(
      `Core metric "${metric.label}" evidence confidence is low (${metric.evidence!.confidence!.toFixed(2)}).`,
    );
  }

  for (const issue of validateHeadlineMetrics(data)) {
    warnings.push(formatHeadlineMetricIssue(issue));
  }

  if (!hasMeaningfulNarrative(data) && numericMetrics.length < 2) {
    warnings.push("Extraction has neither meaningful narrative text nor enough numeric metrics.");
  }

  if (sanitizationWarnings?.droppedNullMetrics && sanitizationWarnings.droppedNullMetrics >= 3) {
    warnings.push(
      `Sanitizer dropped ${sanitizationWarnings.droppedNullMetrics} null-valued metric(s).`,
    );
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}

export function buildQualityGateFailureMessage(warnings: string[]): string {
  return `Report quality gate failed: ${warnings.join(" ")}`;
}
