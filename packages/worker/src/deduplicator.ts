/**
 * Post-extraction metric deduplication.
 * Merges metrics with identical or near-identical labels that GPT-4o
 * may have extracted multiple times from different parts of the document.
 */

import type { ExtractedMetric } from "@bei/shared";

/**
 * Normalize a metric label: collapse whitespace, remove embedded newlines,
 * trim. Returns the cleaned label.
 */
export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

/**
 * Levenshtein distance between two strings.
 * Standard dynamic programming implementation.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Fast paths
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimization for memory efficiency
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n];
}

/**
 * Jaccard similarity between two strings based on word-level token sets.
 * Returns a value between 0 (no overlap) and 1 (identical word sets).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

/**
 * Normalize all metric labels and deduplicate near-duplicates.
 *
 * Two metrics are considered duplicates if:
 * - Their normalized Levenshtein distance is ≤3, OR
 * - Their Jaccard word similarity is ≥0.85
 *
 * When merging:
 * - Prefer values with a period annotation (e.g., "2025") over naked values
 * - If still ambiguous, keep the first occurrence
 *
 * Returns the deduplicated array.
 */
export function deduplicateMetrics(metrics: ExtractedMetric[]): ExtractedMetric[] {
  // First pass: normalize all labels
  const normalized = metrics.map((m, i) => ({
    ...m,
    label: normalizeLabel(m.label),
    _originalIndex: i,
  }));

  const merged: boolean[] = new Array(normalized.length).fill(false);
  const result: ExtractedMetric[] = [];

  for (let i = 0; i < normalized.length; i++) {
    if (merged[i]) continue;

    let best = normalized[i];
    let foundDuplicate = false;

    for (let j = i + 1; j < normalized.length; j++) {
      if (merged[j]) continue;

      const a = normalized[i].label;
      const b = normalized[j].label;

      const dist = levenshtein(a, b);
      const jaccard = jaccardSimilarity(a, b);

      const isNearDuplicate = dist <= 3 || jaccard >= 0.85;

      if (isNearDuplicate) {
        foundDuplicate = true;
        merged[j] = true;

        // Prefer value with period annotation
        const bestHasPeriod = !!best.period;
        const otherHasPeriod = !!normalized[j].period;

        if (!bestHasPeriod && otherHasPeriod) {
          best = normalized[j];
        } else if (bestHasPeriod && otherHasPeriod) {
          // Both have periods — keep first occurrence (or later if it has a longer period)
          if (normalized[j].period!.length > best.period!.length) {
            best = normalized[j];
          }
        }
        // If neither has period or both ambiguous, keep first (best stays)
      }
    }

    if (foundDuplicate && best._originalIndex !== i) {
      // We're promoting a later occurrence; mark the original as merged too
      // Actually, since we use i as anchor, just push best
    }

    result.push({
      label: best.label,
      value: best.value,
      unit: best.unit,
      period: best.period,
    });
  }

  return result;
}
