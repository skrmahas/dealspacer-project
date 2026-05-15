import type { Company, ReportType } from "@bei/shared";
import { createCompanyStore } from "@bei/shared";

/**
 * Optimal String Alignment (OSA) distance — Levenshtein + adjacent
 * transposition. Counts "Tallnik" ↔ "Tallink" as 1 op instead of 2,
 * which matters at the 0.85 confidence threshold for short company names.
 * O(mn) memory is fine here since names are <50 chars.
 */
function osaDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[m]![n]!;
}

// Baltic + common legal forms. Tokenisation is case-insensitive, so listing
// the lowercase form is enough. "a/s" is handled specially since "/" splits
// into two tokens otherwise.
const LEGAL_FORM_TOKENS = new Set([
  "ab", "as", "ou", "oü", "uab", "sia", "ipas",
  "asa", "oyj", "plc", "ltd", "inc",
]);

const A_SLASH_S = /\ba\s*\/\s*s\b/gi;

function tokenize(name: string): string[] {
  return name
    .replace(A_SLASH_S, " ")
    .toLowerCase()
    .replace(/[.,;:()'"„""''\/\\&]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Strip legal forms and punctuation, lower-case, collapse whitespace.
 * Designed for Baltic company names which commonly appear in both orders
 * ("AB Telia Lietuva" ↔ "Telia Lietuva, AB").
 */
export function normalizeCompanyName(name: string): string[] {
  return tokenize(name).filter((t) => !LEGAL_FORM_TOKENS.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Pure matching function: given a name and a candidate list, return the
 * best company match with confidence ≥ 0.85, or null. Exposed for direct
 * unit testing without a database.
 */
export function pickBestMatch(
  extractedName: string,
  companies: Pick<Company, "id" | "name" | "ticker">[],
): { companyId: string; confidence: number } | null {
  const extractedTokens = normalizeCompanyName(extractedName);
  const extractedNormalized = extractedTokens.join(" ");
  const extractedTokenSet = new Set(extractedTokens);
  const rawTokens = tokenize(extractedName);

  if (extractedNormalized.length === 0) return null;

  let best: { companyId: string; confidence: number } | null = null;

  for (const c of companies) {
    const candTokens = normalizeCompanyName(c.name);
    const candNormalized = candTokens.join(" ");
    const candTokenSet = new Set(candTokens);

    // Character-level OSA distance on the normalized strings — catches
    // typos (incl. adjacent transpositions) and minor spelling variants
    // without being thrown off by legal-form ordering.
    const dist = osaDistance(extractedNormalized, candNormalized);
    const maxLen = Math.max(extractedNormalized.length, candNormalized.length);
    const levConf = maxLen === 0 ? 0 : 1 - dist / maxLen;

    // Token-set Jaccard — catches arbitrary word reordering and extra
    // tokens ("Telia Lietuva, AB" ↔ "AB Telia Lietuva").
    const jaccardConf = jaccard(extractedTokenSet, candTokenSet);

    // Ticker present anywhere in the extracted name → strong signal.
    let tickerConf = 0;
    if (c.ticker) {
      const tickerLower = c.ticker.toLowerCase();
      if (rawTokens.includes(tickerLower)) tickerConf = 1;
    }

    const confidence = Math.max(levConf, jaccardConf, tickerConf);

    if (confidence >= 0.85 && (!best || confidence > best.confidence)) {
      best = { companyId: c.id, confidence };
    }
  }

  return best;
}

/**
 * Match an AI-extracted company name against the companies catalog.
 * Returns the best match with confidence >= 0.85, or null.
 */
export async function matchCompany(
  extractedName: string,
): Promise<{ companyId: string; confidence: number } | null> {
  const store = createCompanyStore();
  const companies = await store.listCompanies();
  return pickBestMatch(extractedName, companies);
}

/**
 * Parse a report period string into fiscal year and report type.
 * Handles: "2024", "FY2024", "Q1 2024", "2024 annual",
 * "2024-03-31", "H1 2024", "9M 2024"
 */
export function parseReportPeriod(
  reportPeriod: string,
): { fiscalYear: number; reportType: ReportType } | null {
  const s = reportPeriod.trim();

  // "Q1 2024", "Q2 2024" etc
  const qMatch = s.match(/^Q([1-4])\s*(\d{4})$/i);
  if (qMatch) {
    return {
      fiscalYear: parseInt(qMatch[2]!, 10),
      reportType: `q${qMatch[1]!.toLowerCase()}` as ReportType,
    };
  }

  // "Q1" alone
  const qAlone = s.match(/^Q([1-4])$/i);
  if (qAlone) {
    const year = new Date().getFullYear();
    return { fiscalYear: year, reportType: `q${qAlone[1]!.toLowerCase()}` as ReportType };
  }

  // "FY2024" or "FY 2024"
  const fyMatch = s.match(/^FY\s*(\d{4})$/i);
  if (fyMatch) {
    return { fiscalYear: parseInt(fyMatch[1]!, 10), reportType: "annual" };
  }

  // "2024 annual" or "2024 annual report"
  const yearAnnual = s.match(/^(\d{4})\s*(annual|report)/i);
  if (yearAnnual) {
    return { fiscalYear: parseInt(yearAnnual[1]!, 10), reportType: "annual" };
  }

  // "H1 2024" or "H2 2024"
  const hMatch = s.match(/^H([12])\s*(\d{4})$/i);
  if (hMatch) {
    return { fiscalYear: parseInt(hMatch[2]!, 10), reportType: "semi-annual" };
  }

  // "9M 2024"
  const mMatch = s.match(/^(\d{1,2})M\s*(\d{4})$/i);
  if (mMatch) {
    const months = parseInt(mMatch[1]!, 10);
    let reportType: ReportType = "other";
    if (months === 3) reportType = "q1";
    else if (months === 6) reportType = "semi-annual";
    else if (months === 9) reportType = "q3";
    return { fiscalYear: parseInt(mMatch[2]!, 10), reportType };
  }

  // "2024-12-31" or "2024-03-31" (date)
  const dateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10);
    const day = parseInt(dateMatch[3]!, 10);
    if (month === 12 && day === 31) return { fiscalYear: year, reportType: "annual" };
    if (month === 3 && day === 31) return { fiscalYear: year, reportType: "q1" };
    if (month === 6 && day === 30) return { fiscalYear: year, reportType: "q2" };
    if (month === 9 && day === 30) return { fiscalYear: year, reportType: "q3" };
    // Default for dates
    return { fiscalYear: year, reportType: "other" };
  }

  // "2024" alone
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    return { fiscalYear: parseInt(yearOnly[1]!, 10), reportType: "annual" };
  }

  return null;
}
