import type { ExtractedMetric, ProfitabilityTrends } from "./contracts";
import { inferCanonicalMetricId } from "./canonical-metrics";
import {
  applySnapshotCurrencyScale,
  detectSnapshotCurrencyMultiplier,
  isPerShareOrRatioMetric,
  looksLikeAggregateCurrency,
  normalizeMetricToEur,
} from "./metric-units";

export type PreviewMetricKey = "revenue" | "ebitda" | "netProfit" | "fcf";
type PreviewCanonicalId = "revenue" | "ebitda" | "net_profit" | "free_cash_flow";

type TrendField = "revenue" | "ebitda" | "netProfit" | "freeCashFlow";

type PreviewSnapshot = {
  metrics?: ExtractedMetric[];
  profitabilityTrends?: ProfitabilityTrends;
  revenueBreakdown?: {
    bySegment?: { name: string; value: unknown }[];
    byGeography?: { name: string; value: unknown }[];
  };
};

export type PreviewBreakdownSegment = {
  label: string;
  value: number;
};

const TREND_FIELD: Record<PreviewMetricKey, TrendField> = {
  revenue: "revenue",
  ebitda: "ebitda",
  netProfit: "netProfit",
  fcf: "freeCashFlow",
};

const CANONICAL_KEY: Record<PreviewMetricKey, PreviewCanonicalId> = {
  revenue: "revenue",
  ebitda: "ebitda",
  netProfit: "net_profit",
  fcf: "free_cash_flow",
};

const PREVIEW_KEY_FOR_TREND_FIELD: Record<TrendField, PreviewMetricKey> = {
  revenue: "revenue",
  ebitda: "ebitda",
  netProfit: "netProfit",
  freeCashFlow: "fcf",
};

function isExcludedMetricLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    /\btarget\b/.test(l) ||
    /\bgoal\b/.test(l) ||
    /\bforecast\b/.test(l) ||
    /\bprojection\b/.test(l) ||
    /\bguidance\b/.test(l) ||
    /\bper share\b/.test(l) ||
    /\beps\b/.test(l) ||
    /\bvienai akcijai\b/.test(l) ||
    /\bdividend/.test(l)
  );
}

function matchesRevenue(label: string): boolean {
  const l = label.toLowerCase().trim();
  if (/palūkan|palukan|komisini|commission|interest income|fee income/.test(l)) return false;
  return (
    /^(total\s+)?(revenue|sales|turnover|pajamos|käive|kaive)$/.test(l) ||
    /^ie[nņ]ēmumi$/.test(l) ||
    /^ie[nņ]mumi$/.test(l) ||
    (/\brevenue\b/.test(l) && !/interest|commission/.test(l)) ||
    (/\bpajamos\b/.test(l) && !/palūkan|palukan|komisini/.test(l))
  );
}

function matchesEbitda(label: string): boolean {
  return /\bebitda\b/i.test(label);
}

function matchesNetProfit(label: string): boolean {
  const l = label.toLowerCase().trim();
  if (/operating|veiklos|darbības|tegevus/.test(l) && /profit|pelnas|peļņa|kasum/.test(l)) {
    return false;
  }
  return (
    /\bnet profit\b/.test(l) ||
    /\bnet income\b/.test(l) ||
    /\bnet earnings\b/.test(l) ||
    /\bgrynasis pelnas\b/.test(l) ||
    /\bneto peļņa\b/.test(l) ||
    /\bpuhas kasum\b/.test(l) ||
    /\bpuhaskasum\b/.test(l) ||
    /^grynasis pelnas/.test(l)
  );
}

function matchesFcf(label: string): boolean {
  const l = label.toLowerCase();
  return /\bfree cash flow\b/.test(l) || /\bfcf\b/.test(l) || /\blaisvasis pinigų srautas\b/.test(l);
}

function labelMatchesKey(label: string, key: PreviewMetricKey): boolean {
  if (inferCanonicalMetricId(label) === CANONICAL_KEY[key]) return true;
  switch (key) {
    case "revenue":
      return matchesRevenue(label);
    case "ebitda":
      return matchesEbitda(label);
    case "netProfit":
      return matchesNetProfit(label);
    case "fcf":
      return matchesFcf(label);
    default:
      return false;
  }
}

export function findMetricByKey(
  snapshot: PreviewSnapshot | null,
  key: PreviewMetricKey,
): ExtractedMetric | null {
  if (!snapshot?.metrics?.length) return null;
  const canonicalId = CANONICAL_KEY[key];
  const candidates = snapshot.metrics.filter(
    (m) => m.value != null && !isExcludedMetricLabel(m.label),
  );
  return (
    candidates.find((m) => m.canonicalId === canonicalId) ??
    candidates.find((m) => labelMatchesKey(m.originalLabel ?? m.label, key)) ??
    candidates.find((m) => labelMatchesKey(m.label, key)) ??
    null
  );
}

