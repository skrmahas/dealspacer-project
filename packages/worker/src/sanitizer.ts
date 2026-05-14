import type { ExtractedData, ExtractedMetric } from "@bei/shared";

export interface SanitizationWarnings {
  duplicateLabels: string[];
  droppedNullMetrics: number;
  revenueBreakdownDropped: boolean;
  profitabilityTrendsDropped: boolean;
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
    profitabilityTrendsDropped: false,
    implausibleYoYCount: 0,
  };

  let cleaned = { ...data, metrics: [...data.metrics] };

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

  // 3. Revenue breakdown: drop if <2 segments
  if (
    cleaned.revenueBreakdown &&
    (!cleaned.revenueBreakdown.bySegment ||
      cleaned.revenueBreakdown.bySegment.length < 2) &&
    (!cleaned.revenueBreakdown.byGeography ||
      cleaned.revenueBreakdown.byGeography.length < 2)
  ) {
    console.warn(
      "[sanity] Dropping revenue breakdown: fewer than 2 segments in both segment and geography breakdowns",
    );
    delete cleaned.revenueBreakdown;
    warnings.revenueBreakdownDropped = true;
  }

  // 4. Profitability trends: drop if <2 periods
  if (cleaned.profitabilityTrends && cleaned.profitabilityTrends.periods.length < 2) {
    console.warn(
      `[sanity] Dropping profitability trends: only ${cleaned.profitabilityTrends.periods.length} period(s)`,
    );
    delete cleaned.profitabilityTrends;
    warnings.profitabilityTrendsDropped = true;
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
