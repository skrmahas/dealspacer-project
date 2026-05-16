import { describe, expect, it } from "vitest";
import { formatReportPeriodLabel, pickHeadlineReports, pickTrendReports } from "./report-metrics.js";

const r = (year: number, type: "annual" | "q1" | "q4") => ({ fiscalYear: year, reportType: type });

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