function isPlainEurUnit(unit: string | undefined): boolean {
  const compact = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return /^eur$|^€$|^euro$/.test(compact);
}

function findPlainEurRevenueMetric(snapshot: PreviewSnapshot | null): ExtractedMetric | null {
  return (
    snapshot?.metrics?.find(
      (metric) =>
        metric.value != null &&
        Number.isFinite(metric.value) &&
        isPlainEurUnit(metric.unit) &&
        labelMatchesKey(metric.originalLabel ?? metric.label, "revenue"),
    ) ?? null
  );
}

function isBalanceSheetLabel(label: string): boolean {
  return /\bassets?\b|\bequity\b|\bliabilit|\bdebt\b/i.test(label);
}

function plainEurSnapshotScale(snapshot: PreviewSnapshot | null): 1 | 1_000_000 | null {
  const revenue = findPlainEurRevenueMetric(snapshot);
  if (revenue?.value == null) return null;
  const absRevenue = Math.abs(revenue.value);
  if (absRevenue >= 1_000_000) return 1;

  if (absRevenue > 0 && absRevenue < 1_000) {
    const balanceSheetMetrics =
      snapshot?.metrics?.filter(
        (metric) =>
          metric.value != null &&
          Number.isFinite(metric.value) &&
          isPlainEurUnit(metric.unit) &&
          isBalanceSheetLabel(metric.originalLabel ?? metric.label),
      ) ?? [];
    if (
      balanceSheetMetrics.length >= 2 &&
      balanceSheetMetrics.every((metric) => Math.abs(metric.value ?? 0) < 10_000)
    ) {
      return 1_000_000;
    }
  }

  return null;
}

/** Baltic filings often store thousands as plain EUR (e.g. 45 786 = €45.8M). */
function ensureThousandsEurScale(value: number, unit: string | undefined, normalized: number): number {
  if (!isPlainEurUnit(unit)) return normalized;
  if (Math.abs(normalized) >= 1_000_000) return normalized;
  if (Math.abs(normalized) !== Math.abs(value)) return normalized;
  const abs = Math.abs(value);
  if (abs >= 1_000 && abs < 1_000_000) return value * 1_000;
  return normalized;
}

function normalizeExtractedValue(
  value: number,
  unit: string | undefined,
  label: string,
  snapshot: PreviewSnapshot | null,
): number {
  const snapshotMultiplier = detectSnapshotCurrencyMultiplier(snapshot);
  if (
    isPlainEurUnit(unit) &&
    snapshotMultiplier > 1 &&
    looksLikeAggregateCurrency(label) &&
    !isPerShareOrRatioMetric(label) &&
    Math.abs(value) < 10_000
  ) {
    return value * snapshotMultiplier;
  }

  const plainEurScale = isPlainEurUnit(unit) ? plainEurSnapshotScale(snapshot) : null;
  if (plainEurScale === 1) return value;
  if (
    plainEurScale === 1_000_000 &&
    looksLikeAggregateCurrency(label) &&
    !isPerShareOrRatioMetric(label) &&
    Math.abs(value) < 10_000
  ) {
    return value * 1_000_000;
  }

  const normalized = normalizeMetricToEur(value, unit, label);
  const scaled = applySnapshotCurrencyScale(value, unit, label, snapshot, normalized);
  return ensureThousandsEurScale(value, unit, scaled);
}

function inferTrendMultiplier(target: number | null, values: (number | null)[] | undefined): number | null {
  if (target == null || !Number.isFinite(target) || target === 0 || !values?.length) return null;
  const candidates = [1, 1_000, 1_000_000];
  let best: { multiplier: number; distance: number } | null = null;

  for (const raw of values) {
    if (raw == null || !Number.isFinite(raw) || raw === 0) continue;
    for (const multiplier of candidates) {
      const scaled = Math.abs(raw * multiplier);
      if (scaled === 0) continue;
      const distance = Math.abs(Math.log(scaled / Math.abs(target)));
      if (!best || distance < best.distance) {
        best = { multiplier, distance };
      }
    }
  }

  return best?.multiplier ?? null;
}

