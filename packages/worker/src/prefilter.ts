/**
 * Pre-extraction text prefilter: removes boilerplate before GPT-4o extraction.
 * Reduces token usage and improves extraction quality by focusing on
 * financial-relevant content.
 */

const BOILERPLATE_PATTERNS = [
  // Table of contents
  /^\s*(Table of )?Contents?\s*$/i,
  /^\s*\d+[\.\)]?\s+.+?[\.\s]{3,}\s*\d+\s*$/,  // "1. Introduction ....... 3"
  // Audit / legal boilerplate
  /^\s*Independent Auditor'?s?\s*Report\s*$/i,
  /^\s*We have audited the/i,
  /^\s*in our opinion[,.]?\s*$/i,
  /^\s*Basis for (audit )?opinion\s*$/i,
  /^\s*Key Audit Matters\s*$/i,
  /^\s*Responsibilities of (the )?(Board|Management|Auditor)/i,
  /^\s*Going concern\s*$/i,
  /^\s*Material(ity)? (and|&) (uncertainty|risk)/i,
  // Accounting policy boilerplate — expanded
  /^\s*(Summary of )?(Significant )?Accounting Policies?\s*$/i,
  /^\s*(Principles? of )?(Consolidation|Basis of (Preparation|Accounting))\s*$/i,
  /^\s*(Property|Plant|Equipment|Intangible|Goodwill|Inventory|Revenue|Leases?|Tax|Pension|Share.based|Financial\s+(instruments|assets|liabilities)|Employee\s+benefits|Provisions?|Contingent|Foreign\s+currency|Segment|Cash\s+flow|Earnings\s+per)\s+(and|&)\s+(Equipment|Recognition|Measurement|Policy|presentation)/i,
  /^\s*The (financial|consolidated|Group) statements (have been|are) prepared/i,
  /^\s*IFRS\s+\d+/i,
  /^\s*IAS\s+\d+/i,
  /^\s*(Critical|Significant)\s+(accounting\s+)?(judgements?|judgments?|estimates?)\s*$/i,
  /^\s*(Note|Notes?)\s+(\d+[\.\)]?\s+)?(to the|accompanying|financial|consolidated)/i,
  // Common page artifacts
  /^\s*Page\s+\d+\s+of\s+\d+\s*$/i,
  /^\s*\d+\s*$/m,                             // Standalone page numbers
  /^\s*Registered (office|address|number)/i,
  /^\s*Commercial (Register|Registry)/i,
  // Translations disclaimers
  /^\s*This (document|report|is a|translation)/i,
  /^\s*In the event of (any )?discrepan/i,
  /^\s*The (English|Estonian|Latvian|Lithuanian) (version|language|text)/i,
];

const HEADER_REPEAT_THRESHOLD = 3;

/**
 * Prefilter document text to remove boilerplate before extraction.
 * Returns the filtered text.
 */
export function prefilterDocumentText(text: string): string {
  const lines = text.split("\n");

  // Phase 1: Remove boilerplate pattern matches
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true; // keep blank lines for structure

    for (const pattern of BOILERPLATE_PATTERNS) {
      if (pattern.test(trimmed)) return false;
    }

    // Remove very short lines that look like page artifacts
    if (trimmed.length < 3 && /^\d+$/.test(trimmed)) return false;

    return true;
  });

  // Phase 2: Remove repeated headers/footers (appear on most pages)
  const lineFrequency = new Map<string, number>();
  for (const line of filtered) {
    const trimmed = line.trim();
    if (trimmed.length > 5) {
      lineFrequency.set(trimmed, (lineFrequency.get(trimmed) || 0) + 1);
    }
  }

  const result = filtered.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true;
    const count = lineFrequency.get(trimmed) || 0;
    return count < HEADER_REPEAT_THRESHOLD;
  });

  const filteredText = result.join("\n");
  const reduction = text.length > 0
    ? Math.round((1 - filteredText.length / text.length) * 100)
    : 0;

  if (reduction > 5) {
    console.log(
      `[prefilter] Reduced text by ${reduction}% (${text.length} → ${filteredText.length} chars)`,
    );
  }

  return filteredText;
}
