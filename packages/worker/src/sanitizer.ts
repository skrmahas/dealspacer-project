import type {
  ExtractedData,
  ExtractedMetric,
  ProfitabilityTrends,
  RevenueBreakdown,
} from "@bei/shared";

export interface SanitizationWarnings {
  duplicateLabels: string[];
  droppedNullMetrics: number;
  revenueBreakdownDropped: boolean;
  duplicateRevenueBreakdownEntries: number;
  profitabilityTrendsDropped: boolean;
  trendSeriesRepaired: number;
  duplicateTrendPeriods: number;
  droppedEmptyTrendSeries: string[];
  chartWarnings: string[];
  implausibleYoYCount: number;
}

/**
 * Post-extraction sanitization pass.
 * Validates structural coherence and cleans up problematic data before
 * the translation/assembly pipeline. Returns the cleaned data and any warnings.
 */
export function sanitizeExtractedData(
  data: ExtractedData,
): { data: ExtractedData; warnings: SanitizationWarnings } {
  const warnings: SanitizationWarnings = {
    duplicateLabels: [],
    droppedNullMetrics: 0,
    revenueBreakdownDropped: false,
    duplicateRevenueBreakdownEntries: 0,
    profitabilityTrendsDropped: false,
    trendSeriesRepaired: 0,
    duplicateTrendPeriods: 0,
    droppedEmptyTrendSeries: [],
    chartWarnings: [],
    implausibleYoYCount: 0,
  };

  let cleaned = { ...data, metrics: [...data.metrics] };
  delete cleaned.chartWarnings;

  // 1. Safety-net duplicate label check (dedup in #28 should catch these,
  //    but guard against edge cases)
  cleaned.metrics = deduplicateLabels(cleaned.metrics, warnings);

  // 2. Drop metrics with null value AND no unit (displayed as "—" otherwise)
  const before = cleaned.metrics.length;
  cleaned.metrics = cleaned.metrics.filter(
    (m) => m.value !== null || (m.unit && m.unit.length > 0),
  );
  warnings.droppedNullMetrics = before - cleaned.metrics.length;
  if (warnings.droppedNullMetrics > 0) {
    console.warn(
      `[sanity] Dropped ${warnings.droppedNullMetrics} metric(s) with null value and no unit`,
    );
  }

  // 3. Revenue breakdown: merge duplicate labels, then drop if not chartable.
  if (cleaned.revenueBreakdown) {
    cleaned.revenueBreakdown = repairRevenueBreakdown(cleaned.revenueBreakdown, warnings);
    if (
      (!cleaned.revenueBreakdown.bySegment ||
        cleaned.revenueBreakdown.bySegment.length < 2) &&
      (!cleaned.revenueBreakdown.byGeography ||
        cleaned.revenueBreakdown.byGeography.length < 2)
    ) {
      console.warn(
        "[sanity] Dropping revenue breakdown: fewer than 2 segments in both segment and geography breakdowns",
      );
      warnings.chartWarnings.push(
        "Revenue breakdown was dropped because it has fewer than two segment/geography entries.",
      );
      delete cleaned.revenueBreakdown;
      warnings.revenueBreakdownDropped = true;
    }
  }

  // 4. Profitability trends: repair series and duplicate periods, then drop if not chartable.
  if (cleaned.profitabilityTrends) {
    cleaned.profitabilityTrends = repairProfitabilityTrends(cleaned.profitabilityTrends, warnings);
    const trendSeries = getTrendSeries(cleaned.profitabilityTrends);
    const hasChartableSeries = trendSeries.some(([, series]) => series.some((value) => value != null));
    if (cleaned.profitabilityTrends.periods.length < 2 || !hasChartableSeries) {
      const reason = cleaned.profitabilityTrends.periods.length < 2
        ? `only ${cleaned.profitabilityTrends.periods.length} period(s)`
        : "all trend series are empty";
      console.warn(`[sanity] Dropping profitability trends: ${reason}`);
      warnings.chartWarnings.push(`Profitability trends were dropped because ${reason}.`);
      delete cleaned.profitabilityTrends;
      warnings.profitabilityTrendsDropped = true;
    }
  }

  // 5. Detect implausible YoY deltas (> ±500%)
  //    The YoY is computed later in chart-renderer; we add a metadata note
  //    rather than modifying data here. The actual clamping happens in the
  //    computeYoYChange function itself (added below).
  //    We detect the condition by checking profitability trends for extreme swings.
  if (cleaned.profitabilityTrends) {
    const trends = cleaned.profitabilityTrends;
    const allSeries = [trends.revenue, trends.ebitda, trends.netProfit].filter(
      (s): s is (number | null)[] => s != null,
    );
    for (const series of allSeries) {
      for (let i = 1; i < series.length; i++) {
        if (series[i] != null && series[i - 1] != null && series[i - 1] !== 0) {
          const pctChange = ((series[i]! - series[i - 1]!) / Math.abs(series[i - 1]!)) * 100;
          if (Math.abs(pctChange) > 500) {
            console.warn(
              `[sanity] Implausible YoY change: ${pctChange.toFixed(0)}% at index ${i}`,
            );
            warnings.implausibleYoYCount++;
          }
        }
      }
    }
  }

  return { data: cleaned, warnings };
}

/**
 * Deduplicate metric labels (exact match, case-insensitive).
 * Keeps the first occurrence and logs warnings for duplicates.
 * This is a safety net — proper dedup should happen via the deduplicator (#28).
 */