function inferTrendMultipliers(
  snapshot: PreviewSnapshot | null,
  trends: ProfitabilityTrends | undefined,
): { field: Partial<Record<TrendField, number>>; fallback: number | null } {
  const field: Partial<Record<TrendField, number>> = {};
  const inferred: number[] = [];

  for (const trendField of Object.values(TREND_FIELD)) {
    const key = PREVIEW_KEY_FOR_TREND_FIELD[trendField];
    const metric = findMetricByKey(snapshot, key);
    const target =
      metric?.value != null
        ? metric.normalizedValue ??
          normalizeExtractedValue(metric.value, metric.unit, metric.originalLabel ?? metric.label, snapshot)
        : null;
    const multiplier = inferTrendMultiplier(target, trends?.[trendField]);
    if (multiplier != null) {
      field[trendField] = multiplier;
      inferred.push(multiplier);
    }
  }

  const fallback =
    inferred.length > 0
      ? [...new Set(inferred)]
          .map((multiplier) => ({
            multiplier,
            count: inferred.filter((value) => value === multiplier).length,
          }))
          .sort((a, b) => b.count - a.count || b.multiplier - a.multiplier)[0]?.multiplier ?? null
      : null;

  return { field, fallback };
}

function hasLargeMixedTrendValues(values: (number | null)[] | undefined): boolean {
  const finite = (values ?? []).filter((value): value is number => value != null && Number.isFinite(value));
  return finite.some((value) => Math.abs(value) >= 100_000) && finite.some((value) => Math.abs(value) > 0 && Math.abs(value) < 1_000);
}

function normalizeTrendValue(
  value: number,
  snapshot: PreviewSnapshot | null,
  multiplier?: number | null,
  hasLargeMixedValues = false,
): number {
  if (multiplier != null) {
    if (multiplier === 1_000 && hasLargeMixedValues && Math.abs(value) > 0 && Math.abs(value) < 1_000) {
      return value * 1_000_000;
    }
    return value * multiplier;
  }
  const mult = detectSnapshotCurrencyMultiplier(snapshot);
  if (mult > 1 && Math.abs(value) < 1_000_000) {
    return value * mult;
  }
  return ensureThousandsEurScale(value, "EUR", normalizeMetricToEur(value, "EUR", "Revenue"));
}

function trendValueAt(
  snapshot: PreviewSnapshot | null,
  key: PreviewMetricKey,
  indexFromEnd: number,
): number | null {
  const trends = snapshot?.profitabilityTrends;
  const field = TREND_FIELD[key];
  const arr = trends?.[field];
  if (!arr?.length) return null;
  const multipliers = inferTrendMultipliers(snapshot, trends);
  const multiplier = multipliers.field[field] ?? multipliers.fallback;
  const idx = indexFromEnd < 0 ? arr.length + indexFromEnd : indexFromEnd;
  if (idx < 0 || idx >= arr.length) return null;
  const raw = arr[idx];
  if (raw == null || !Number.isFinite(raw)) return null;
  return normalizeTrendValue(raw, snapshot, multiplier, hasLargeMixedTrendValues(arr));
}

export function resolvePreviewMetric(
  snapshot: PreviewSnapshot | null,
  key: PreviewMetricKey,
): number | null {
  const m = findMetricByKey(snapshot, key);
  if (m?.value != null) {
    return m.normalizedValue ?? normalizeExtractedValue(m.value, m.unit, m.originalLabel ?? m.label, snapshot);
  }
  return trendValueAt(snapshot, key, -1);
}

export function resolvePriorPreviewMetric(
  snapshot: PreviewSnapshot | null,
  key: PreviewMetricKey,
): number | null {
  return trendValueAt(snapshot, key, -2);
}

export function buildReportPreview(snapshot: PreviewSnapshot | null): {
  previewRevenue: number | null;
  previewEbitda: number | null;
  previewNetProfit: number | null;
  previewFcf: number | null;
} {
  return {
    previewRevenue: resolvePreviewMetric(snapshot, "revenue"),
    previewEbitda: resolvePreviewMetric(snapshot, "ebitda"),
    previewNetProfit: resolvePreviewMetric(snapshot, "netProfit"),
    previewFcf: resolvePreviewMetric(snapshot, "fcf"),
  };
}

export function hasProfitabilityTrendSeries(snapshot: PreviewSnapshot | null): boolean {
  const trends = snapshot?.profitabilityTrends;
  return (trends?.periods?.length ?? 0) >= 2;
}

function periodSortKey(period: string): number {
  const trimmed = period.trim();
  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (!yearMatch) return Number.MAX_SAFE_INTEGER;

  const year = Number(yearMatch[1]);
  const quarterMatch =
    trimmed.match(/\bQ([1-4])\s*(\d{4})\b/i) ??
    trimmed.match(/\b(\d{4})(?:-\d{4})?\s*Q([1-4])\b/i);
  if (quarterMatch) {
    const quarter = quarterMatch[1].length === 1 ? Number(quarterMatch[1]) : Number(quarterMatch[2]);
    return year * 100 + quarter * 10;
  }

  const dateMatch = trimmed.match(/\b(\d{4})-(\d{2})(?:-\d{2})?\b/);
  if (dateMatch) {
    const month = Number(dateMatch[2]);
    const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
    return Number(dateMatch[1]) * 100 + quarter * 10;
  }

  if (/\b(H1|1H|6M|half[-\s]?year|semi[-\s]?annual)\b/i.test(trimmed)) return year * 100 + 25;
  if (/\b(H2|2H|II\s+poolaasta|second\s+half)\b/i.test(trimmed)) return year * 100 + 50;
  if (/\b(9M|nine\s+months|9\s+months)\b/i.test(trimmed)) return year * 100 + 35;

  return year * 100 + 99;
}

