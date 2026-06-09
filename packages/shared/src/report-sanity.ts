import type { ExtractedData, ReportType } from "./contracts";
import { buildReportPreview } from "./preview-metrics";

export interface HistoricalReportSnapshot {
  fiscalYear: number;
  reportType: ReportType;
  extractedJsonSnapshot: ExtractedData | null;
}

export interface ReportSanityIssue {
  code:
    | "net_profit_exceeds_revenue"
    | "cash_flow_exceeds_revenue"
    | "balance_sheet_scale_mismatch"
    | "semi_annual_exceeds_annual"
    | "history_extreme_change";
  severity: "warning" | "error";
  message: string;
}

const EXTREME_HISTORY_MULTIPLE = 10;

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function abs(value: number | null | undefined): number | null {
  const n = finite(value);
  return n == null ? null : Math.abs(n);
}

function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  const x = abs(a);
  const y = abs(b);
  if (x == null || y == null || y === 0) return null;
  return x / y;
}

function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function issue(code: ReportSanityIssue["code"], message: string): ReportSanityIssue {
  return { code, severity: "error", message };
}

export function assessReportSanity(
  data: ExtractedData,
  options: {
    currentReportType?: ReportType;
    currentFiscalYear?: number;
    history?: HistoricalReportSnapshot[];
  } = {},
): ReportSanityIssue[] {
  const preview = buildReportPreview(data);
  const revenue = finite(preview.previewRevenue);
  const netProfit = finite(preview.previewNetProfit);
  const fcf = finite(preview.previewFcf);
  const issues: ReportSanityIssue[] = [];

  const profitToRevenue = ratio(netProfit, revenue);
  if (profitToRevenue != null && profitToRevenue > 2) {
    issues.push(issue(
      "net_profit_exceeds_revenue",
      `Net profit (${netProfit}) is more than 2x revenue (${revenue}).`,
    ));
  }

  const fcfToRevenue = ratio(fcf, revenue);
  if (fcfToRevenue != null && fcfToRevenue > 3) {
    issues.push(issue(
      "cash_flow_exceeds_revenue",
      `Free cash flow (${fcf}) is more than 3x revenue (${revenue}).`,
    ));
  }

  const balanceSheetValues = data.metrics
    .filter((metric) =>
      metric.canonicalId === "total_assets" ||
      metric.canonicalId === "equity" ||
      metric.canonicalId === "liabilities")
    .map((metric) => finite(metric.normalizedValue ?? metric.value))
    .filter((value): value is number => value != null && value > 0);

  if (revenue != null && revenue > 0 && balanceSheetValues.length >= 2) {
    const medianBalanceSheetValue = median(balanceSheetValues);
    const balanceSheetToRevenue = ratio(medianBalanceSheetValue, revenue);
    if (balanceSheetToRevenue != null && (balanceSheetToRevenue > 100 || balanceSheetToRevenue < 0.01)) {
      issues.push(issue(
        "balance_sheet_scale_mismatch",
        `Balance sheet metrics appear on an incompatible scale with revenue (${balanceSheetToRevenue.toFixed(1)}x).`,
      ));
    }
  }

  const history = options.history ?? [];
  const historyRevenues = history
    .map((report) => buildReportPreview(report.extractedJsonSnapshot).previewRevenue)
    .filter((value): value is number => value != null && Number.isFinite(value) && Math.abs(value) > 0)
    .map(Math.abs);

  const historyMedianRevenue = median(historyRevenues);
  if (revenue != null && historyMedianRevenue != null && revenue > 0) {
    const change = ratio(revenue, historyMedianRevenue);
    if (change != null && (change > EXTREME_HISTORY_MULTIPLE || change < 1 / EXTREME_HISTORY_MULTIPLE)) {
      issues.push(issue(
        "history_extreme_change",
        `Revenue (${revenue}) differs by more than ${EXTREME_HISTORY_MULTIPLE}x from same-company history median (${historyMedianRevenue}).`,
      ));
    }
  }

  const currentFiscalYear = options.currentFiscalYear;
  const currentReportType = options.currentReportType;
  if (revenue != null && currentFiscalYear != null && currentReportType != null) {
    const sameYearReports = history.filter((report) => report.fiscalYear === currentFiscalYear);
    if (currentReportType === "semi-annual") {
      const annualRevenue = sameYearReports
        .filter((report) => report.reportType === "annual")
        .map((report) => buildReportPreview(report.extractedJsonSnapshot).previewRevenue)
        .find((value): value is number => value != null && Number.isFinite(value));
      if (annualRevenue != null && Math.abs(revenue) > Math.abs(annualRevenue) * 1.5) {
        issues.push(issue(
          "semi_annual_exceeds_annual",
          `Semi-annual revenue (${revenue}) is more than 1.5x same-year annual revenue (${annualRevenue}).`,
        ));
      }
    }
  }

  return issues;
}

export function formatReportSanityIssue(issue: ReportSanityIssue): string {
  return `Report sanity check failed: ${issue.message}`;
}
