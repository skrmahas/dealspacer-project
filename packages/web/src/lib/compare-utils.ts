import {
  getCanonicalMetricLabel,
  getMetricValue,
  inferCanonicalMetricId,
  type CanonicalMetricId,
  type ExtractedData,
  type ExtractedMetric,
  type ProfitabilityTrends,
} from "@bei/shared";
import type { TrendSeries } from "@/components/charts/trend-line-chart";
import type { BreakdownSegment } from "@/components/charts/breakdown-bar-chart";

export const REPORT_TYPE_LABEL: Record<string, string> = {
  annual: "Annual",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  "semi-annual": "Semi",
  other: "Other",
};

const GUIDANCE_RANK: Record<string, number> = {
  raised: 3,
  maintained: 2,
  lowered: 1,
};

const PILLAR_WEIGHT = 2;
const DEFAULT_WEIGHT = 1;

export function labelKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function metricCanonicalId(metric: ExtractedMetric | null): CanonicalMetricId | null {
  if (!metric) return null;
  return metric.canonicalId ?? inferCanonicalMetricId(metric.originalLabel ?? metric.label);
}

function metricMapKey(metric: ExtractedMetric): string {
  const canonicalId = metricCanonicalId(metric);
  return canonicalId ? `canonical:${canonicalId}` : `label:${labelKey(metric.label)}`;
}

export function metricDisplayLabel(
  key: string,
  metric: ExtractedMetric | null | undefined,
): string {
  const canonicalId = metricCanonicalId(metric ?? null);
  if (canonicalId) return getCanonicalMetricLabel(canonicalId);
  if (key.startsWith("canonical:")) {
    return getCanonicalMetricLabel(key.replace("canonical:", "") as CanonicalMetricId);
  }
  return metric?.label || key.replace(/^label:/, "");
}

export function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

function matchesRevenue(label: string): boolean {
  const l = label.toLowerCase().trim();
  return (
    /^(total\s+)?(revenue|sales|turnover)$/.test(l) ||
    /\brevenue\b/.test(l) ||
    /\bsales\b/.test(l) ||
    /\bturnover\b/.test(l)
  );
}

function matchesFcf(label: string): boolean {
  const l = label.toLowerCase();
  return /\bfree cash flow\b/.test(l) || /\bfcf\b/.test(l);
}

export function isPillarMetric(label: string): boolean {
  const canonicalId = inferCanonicalMetricId(label);
  return canonicalId === "revenue" || canonicalId === "free_cash_flow" || matchesRevenue(label) || matchesFcf(label);
}

export function isHigherBetter(label: string, metric?: ExtractedMetric | null): boolean {
  const canonicalId = metricCanonicalId(metric ?? null) ?? inferCanonicalMetricId(label);
  if (canonicalId === "liabilities" || canonicalId === "capex") return false;
  if (canonicalId) return true;
  const key = labelKey(label);
  if (/\bcost\b/.test(key) || /\bexpense\b/.test(key) || /\bdebt\b/.test(key)) return false;
  return (
    isPillarMetric(label) ||
    key.includes("profit") ||
    key.includes("margin") ||
    key.includes("ebitda") ||
    key.includes("income") ||
    key.includes("eps")
  );
}

export function metricWeight(label: string): number {
  return isPillarMetric(label) ? PILLAR_WEIGHT : DEFAULT_WEIGHT;
}

function metricWeightFor(metric: ExtractedMetric): number {
  const canonicalId = metricCanonicalId(metric);
  return canonicalId === "revenue" || canonicalId === "free_cash_flow"
    ? PILLAR_WEIGHT
    : metricWeight(metric.originalLabel ?? metric.label);
}

export function buildMetricsMap(
  metricsA: ExtractedMetric[],
  metricsB: ExtractedMetric[],
): Map<string, { a: ExtractedMetric | null; b: ExtractedMetric | null }> {
  const map = new Map<string, { a: ExtractedMetric | null; b: ExtractedMetric | null }>();
  for (const m of metricsA) map.set(metricMapKey(m), { a: m, b: null });
  for (const m of metricsB) {
    const key = metricMapKey(m);
    if (map.has(key)) map.get(key)!.b = m;
    else map.set(key, { a: null, b: m });
  }
  return map;
}

