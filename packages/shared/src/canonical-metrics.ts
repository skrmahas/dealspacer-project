import type { CanonicalMetricId, ExtractedData, ExtractedMetric } from "./contracts";
import {
  isPerShareOrRatioMetric,
  looksLikeAggregateCurrency,
  normalizeMetricValueToEur,
} from "./metric-units";

type MetricSnapshot = Pick<ExtractedData, "metrics">;

const CANONICAL_LABELS: Record<CanonicalMetricId, string> = {
  revenue: "Revenue",
  ebitda: "EBITDA",
  net_profit: "Net profit",
  free_cash_flow: "Free cash flow",
  operating_cash_flow: "Operating cash flow",
  capex: "Capital expenditure",
  total_assets: "Total assets",
  equity: "Equity",
  liabilities: "Liabilities",
  eps: "EPS",
  dividends: "Dividends",
};

function compactLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(label: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(label));
}

export function inferCanonicalMetricId(label: string): CanonicalMetricId | null {
  const l = compactLabel(label);
  if (!l) return null;

  if (/\beps\b|\bearnings per share\b|\bprofit per share\b/.test(l)) return "eps";
  if (/\bdividends?\b|\bdividend per share\b/.test(l)) return "dividends";
  if (/\bcapex\b|\bcapital expenditures?\b|\bcapital investments?\b/.test(l)) return "capex";
  if (/\bfree cash flow\b|\bfcf\b|\blaisvasis pinigu srautas\b/.test(l)) return "free_cash_flow";
  if (
    /\boperating cash flow\b|\bcash flow from operating\b|\bnet cash from operating\b/.test(l)
  ) {
    return "operating_cash_flow";
  }
  if (/\bebitda\b/.test(l)) return "ebitda";
  if (
    hasAny(l, [
      /\bprofit for the period\b/,
      /\bnet profit\b/,
      /\bnet income\b/,
      /\bnet earnings\b/,
      /\bprofit attributable\b/,
      /\bgrynasis pelnas\b/,
      /\bneto pelna\b/,
      /\bpuhas kasum\b/,
      /\bpuhaskasum\b/,
    ]) &&
    !/\boperating\b|\bveiklos\b|\bdarbibas\b|\btegevus\b/.test(l)
  ) {
    return "net_profit";
  }
  if (/\btotal assets\b|\bassets total\b|\bassets\b|\bturtas\b/.test(l)) return "total_assets";
  if (/\btotal liabilities\b|\bliabilities\b|\bliability\b|\bdebt\b|\bisipareigojimai\b/.test(l)) {
    return "liabilities";
  }
  if (/\btotal equity\b|\bequity\b|\bshareholders equity\b|\bnuosavas kapitalas\b/.test(l)) {
    return "equity";
  }
  if (
    !/\binterest income\b|\bfee income\b|\bcommission\b|\bpalukan\b|\bkomisini/.test(l) &&
    hasAny(l, [
      /^(total )?revenue$/,
      /^net sales$/,
      /^sales$/,
      /^turnover$/,
      /^pajamos$/,
      /^kaive$/,
      /^ie[nn]emumi$/,
      /\brevenue\b/,
    ])
  ) {
    return "revenue";
  }

  return null;
}

export function getCanonicalMetricLabel(canonicalId: CanonicalMetricId): string {
  return CANONICAL_LABELS[canonicalId];
}

function normalizedUnitForMetric(metric: ExtractedMetric, canonicalId: CanonicalMetricId | null): string | undefined {
  if (metric.value == null) return undefined;
  const label = metric.originalLabel ?? metric.label;
  if (canonicalId === "eps" || isPerShareOrRatioMetric(label)) return metric.unit;
  if (canonicalId && looksLikeAggregateCurrency(label)) return "EUR";
  return metric.unit;
}

export function canonicalizeMetric(
  metric: ExtractedMetric,
  snapshot: MetricSnapshot | null,
): ExtractedMetric {
  const originalLabel = metric.originalLabel ?? metric.label;
  const originalUnit = metric.originalUnit ?? metric.unit;
  const canonicalId = metric.canonicalId ?? inferCanonicalMetricId(originalLabel) ?? undefined;
  const normalizedUnit = normalizedUnitForMetric(metric, canonicalId ?? null);
  const normalizedValue =
    metric.value == null
      ? metric.value
      : normalizeMetricValueToEur({ ...metric, label: originalLabel }, snapshot);

  return {
    ...metric,
    canonicalId,
    originalLabel,
    originalUnit,
    normalizedValue,
    normalizedUnit,
  };
}

export function canonicalizeExtractedData(data: ExtractedData): ExtractedData {
  const snapshot = { metrics: data.metrics };
  return {
    ...data,
    metrics: data.metrics.map((metric) => canonicalizeMetric(metric, snapshot)),
  };
}

export function getMetricValue(metric: ExtractedMetric): number | null {
  return metric.normalizedValue ?? metric.value;
}
