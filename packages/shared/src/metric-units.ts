type CurrencySnapshot = {
  metrics?: { unit?: string }[];
};

/** Normalize extracted metric values to whole EUR for display and comparison. */

/** When a filing mixes units, infer scale from explicit thousand/million labels in the same snapshot. */
export function detectSnapshotCurrencyMultiplier(snapshot: CurrencySnapshot | null): number {
  if (!snapshot?.metrics?.length) return 1;
  const units = snapshot.metrics.map((m) => (m.unit ?? "").toLowerCase());
  if (units.some((u) => /thousand/.test(u))) return 1_000;
  const compact = units.map((u) => u.replace(/\s+/g, ""));
  if (compact.some((u) => /eurm|eur\s*m|million|mln|\bmn\b/.test(u))) return 1_000_000;
  return 1;
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
  return /revenue|sales|turnover|ebitda|profit|loss|cash flow|assets|liabilit|equity|debt|fcf|operating/.test(
    l,
  );
}

function applyMislabeledThousandsHeuristic(value: number, label?: string): number {
  if (label && isPerShareOrRatioMetric(label)) return value;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return value;
  if (abs >= 1_000 && abs < 1_000_000 && looksLikeAggregateCurrency(label)) {
    return value * 1_000;
  }
  return value;
}

/** Convert a metric value to whole EUR using its stated unit (and label heuristics). */
export function normalizeMetricToEur(value: number, unit?: string, label?: string): number {
  if (!Number.isFinite(value)) return value;
  if (label && isPerShareOrRatioMetric(label)) return value;

  const u = (unit ?? "").trim().toLowerCase();
  const compact = u.replace(/\s+/g, "");

  if (!u) {
    return applyMislabeledThousandsHeuristic(value, label);
  }

  if (/bn|billion/.test(u)) return value * 1_000_000_000;
  if (
    /\beur\s*m\b|\beurm\b|million|mln|\bmn\b/.test(compact) ||
    (/\bm\b/.test(compact) && /eur|€|usd|\$/.test(compact) && !/thousand|k\b/.test(compact))
  ) {
    return value * 1_000_000;
  }
  if (/thousand|tis\.?\s*eur|tk\.?\s*eur|\bk\s*eur|eur\s*k\b/.test(u)) {
    return value * 1_000;
  }

  if (/^eur$|^€$|^euro$/.test(compact)) {
    return applyMislabeledThousandsHeuristic(value, label);
  }

  return value;
}

/** Apply filing-wide unit scale when a metric is plain EUR but siblings use thousand/million. */
export function applySnapshotCurrencyScale(
  value: number,
  unit: string | undefined,
  label: string,
  snapshot: CurrencySnapshot | null,
  normalized: number,
): number {
  const mult = detectSnapshotCurrencyMultiplier(snapshot);
  if (mult <= 1) return normalized;
  const compact = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!/^eur$|^€$|^euro$/.test(compact)) return normalized;
  if (!looksLikeAggregateCurrency(label)) return normalized;
  if (Math.abs(normalized) !== Math.abs(value)) return normalized;
  if (Math.abs(value) >= 1_000_000) return normalized;
  return value * mult;
}
