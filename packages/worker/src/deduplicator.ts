/**
 * Post-extraction metric deduplication.
 * Merges metrics with identical or near-identical labels that GPT-4o
 * may have extracted multiple times from different parts of the document.
 */

import type { ExtractedMetric } from "@bei/shared";

/**
 * Normalize a metric label: collapse whitespace, remove embedded newlines,
 * trim, and normalize Baltic diacritics for fuzzy matching.
 * Returns the cleaned label.
 */
export function normalizeLabel(label: string): string {
  return normalizeDiacritics(label.replace(/\s+/g, " ").trim());
}

/**
 * Normalize Baltic and common European diacritics to their base Latin forms.
 * Maps characters with diacritics to their unaccented equivalents for
 * better fuzzy matching of labels across documents.
 */
export function normalizeDiacritics(text: string): string {
  const map: Record<string, string> = {
    // Latvian
    "\u0100": "A", "\u0101": "a", // Ā ā
    "\u010c": "C", "\u010d": "c", // Č č
    "\u0112": "E", "\u0113": "e", // Ē ē
    "\u0122": "G", "\u0123": "g", // Ģ ģ
    "\u012a": "I", "\u012b": "i", // Ī ī
    "\u0136": "K", "\u0137": "k", // Ķ ķ
    "\u013b": "L", "\u013c": "l", // Ļ ļ
    "\u0145": "N", "\u0146": "n", // Ņ ņ
    "\u0160": "S", "\u0161": "s", // Š š
    "\u016a": "U", "\u016b": "u", // Ū ū
    "\u017d": "Z", "\u017e": "z", // Ž ž
    // Lithuanian
    "\u0104": "A", "\u0105": "a", // Ą ą
    "\u0118": "E", "\u0119": "e", // Ę ę
    "\u0116": "E", "\u0117": "e", // Ė ė
    "\u012e": "I", "\u012f": "i", // Į į
    "\u0172": "U", "\u0173": "u", // Ų ų
    // Estonian
    "\u00d5": "O", "\u00f5": "o", // Õ õ
    "\u00c4": "A", "\u00e4": "a", // Ä ä
    "\u00d6": "O", "\u00f6": "o", // Ö ö
    "\u00dc": "U", "\u00fc": "u", // Ü ü
  };

  return text.replace(/[\u00c0-\u017f]/g, (char) => map[char] || char);
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
  // First pass: normalize all labels for comparison, but keep originals
  const normalized = metrics.map((m, i) => ({
    ...m,
    _normalizedLabel: normalizeLabel(m.label),
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

      const a = normalized[i]._normalizedLabel;
      const b = normalized[j]._normalizedLabel;

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

    const { _normalizedLabel, _originalIndex, ...metric } = best;
    result.push(metric);
  }

  return result;
}