function deduplicateLabels(
  metrics: ExtractedMetric[],
  warnings: SanitizationWarnings,
): ExtractedMetric[] {
  const seen = new Set<string>();
  const result: ExtractedMetric[] = [];

  for (const m of metrics) {
    const normalized = m.label.toLowerCase().trim();
    if (seen.has(normalized)) {
      warnings.duplicateLabels.push(m.label);
      console.warn(`[sanity] Duplicate metric label (keeping first): "${m.label}"`);
      continue;
    }
    seen.add(normalized);
    result.push(m);
  }

  return result;
}

type BreakdownEntry = { name: string; value: number };
type TrendField = Exclude<keyof ProfitabilityTrends, "periods">;

const TREND_FIELDS: TrendField[] = ["revenue", "ebitda", "netProfit", "freeCashFlow"];

function normalizeChartLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function repairBreakdownEntries(
  entries: BreakdownEntry[] | undefined,
  warnings: SanitizationWarnings,
): BreakdownEntry[] | undefined {
  if (!entries?.length) return undefined;

  const merged = new Map<string, BreakdownEntry>();
  for (const entry of entries) {
    const name = entry.name?.trim();
    if (!name || !Number.isFinite(entry.value)) continue;
    const key = normalizeChartLabel(name);
    const existing = merged.get(key);
    if (existing) {
      existing.value += entry.value;
      warnings.duplicateRevenueBreakdownEntries++;
      console.warn(`[sanity] Merged duplicate revenue breakdown entry: "${entry.name}"`);
      warnings.chartWarnings.push(`Merged duplicate revenue breakdown entry "${entry.name}".`);
    } else {
      merged.set(key, { name, value: entry.value });
    }
  }

  const result = Array.from(merged.values());
  return result.length > 0 ? result : undefined;
}

function repairRevenueBreakdown(
  breakdown: RevenueBreakdown,
  warnings: SanitizationWarnings,
): RevenueBreakdown {
  const repaired: RevenueBreakdown = {};
  const bySegment = repairBreakdownEntries(breakdown.bySegment, warnings);
  const byGeography = repairBreakdownEntries(breakdown.byGeography, warnings);
  if (bySegment) repaired.bySegment = bySegment;
  if (byGeography) repaired.byGeography = byGeography;
  return repaired;
}

function getTrendSeries(trends: ProfitabilityTrends): [TrendField, (number | null)[]][] {
  return TREND_FIELDS
    .map((field): [TrendField, (number | null)[] | undefined] => [field, trends[field]])
    .filter((entry): entry is [TrendField, (number | null)[]] => Array.isArray(entry[1]));
}

function repairSeriesLength(
  series: (number | null)[],
  targetLength: number,
  warnings: SanitizationWarnings,
): (number | null)[] {
  if (series.length === targetLength) return series;
  warnings.trendSeriesRepaired++;
  warnings.chartWarnings.push("Repaired profitability trend series length mismatch.");
  if (series.length > targetLength) return series.slice(0, targetLength);
  return [...series, ...Array.from({ length: targetLength - series.length }, () => null)];
}

function mergeDuplicateTrendPeriods(
  trends: ProfitabilityTrends,
  warnings: SanitizationWarnings,
): ProfitabilityTrends {
  const periodIndex = new Map<string, number>();
  const periods: string[] = [];
  const merged: Record<TrendField, (number | null)[]> = {
    revenue: [],
    ebitda: [],
    netProfit: [],
    freeCashFlow: [],
  };

  for (let i = 0; i < trends.periods.length; i++) {
    const period = trends.periods[i]?.trim();
    if (!period) continue;
    let targetIndex = periodIndex.get(period);
    if (targetIndex == null) {
      targetIndex = periods.length;
      periodIndex.set(period, targetIndex);
      periods.push(period);
      for (const field of TREND_FIELDS) {
        merged[field][targetIndex] = null;
      }
    } else {
      warnings.duplicateTrendPeriods++;
      console.warn(`[sanity] Merged duplicate profitability trend period: "${period}"`);
      warnings.chartWarnings.push(`Merged duplicate profitability trend period "${period}".`);
    }

    for (const field of TREND_FIELDS) {
      const value = trends[field]?.[i] ?? null;
      if (merged[field][targetIndex] == null && value != null) {
        merged[field][targetIndex] = value;
      }
    }
  }

  const repaired: ProfitabilityTrends = { periods };
  for (const field of TREND_FIELDS) {
    if (trends[field]) repaired[field] = merged[field];
  }
  return repaired;
}

function repairProfitabilityTrends(
  trends: ProfitabilityTrends,
  warnings: SanitizationWarnings,
): ProfitabilityTrends {
  const periods = (trends.periods ?? []).map((period) => period?.trim()).filter(Boolean);
  let repaired: ProfitabilityTrends = { ...trends, periods };

  for (const field of TREND_FIELDS) {
    if (!repaired[field]) continue;
    repaired[field] = repairSeriesLength(repaired[field]!, periods.length, warnings);
  }

  repaired = mergeDuplicateTrendPeriods(repaired, warnings);

  for (const field of TREND_FIELDS) {
    const series = repaired[field];
    if (!series) continue;
    if (series.every((value) => value == null)) {
      delete repaired[field];
      warnings.droppedEmptyTrendSeries.push(field);
      console.warn(`[sanity] Dropped empty profitability trend series: ${field}`);
      warnings.chartWarnings.push(`Dropped empty profitability trend series "${field}".`);
    }
  }

  return repaired;
}