export function sortMetricEntries(
  entries: [string, { a: ExtractedMetric | null; b: ExtractedMetric | null }][],
): typeof entries {
  const rank = (key: string, metric: ExtractedMetric | null, label: string) => {
    const canonicalId = metricCanonicalId(metric) ?? (key.startsWith("canonical:") ? key.replace("canonical:", "") : null);
    if (canonicalId === "revenue" || matchesRevenue(label)) return 0;
    if (canonicalId === "free_cash_flow" || matchesFcf(label)) return 1;
    if (canonicalId === "ebitda" || /\bebitda\b/i.test(label)) return 2;
    if (canonicalId === "net_profit" || /\bnet profit\b/i.test(label) || /\bnet income\b/i.test(label)) return 3;
    if (key.includes("margin")) return 4;
    return 10;
  };
  return [...entries].sort(([, a], [, b]) => {
    const metricA = a.a ?? a.b;
    const metricB = b.a ?? b.b;
    const labelA = metricDisplayLabel("", metricA);
    const labelB = metricDisplayLabel("", metricB);
    return rank(labelKey(labelA), metricA, labelA) - rank(labelKey(labelB), metricB, labelB);
  });
}

export interface WeightedComparison {
  scoreA: number;
  scoreB: number;
  totalWeight: number;
  pillarNotes: string[];
}

export function computeWeightedComparison(
  snapA: ExtractedData,
  snapB: ExtractedData,
  metricsMap: Map<string, { a: ExtractedMetric | null; b: ExtractedMetric | null }>,
  nameA: string,
  nameB: string,
): WeightedComparison {
  let scoreA = 0;
  let scoreB = 0;
  let totalWeight = 0;
  const pillarNotes: string[] = [];

  const dirA = snapA.sentiment?.guidanceDirection;
  const dirB = snapB.sentiment?.guidanceDirection;
  const rankA = dirA ? GUIDANCE_RANK[dirA] ?? 0 : 0;
  const rankB = dirB ? GUIDANCE_RANK[dirB] ?? 0 : 0;
  if (rankA || rankB) {
    totalWeight += PILLAR_WEIGHT;
    if (rankA > rankB) {
      scoreA += PILLAR_WEIGHT;
      pillarNotes.push(`Guidance favors ${nameA}`);
    } else if (rankB > rankA) {
      scoreB += PILLAR_WEIGHT;
      pillarNotes.push(`Guidance favors ${nameB}`);
    } else if (rankA && rankB) {
      scoreA += PILLAR_WEIGHT;
      scoreB += PILLAR_WEIGHT;
    }
  }

  for (const [, { a, b }] of metricsMap) {
    const valueA = a ? getMetricValue(a) : null;
    const valueB = b ? getMetricValue(b) : null;
    if (valueA == null || valueB == null) continue;
    const label = metricDisplayLabel("", a ?? b);
    const weight = a ? metricWeightFor(a) : b ? metricWeightFor(b) : DEFAULT_WEIGHT;
    totalWeight += weight;
    const higherBetter = isHigherBetter(label, a ?? b);
    if (higherBetter) {
      if (valueA > valueB) scoreA += weight;
      else if (valueB > valueA) scoreB += weight;
    } else if (valueA < valueB) scoreA += weight;
    else if (valueB < valueA) scoreB += weight;
  }

  return { scoreA, scoreB, totalWeight, pillarNotes };
}

export function formatDelta(
  valA: number,
  valB: number,
  higherBetter: boolean,
): { text: string; absText: string; favorable: boolean | null } {
  const abs = valB - valA;
  const pct = valA !== 0 ? (abs / Math.abs(valA)) * 100 : null;
  const absText =
    abs === 0
      ? "—"
      : `${abs > 0 ? "+" : ""}${fmtCurrency(abs).replace("€", "€")}`;
  const pctText = pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "";
  const text = pctText ? `${absText} · ${pctText}` : absText;
  let favorable: boolean | null = null;
  if (abs !== 0) {
    favorable = higherBetter ? abs > 0 : abs < 0;
  }
  return { text, absText, favorable };
}

