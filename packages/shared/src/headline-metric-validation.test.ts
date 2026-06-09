import { describe, expect, it } from "vitest";
import type { ExtractedData } from "./contracts";
import {
  formatHeadlineMetricIssue,
  validateHeadlineMetrics,
} from "./headline-metric-validation.js";

function data(metrics: ExtractedData["metrics"], reportPeriod = "FY 2025"): Pick<ExtractedData, "metadata" | "metrics"> {
  return {
    metadata: { companyName: "Test Co", reportPeriod, sourceLanguage: "en" },
    metrics,
  };
}

describe("validateHeadlineMetrics", () => {
  it("accepts evidence-backed headline metrics with unit and period context", () => {
    const issues = validateHeadlineMetrics(data([
      {
        label: "Revenue",
        canonicalId: "revenue",
        value: 12_300_000,
        unit: "EUR",
        period: "FY 2025",
        evidence: { snippet: "Revenue for FY 2025 was EUR 12.3m", confidence: 0.92 },
      },
    ]));

    expect(issues).toEqual([]);
  });

  it("uses report period as period context when a metric omits its own period", () => {
    const issues = validateHeadlineMetrics(data([
      {
        label: "Net Profit",
        canonicalId: "net_profit",
        value: 120_000,
        unit: "EUR",
        evidence: { snippet: "Net profit was EUR 120 thousand", confidence: 0.88 },
      },
    ]));

    expect(issues).toEqual([]);
  });

  it("flags headline metrics without source evidence snippets", () => {
    const issues = validateHeadlineMetrics(data([
      { label: "Revenue", canonicalId: "revenue", value: 12_300_000, unit: "EUR" },
    ]));

    expect(issues).toMatchObject([
      { metricId: "revenue", label: "Revenue", reason: "missing source evidence snippet" },
    ]);
  });

  it("flags headline metrics without clear units", () => {
    const issues = validateHeadlineMetrics(data([
      {
        label: "EBITDA",
        canonicalId: "ebitda",
        value: 900,
        evidence: { snippet: "EBITDA was 900", confidence: 0.9 },
      },
    ]));

    expect(issues).toMatchObject([
      { metricId: "ebitda", label: "EBITDA", reason: "missing unit" },
    ]);
  });

  it("flags mismatched metric and report periods", () => {
    const issues = validateHeadlineMetrics(data([
      {
        label: "Free Cash Flow",
        canonicalId: "free_cash_flow",
        value: -10,
        unit: "EUR m",
        period: "FY 2024",
        evidence: { snippet: "Free cash flow FY 2024 was EUR -10m", confidence: 0.9 },
      },
    ], "FY 2025"));

    expect(formatHeadlineMetricIssue(issues[0]!)).toBe(
      'Headline metric "Free Cash Flow" is invalid: period "FY 2024" does not match report period "FY 2025".',
    );
  });

  it("flags low-confidence headline metric evidence", () => {
    const issues = validateHeadlineMetrics(data([
      {
        label: "Revenue",
        canonicalId: "revenue",
        value: 100,
        unit: "EUR",
        evidence: { snippet: "unclear revenue row", confidence: 0.4 },
      },
    ]));

    expect(issues).toMatchObject([
      { metricId: "revenue", label: "Revenue", reason: "evidence confidence is low (0.40)" },
    ]);
  });

  it("ignores non-headline metrics", () => {
    const issues = validateHeadlineMetrics(data([
      { label: "Total Assets", canonicalId: "total_assets", value: 5_000_000, unit: "EUR" },
    ]));

    expect(issues).toEqual([]);
  });
});