function sortedTrendIndexes(periods: string[]): number[] {
  return periods
    .map((period, index) => ({ index, key: periodSortKey(period) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((entry) => entry.index);
}

export function buildTrendChartFromSnapshot(snapshot: PreviewSnapshot | null): {
  labels: string[];
  revenue: (number | null)[];
  ebitda: (number | null)[];
  netProfit: (number | null)[];
  fcf: (number | null)[];
} | null {
  const trends = snapshot?.profitabilityTrends;
  if (!trends?.periods?.length) return null;
  const indexes = sortedTrendIndexes(trends.periods);
  const multipliers = inferTrendMultipliers(snapshot, trends);

  const mapSeries = (field: TrendField) => {
    const values = trends[field] ?? [];
    const multiplier = multipliers.field[field] ?? multipliers.fallback;
    const hasLargeMixedValues = hasLargeMixedTrendValues(values);
    return indexes.map((index) => {
      const v = values[index] ?? null;
      return v == null ? null : normalizeTrendValue(v, snapshot, multiplier, hasLargeMixedValues);
    });
  };

  return {
    labels: indexes.map((index) => trends.periods[index] ?? ""),
    revenue: mapSeries("revenue"),
    ebitda: mapSeries("ebitda"),
    netProfit: mapSeries("netProfit"),
    fcf: mapSeries("freeCashFlow"),
  };
}

function parseBreakdownValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("%")) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function usableBreakdownSegments(
  segments: { name: string; value: unknown }[] | undefined,
): PreviewBreakdownSegment[] {
  return (segments ?? [])
    .map((segment) => ({
      label: segment.name,
      value: parseBreakdownValue(segment.value),
    }))
    .filter(
      (segment): segment is PreviewBreakdownSegment =>
        Boolean(segment.label?.trim()) && segment.value != null && segment.value !== 0,
    );
}

function looksLikePercentageBreakdown(segments: PreviewBreakdownSegment[]): boolean {
  if (segments.length === 0) return false;
  const total = segments.reduce((sum, segment) => sum + Math.abs(segment.value), 0);
  return total >= 95 && total <= 105 && segments.every((segment) => Math.abs(segment.value) <= 100);
}

function scaleBreakdownSegments(
  segments: PreviewBreakdownSegment[],
  snapshot: PreviewSnapshot | null,
  headlineRevenue: number | null | undefined,
): PreviewBreakdownSegment[] {
  if (segments.length === 0 || looksLikePercentageBreakdown(segments)) return [];

  const total = segments.reduce((sum, segment) => sum + Math.abs(segment.value), 0);
  if (!Number.isFinite(total) || total === 0) return [];

  const revenue = headlineRevenue ?? resolvePreviewMetric(snapshot, "revenue");
  const absRevenue = revenue == null ? null : Math.abs(revenue);
  const candidates = [1, detectSnapshotCurrencyMultiplier(snapshot), 1_000, 1_000_000]
    .filter((candidate, index, all) => candidate > 0 && all.indexOf(candidate) === index)
    .sort((a, b) => a - b);

  const scale =
    absRevenue != null && absRevenue > 0
      ? candidates.reduce((best, candidate) => {
          const bestDistance = Math.abs(Math.log((total * best) / absRevenue));
          const candidateDistance = Math.abs(Math.log((total * candidate) / absRevenue));
          return candidateDistance < bestDistance ? candidate : best;
        }, candidates[0] ?? 1)
      : detectSnapshotCurrencyMultiplier(snapshot);

  if (absRevenue != null && absRevenue > 0) {
    const scaledRatio = (total * scale) / absRevenue;
    if (scaledRatio < 0.2 || scaledRatio > 5) return [];
  }

  return segments.map((segment) => ({
    ...segment,
    value: segment.value * scale,
  }));
}

export function buildRevenueBreakdownSegments(
  snapshot: PreviewSnapshot | null,
  headlineRevenue?: number | null,
): PreviewBreakdownSegment[] {
  const breakdown = snapshot?.revenueBreakdown;
  if (!breakdown) return [];

  const bySegment = usableBreakdownSegments(breakdown.bySegment);
  if (bySegment.length > 0) {
    return scaleBreakdownSegments(bySegment, snapshot, headlineRevenue);
  }

  const byGeography = usableBreakdownSegments(breakdown.byGeography);
  return scaleBreakdownSegments(byGeography, snapshot, headlineRevenue);
}
