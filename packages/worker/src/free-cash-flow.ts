import { inferCanonicalMetricId, type ExtractedMetric } from "@bei/shared";

const HIGH_CONFIDENCE_FCF_THRESHOLD = 0.7;

function canonicalId(metric: ExtractedMetric): string | null {
  return metric.canonicalId ?? inferCanonicalMetricId(metric.originalLabel ?? metric.label);
}

function periodKey(metric: ExtractedMetric): string {
  return metric.period?.trim() || "__report_period__";
}

function unitKey(metric: ExtractedMetric): string {
  return (metric.unit ?? "").trim().toLowerCase();
}

function isUsable(metric: ExtractedMetric): boolean {
  return metric.value !== null && Number.isFinite(metric.value);
}

/**
 * Derive Free Cash Flow = OCF - |CAPEX| for any (period, unit) pair where both are present.
 * Uses |CAPEX| so we handle either sign convention (CAPEX reported as positive outflow OR
 * as a negative number on the cash-flow statement).
 *
 * Existing FCF metrics for the same period are preserved when their confidence is high;
 * otherwise they are replaced with the computed value. This catches cases where the LLM
 * fabricated a low-confidence FCF from OCF alone (a chunk-boundary artifact).
 */
export function deriveFreeCashFlow(metrics: ExtractedMetric[]): ExtractedMetric[] {
  type ByPeriod = { ocf?: ExtractedMetric; capex?: ExtractedMetric; fcf?: ExtractedMetric };
  const buckets = new Map<string, ByPeriod>();

  for (const m of metrics) {
    const id = canonicalId(m);
    if (id !== "operating_cash_flow" && id !== "capex" && id !== "free_cash_flow") continue;
    const key = periodKey(m);
    const bucket = buckets.get(key) ?? {};
    if (id === "operating_cash_flow" && !bucket.ocf && isUsable(m)) bucket.ocf = m;
    else if (id === "capex" && !bucket.capex && isUsable(m)) bucket.capex = m;
    else if (id === "free_cash_flow" && !bucket.fcf) bucket.fcf = m;
    buckets.set(key, bucket);
  }

  const indicesToDrop = new Set<number>();
  const derived: ExtractedMetric[] = [];

  for (const [, { ocf, capex, fcf }] of buckets) {
    if (!ocf || !capex) continue;
    if (unitKey(ocf) !== unitKey(capex)) continue;

    const existingConfidence = fcf?.evidence?.confidence ?? 0;
    if (fcf && existingConfidence >= HIGH_CONFIDENCE_FCF_THRESHOLD) continue;

    const computedValue = (ocf.value as number) - Math.abs(capex.value as number);
    if (fcf) indicesToDrop.add(metrics.indexOf(fcf));

    derived.push({
      label: "Free cash flow",
      value: computedValue,
      unit: ocf.unit,
      period: ocf.period ?? capex.period,
      canonicalId: "free_cash_flow",
      evidence: {
        confidence: 0.95,
        rationale: `Computed deterministically as OCF (${ocf.value}) minus |CAPEX| (${Math.abs(capex.value as number)}).`,
        snippet: [ocf.evidence?.snippet, capex.evidence?.snippet].filter(Boolean).join(" | ").slice(0, 240),
      },
    });
  }

  if (derived.length === 0 && indicesToDrop.size === 0) return metrics;
  const kept = metrics.filter((_, i) => !indicesToDrop.has(i));
  return [...kept, ...derived];
}
