import type { ReportType } from "./contracts";

const REPORT_TYPE_RANK: Record<ReportType, number> = {
  annual: 6,
  "semi-annual": 5,
  q4: 4,
  q3: 3,
  q2: 2,
  q1: 1,
  other: 0,
};

export function reportRecencyScore(fiscalYear: number, reportType: ReportType): number {
  return fiscalYear * 10 + (REPORT_TYPE_RANK[reportType] ?? 0);
}

export function compareReportRecency<
  T extends { fiscalYear: number; reportType: ReportType },
>(a: T, b: T): number {
  return reportRecencyScore(a.fiscalYear, a.reportType) - reportRecencyScore(b.fiscalYear, b.reportType);
}

/** Prefer the latest annual filing for headline KPIs; fall back to the newest report. */
export function pickHeadlineReports<T extends { fiscalYear: number; reportType: ReportType }>(
  reports: T[],
): { latest: T | undefined; previous: T | undefined } {
  if (reports.length === 0) return { latest: undefined, previous: undefined };

  const annuals = [...reports].filter((r) => r.reportType === "annual").sort(compareReportRecency);
  if (annuals.length >= 1) {
    return {
      latest: annuals[annuals.length - 1],
      previous: annuals.length >= 2 ? annuals[annuals.length - 2] : undefined,
    };
  }

  const sorted = [...reports].sort(compareReportRecency);
  return {
    latest: sorted[sorted.length - 1],
    previous: sorted.length >= 2 ? sorted[sorted.length - 2] : undefined,
  };
}

/** Trend series from annual filings when present; otherwise best report per fiscal year. */
export function pickTrendReports<T extends { fiscalYear: number; reportType: ReportType }>(
  reports: T[],
): T[] {
  const annuals = [...reports].filter((r) => r.reportType === "annual").sort(compareReportRecency);
  if (annuals.length > 0) return annuals;

  const best = new Map<number, T>();
  for (const r of reports) {
    const existing = best.get(r.fiscalYear);
    if (!existing || compareReportRecency(r, existing) > 0) {
      best.set(r.fiscalYear, r);
    }
  }
  return [...best.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, r]) => r);
}

function formatIsoReportPeriod(
  iso: string,
  fiscalYear: number,
  reportType: ReportType,
): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const quarterFromType = reportType.match(/^q([1-4])$/);
  if (quarterFromType) {
    return `Q${quarterFromType[1]} ${fiscalYear}`;
  }
  const quarter = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  return `Q${quarter} ${year}`;
}

export function formatReportPeriodLabel(r: {
  fiscalYear: number;
  reportType: ReportType;
  extractedJsonSnapshot?: { metadata?: { reportPeriod?: string } } | null;
}): string {
  const meta = r.extractedJsonSnapshot?.metadata?.reportPeriod?.trim();
  if (meta) {
    const fromIso = formatIsoReportPeriod(meta, r.fiscalYear, r.reportType);
    if (fromIso) return fromIso;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta)) return meta;
  }
  if (r.reportType === "annual") return `FY ${r.fiscalYear}`;
  const quarter: Partial<Record<ReportType, string>> = {
    q1: "Q1",
    q2: "Q2",
    q3: "Q3",
    q4: "Q4",
    "semi-annual": "H1",
  };
  const prefix = quarter[r.reportType] ?? r.reportType;
  return `${prefix} ${r.fiscalYear}`;
}