const METRIC_COLORS = {
  revenue: "#3b82f6",
  ebitda: "#22c55e",
  netProfit: "#f59e0b",
  fcf: "#a855f7",
} as const;

const SIDE_B_COLORS = {
  revenue: "#38bdf8",
  ebitda: "#4ade80",
  netProfit: "#fbbf24",
  fcf: "#d8b4fe",
} as const;

function mergePeriods(a: string[], b: string[]): string[] {
  const out: string[] = [];
  for (const p of a) if (!out.includes(p)) out.push(p);
  for (const p of b) if (!out.includes(p)) out.push(p);
  return out;
}

function alignToPeriods(
  periods: string[],
  sourcePeriods: string[],
  values: (number | null)[] | undefined,
): (number | null)[] {
  if (!values) return periods.map(() => null);
  const map = new Map(sourcePeriods.map((p, i) => [p, values[i] ?? null]));
  return periods.map((p) => map.get(p) ?? null);
}

export function buildOverlayTrendSeries(
  snapA: ExtractedData,
  snapB: ExtractedData,
  nameA: string,
  nameB: string,
): { labels: string[]; series: TrendSeries[] } | null {
  const trendsA = snapA.profitabilityTrends;
  const trendsB = snapB.profitabilityTrends;
  if (!trendsA?.periods?.length && !trendsB?.periods?.length) return null;

  const labels = mergePeriods(trendsA?.periods ?? [], trendsB?.periods ?? []);
  if (labels.length < 2) return null;

  const shortA = nameA.split(/\s+/).slice(0, 1).join(" ") || "A";
  const shortB = nameB.split(/\s+/).slice(0, 1).join(" ") || "B";

  const defs: {
    key: keyof typeof METRIC_COLORS;
    field: keyof ProfitabilityTrends;
    label: string;
  }[] = [
    { key: "revenue", field: "revenue", label: "Revenue" },
    { key: "ebitda", field: "ebitda", label: "EBITDA" },
    { key: "netProfit", field: "netProfit", label: "Net profit" },
    { key: "fcf", field: "freeCashFlow", label: "FCF" },
  ];

  const series: TrendSeries[] = [];
  for (const { key, field, label } of defs) {
    const valuesA = trendsA?.[field] as (number | null)[] | undefined;
    const valuesB = trendsB?.[field] as (number | null)[] | undefined;
    const hasA = valuesA?.some((v) => v != null);
    const hasB = valuesB?.some((v) => v != null);
    if (!hasA && !hasB) continue;

    if (hasA) {
      series.push({
        key: `${key}-a`,
        label: `${shortA} · ${label}`,
        color: METRIC_COLORS[key],
        values: alignToPeriods(labels, trendsA?.periods ?? [], valuesA),
      });
    }
    if (hasB) {
      series.push({
        key: `${key}-b`,
        label: `${shortB} · ${label}`,
        color: SIDE_B_COLORS[key],
        values: alignToPeriods(labels, trendsB?.periods ?? [], valuesB),
      });
    }
  }

  if (series.length === 0) return null;
  return { labels, series };
}

export function pickBreakdownSegments(
  snap: ExtractedData,
): { segments: BreakdownSegment[]; kind: "segment" | "geography" } | null {
  const rb = snap.revenueBreakdown;
  if (!rb) return null;
  const bySegment = rb.bySegment?.filter((s) => Number.isFinite(s.value)) ?? [];
  if (bySegment.length > 0) {
    return {
      kind: "segment",
      segments: bySegment.map((s) => ({ label: s.name, value: s.value })),
    };
  }
  const byGeo = rb.byGeography?.filter((s) => Number.isFinite(s.value)) ?? [];
  if (byGeo.length > 0) {
    return {
      kind: "geography",
      segments: byGeo.map((s) => ({ label: s.name, value: s.value })),
    };
  }
  return null;
}

export function displayName(
  report: { extractedJsonSnapshot?: ExtractedData | null },
  fallback: string,
): string {
  return report.extractedJsonSnapshot?.metadata?.companyName?.trim() || fallback;
}
