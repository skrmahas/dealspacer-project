import { describe, expect, it } from "vitest";
import { formatReportPeriodLabel, pickHeadlineReports, pickTrendReports } from "./report-metrics.js";

const r = (year: number, type: "annual" | "semi-annual" | "q1" | "q4") => ({ fiscalYear: year, reportType: type });
const reportWithMetrics = (
  year: number,
  type: "annual" | "semi-annual" | "q1" | "q4",
  metrics: {
    previewRevenue?: number | null;
    previewEbitda?: number | null;
    previewNetProfit?: number | null;
  },
) => ({ ...r(year, type), ...metrics });

describe("pickHeadlineReports", () => {
  it("prefers latest annual over newer quarterly", () => {
    const reports = [r(2025, "annual"), r(2025, "q4"), r(2026, "q1")];
    const { latest, previous } = pickHeadlineReports(reports);
    expect(latest).toEqual(r(2025, "annual"));
    expect(previous).toBeUndefined();
  });

  it("compares two annuals when available", () => {
    const reports = [r(2024, "annual"), r(2025, "annual"), r(2026, "q1")];
    const { latest, previous } = pickHeadlineReports(reports);
    expect(latest).toEqual(r(2025, "annual"));
    expect(previous).toEqual(r(2024, "annual"));
  });

  it("falls back to the newest usable filing when the latest annual has no core metrics", () => {
    const emptyAnnual = reportWithMetrics(2025, "annual", {
      previewRevenue: null,
      previewEbitda: null,
      previewNetProfit: null,
    });
    const populatedQ4 = reportWithMetrics(2025, "q4", {
      previewRevenue: 76_200_000,
      previewEbitda: 10_700_000,
      previewNetProfit: -897_103,
    });

    const { latest, previous } = pickHeadlineReports([emptyAnnual, populatedQ4]);

    expect(latest).toEqual(populatedQ4);
    expect(previous).toBeUndefined();
  });

  it("falls back from a materially stale annual to a newer populated interim filing", () => {
    const staleAnnual = reportWithMetrics(2022, "annual", {
      previewRevenue: 526_815_000,
      previewEbitda: null,
      previewNetProfit: null,
    });
    const currentSemiAnnual = reportWithMetrics(2025, "semi-annual", {
      previewRevenue: 11_200,
      previewEbitda: null,
      previewNetProfit: -23_165,
    });

    const { latest, previous } = pickHeadlineReports([staleAnnual, currentSemiAnnual]);

    expect(latest).toEqual(currentSemiAnnual);
    expect(previous).toEqual(staleAnnual);
  });

  it("keeps a populated annual ahead of a next-year Q1 filing", () => {
    const annual = reportWithMetrics(2025, "annual", {
      previewRevenue: 174_047_000,
      previewEbitda: 16_000_000,
      previewNetProfit: 11_000_000,
    });
    const q1 = reportWithMetrics(2026, "q1", {
      previewRevenue: 35_113_000,
      previewEbitda: 1_641_000,
      previewNetProfit: 19_000,
    });

    const { latest, previous } = pickHeadlineReports([q1, annual]);

    expect(latest).toEqual(annual);
    expect(previous).toBeUndefined();
  });
});

describe("formatReportPeriodLabel", () => {
  it("formats ISO report dates as quarter labels", () => {
    expect(
      formatReportPeriodLabel({
        fiscalYear: 2026,
        reportType: "q1",
        extractedJsonSnapshot: { metadata: { reportPeriod: "2026-03-31" } },
      }),
    ).toBe("Q1 2026");
  });

  it("keeps annual ISO report periods labeled as fiscal years", () => {
    expect(
      formatReportPeriodLabel({
        fiscalYear: 2024,
        reportType: "annual",
        extractedJsonSnapshot: { metadata: { reportPeriod: "2024-12-31" } },
      }),
    ).toBe("FY 2024");
  });
});

describe("pickTrendReports", () => {
  it("uses only annual filings when any exist", () => {
    const reports = [r(2025, "q4"), r(2025, "annual"), r(2026, "q1")];
    expect(pickTrendReports(reports)).toEqual([r(2025, "annual")]);
  });

  it("falls back to best per year when no annuals exist", () => {
    const reports = [r(2025, "q4"), r(2026, "q1")];
    expect(pickTrendReports(reports)).toEqual([r(2025, "q4"), r(2026, "q1")]);
  });
});
