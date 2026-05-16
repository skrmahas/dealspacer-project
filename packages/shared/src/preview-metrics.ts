import type { ExtractedMetric, ProfitabilityTrends } from "./contracts";
import {
  applySnapshotCurrencyScale,
  detectSnapshotCurrencyMultiplier,
  normalizeMetricToEur,
} from "./metric-units";

export type PreviewMetricKey = "revenue" | "ebitda" | "netProfit" | "fcf";

type TrendField = "revenue" | "ebitda" | "netProfit" | "freeCashFlow";

type PreviewSnapshot = {
  metrics?: ExtractedMetric[];
  profitabilityTrends?: ProfitabilityTrends;
};

const TREND_FIELD: Record<PreviewMetricKey, TrendField> = {
  revenue: "revenue",
  ebitda: "ebitda",
  netProfit: "netProfit",
  fcf: "freeCashFlow",
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
  const candidates = snapshot.metrics.filter(
    (m) => m.value != null && !isExcludedMetricLabel(m.label),
  );
  return candidates.find((m) => labelMatchesKey(m.label, key)) ?? null;
}

/** Baltic filings often store thousands as plain EUR (e.g. 45 786 = €45.8M). */
function ensureThousandsEurScale(value: number, unit: string | undefined, normalized: number): number {
  const compact = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!/^eur$|^€$|^euro$/.test(compact)) return normalized;
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
  const normalized = normalizeMetricToEur(value, unit, label);
  const scaled = applySnapshotCurrencyScale(value, unit, label, snapshot, normalized);
  return ensureThousandsEurScale(value, unit, scaled);
}

function normalizeTrendValue(value: number, snapshot: PreviewSnapshot | null): number {
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
  const idx = indexFromEnd < 0 ? arr.length + indexFromEnd : indexFromEnd;
  if (idx < 0 || idx >= arr.length) return null;
  const raw = arr[idx];
  if (raw == null || !Number.isFinite(raw)) return null;
  return normalizeTrendValue(raw, snapshot);
}

export function resolvePreviewMetric(
  snapshot: PreviewSnapshot | null,
  key: PreviewMetricKey,
): number | null {
  const m = findMetricByKey(snapshot, key);
  if (m?.value != null) {
    return normalizeExtractedValue(m.value, m.unit, m.label, snapshot);
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

export function buildTrendChartFromSnapshot(snapshot: PreviewSnapshot | null): {
  labels: string[];
  revenue: (number | null)[];
  ebitda: (number | null)[];
  netProfit: (number | null)[];
  fcf: (number | null)[];
} | null {
  const trends = snapshot?.profitabilityTrends;
  if (!trends?.periods?.length) return null;

  const mapSeries = (field: TrendField) =>
    (trends[field] ?? trends.periods.map(() => null)).map((v) =>
      v == null ? null : normalizeTrendValue(v, snapshot),
    );

  return {
    labels: trends.periods,
    revenue: mapSeries("revenue"),
    ebitda: mapSeries("ebitda"),
    netProfit: mapSeries("netProfit"),
    fcf: mapSeries("freeCashFlow"),
  };
}
