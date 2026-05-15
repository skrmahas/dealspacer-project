import type { ReportType } from "@bei/shared";
import { createCompanyStore } from "@bei/shared";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
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

  let best: { companyId: string; confidence: number } | null = null;

  for (const c of companies) {
    // Compare against company name
    const nameDist = levenshtein(extractedName.toLowerCase(), c.name.toLowerCase());
    const nameConf = 1 - nameDist / Math.max(extractedName.length, c.name.length);

    // Compare against ticker
    let tickerConf = 0;
    if (c.ticker) {
      const tickerDist = levenshtein(extractedName.toLowerCase(), c.ticker.toLowerCase());
      tickerConf = 1 - tickerDist / Math.max(extractedName.length, c.ticker.length);
    }

    const confidence = Math.max(nameConf, tickerConf);

    if (confidence >= 0.85 && (!best || confidence > best.confidence)) {
      best = { companyId: c.id, confidence };
    }
  }

  return best;
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
