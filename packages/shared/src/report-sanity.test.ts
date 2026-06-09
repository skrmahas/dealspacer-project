import { describe, expect, it } from "vitest";
import type { ExtractedData } from "./contracts";
import { assessReportSanity, formatReportSanityIssue } from "./report-sanity.js";

function snapshot(metrics: ExtractedData["metrics"]): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "FY 2025", sourceLanguage: "en" },
    metrics,
    narratives: [],
    sentiment: { managementTone: "neutral", outlook: "", riskFactors: [] },
  };
}

describe("assessReportSanity", () => {
  it("passes a plausible report without history", () => {
    const issues = assessReportSanity(snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 10_000_000, unit: "EUR", normalizedValue: 10_000_000 },
      { label: "Net Profit", canonicalId: "net_profit", value: 1_000_000, unit: "EUR", normalizedValue: 1_000_000 },
      { label: "Total Assets", canonicalId: "total_assets", value: 15_000_000, unit: "EUR", normalizedValue: 15_000_000 },
      { label: "Equity", canonicalId: "equity", value: 7_000_000, unit: "EUR", normalizedValue: 7_000_000 },
    ]));

    expect(issues).toEqual([]);
  });

  it("flags net profit that is wildly larger than revenue", () => {
    const issues = assessReportSanity(snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 139, unit: "EUR", normalizedValue: 139 },
      { label: "Net Profit", canonicalId: "net_profit", value: -61_792_000, unit: "EUR", normalizedValue: -61_792_000 },
    ]));

    expect(issues).toMatchObject([
      { code: "net_profit_exceeds_revenue" },
    ]);
  });

  it("flags balance sheet metrics that are on an incompatible scale with revenue", () => {
    const issues = assessReportSanity(snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 139, unit: "EUR", normalizedValue: 139 },
      { label: "Assets", canonicalId: "total_assets", value: 598_150_000, unit: "EUR", normalizedValue: 598_150_000 },
      { label: "Equity", canonicalId: "equity", value: 512_332_000, unit: "EUR", normalizedValue: 512_332_000 },
      { label: "Liabilities", canonicalId: "liabilities", value: 85_818_000, unit: "EUR", normalizedValue: 85_818_000 },
    ]));

    expect(issues.some((issue) => issue.code === "balance_sheet_scale_mismatch")).toBe(true);
  });

  it("flags semi-annual revenue that dwarfs same-year annual revenue", () => {
    const current = snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 808_373_000, unit: "EUR", normalizedValue: 808_373_000 },
    ]);
    const annual = snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 1_679_919, unit: "EUR", normalizedValue: 1_679_919 },
    ]);

    const issues = assessReportSanity(current, {
      currentFiscalYear: 2025,
      currentReportType: "semi-annual",
      history: [{ fiscalYear: 2025, reportType: "annual", extractedJsonSnapshot: annual }],
    });

    expect(issues.some((issue) => formatReportSanityIssue(issue).includes("Semi-annual revenue"))).toBe(true);
  });

  it("flags revenue that differs by more than 10x from same-company history", () => {
    const current = snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 526_815_000, unit: "EUR", normalizedValue: 526_815_000 },
    ]);
    const prior = snapshot([
      { label: "Revenue", canonicalId: "revenue", value: 11_200, unit: "EUR", normalizedValue: 11_200 },
    ]);

    const issues = assessReportSanity(current, {
      currentFiscalYear: 2022,
      currentReportType: "annual",
      history: [{ fiscalYear: 2025, reportType: "semi-annual", extractedJsonSnapshot: prior }],
    });

    expect(issues).toMatchObject([
      { code: "history_extreme_change" },
    ]);
  });
});
