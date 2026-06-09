type CurrencySnapshot = {
  metrics?: CurrencyMetric[];
};

/** Normalize extracted metric values to whole EUR for display and comparison. */

type CurrencyMetric = {
  label?: string;
  value?: number | null;
  unit?: string;
  evidence?: {
    snippet?: string;
    rationale?: string;
  };
};

function unitMultiplier(unit?: string): number {
  const u = (unit ?? "").trim().toLowerCase();
  const compact = u.replace(/\s+/g, "");

  if (!u) return 1;
  if (/bn|billion|miljards?/.test(u)) return 1_000_000_000;
  if (
    /\beur\s*m\b|\beurm\b|million|mln|milj|\bmn\b/.test(compact) ||
    (/\bm\b/.test(compact) && /eur|€|usd|\$/.test(compact) && !/thousand|k\b/.test(compact))
  ) {
    return 1_000_000;
  }
  if (/thousand|tuhat|tūkst|tukst|tūkstoš|tukstos|tūkstan|tukstan|tis\.?\s*eur|tk\.?\s*eur|\bk\s*eur|eur\s*k\b/.test(u)) {
    return 1_000;
  }
  return 1;
}

function evidenceText(metric: CurrencyMetric): string {
  return [metric.evidence?.snippet, metric.evidence?.rationale]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function evidenceMultiplier(metric: CurrencyMetric): number {
  const text = evidenceText(metric);
  if (!text) return 1;
  if (/bn|billion|miljards?/.test(text)) return 1_000_000_000;
  if (/million|mln|milj|eur\s*m|€\s*m|\bm\s*eur\b|\bmn\b/.test(text)) return 1_000_000;
  if (/thousand|tuhat|tūkst|tukst|tūkstoš|tukstos|tūkstan|tukstan|eur\s*k|€\s*k|\bk\s*eur\b|thousands\s+of\s+euros?/.test(text)) return 1_000;
  return 1;
}

function plainEurUnit(unit?: string): boolean {
  const compact = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return !compact || /^eur$|^€$|^euro$/.test(compact);
}

function explicitMetricMultiplier(metric: CurrencyMetric): number {
  return Math.max(unitMultiplier(metric.unit), evidenceMultiplier(metric));
}

/** When a filing mixes units, infer scale from explicit thousand/million labels in the same snapshot. */
export function detectSnapshotCurrencyMultiplier(snapshot: CurrencySnapshot | null): number {
  if (!snapshot?.metrics?.length) return 1;
  const counts = new Map<number, number>();
  for (const metric of snapshot.metrics) {
    const mult = explicitMetricMultiplier(metric);
    if (mult > 1) counts.set(mult, (counts.get(mult) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 1;
}

export function isPerShareOrRatioMetric(label: string): boolean {
  const l = label.toLowerCase();
  return (
    /\beps\b/.test(l) ||
    /per share/.test(l) ||
    /\bemployees?\b/.test(l) ||
    /%/.test(l) ||
    /\bmargin\b/.test(l) ||
    /\bratio\b/.test(l) ||
    /\byield\b/.test(l)
  );
}

export function looksLikeAggregateCurrency(label?: string): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return /revenue|sales|turnover|müügitulu|muugitulu|pajamos|käive|kaive|ie[nņ][ēe]mumi|ebitda|profit|loss|pelnas|peļņa|pelna|kasum|cash flow|rahavoog|naudas plūsma|naudas plusma|pinigu srautas|assets|turtas|varad|aktīvi|aktivi|liabilit|isipareigojimai|kohust|saistības|saistibas|equity|kapitalas|omakapital|pašu kapitāls|pasu kapitals|debt|fcf|operating|veiklos|darbības|darbibas|tegevus/.test(
    l,
  );
}

/** Convert a metric value to whole EUR using its stated unit (and label heuristics). */
export function normalizeMetricToEur(value: number, unit?: string, label?: string): number {
  if (!Number.isFinite(value)) return value;
  if (label && isPerShareOrRatioMetric(label)) return value;

  return value * unitMultiplier(unit);
}

function inferCompactMillionScale(metric: CurrencyMetric, snapshot: CurrencySnapshot | null): number {
  if (!snapshot?.metrics?.length || metric.value == null) return 1;
  if (!looksLikeAggregateCurrency(metric.label)) return 1;

  const aggregateValues = snapshot.metrics
    .filter((m) => m.value != null && Number.isFinite(m.value) && looksLikeAggregateCurrency(m.label))
    .map((m) => Math.abs(m.value!));

  if (aggregateValues.length < 3) return 1;
  if (aggregateValues.some((value) => value >= 10_000)) return 1;

  const hasDecimalAggregate = aggregateValues.some((value) => !Number.isInteger(value));
  const hasExplicitMillionMetric = snapshot.metrics.some((m) => explicitMetricMultiplier(m) === 1_000_000);

  return hasDecimalAggregate || hasExplicitMillionMetric ? 1_000_000 : 1;
}

function inferFilingWideMultiplier(snapshot: CurrencySnapshot | null): number {
  if (!snapshot?.metrics?.length) return 1;
  const counts = new Map<number, number>();
  for (const metric of snapshot.metrics) {
    const mult = evidenceMultiplier(metric);
    if (mult > 1) counts.set(mult, (counts.get(mult) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 1;
}

export function normalizeMetricValueToEur(
  metric: CurrencyMetric,
  snapshot: CurrencySnapshot | null,
): number | null {
  if (metric.value == null || !Number.isFinite(metric.value)) return metric.value ?? null;
  if (metric.label && isPerShareOrRatioMetric(metric.label)) return metric.value;

  const normalized = normalizeMetricToEur(metric.value, metric.unit, metric.label);
  if (Math.abs(normalized) !== Math.abs(metric.value)) return normalized;
  if (!plainEurUnit(metric.unit) || !looksLikeAggregateCurrency(metric.label)) return normalized;
  if (Math.abs(metric.value) >= 1_000_000) return normalized;

  const ownEvidenceMultiplier = evidenceMultiplier(metric);
  if (ownEvidenceMultiplier > 1) return metric.value * ownEvidenceMultiplier;

  const filingWideMultiplier = inferFilingWideMultiplier(snapshot);
  if (filingWideMultiplier > 1) return metric.value * filingWideMultiplier;

  const compactMillionMultiplier = inferCompactMillionScale(metric, snapshot);
  if (compactMillionMultiplier > 1) return metric.value * compactMillionMultiplier;

  return normalized;
}

/** Apply filing-wide unit scale when a metric is plain EUR but siblings use thousand/million. */
export function applySnapshotCurrencyScale(
  value: number,
  unit: string | undefined,
  label: string,
  snapshot: CurrencySnapshot | null,
  normalized: number,
): number {
  const mult = inferFilingWideMultiplier(snapshot);
  if (mult <= 1) return normalized;
  const compact = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (compact && !/^eur$|^€$|^euro$/.test(compact)) return normalized;
  if (!looksLikeAggregateCurrency(label)) return normalized;
  if (Math.abs(normalized) !== Math.abs(value)) return normalized;
  if (Math.abs(value) >= 1_000_000) return normalized;
  return value * mult;
}
