import { describe, expect, it } from "vitest";
import type { ExtractedData } from "@bei/shared";
import { assessReportQuality, buildQualityGateFailureMessage } from "./quality-gate.js";

function baseData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "FY 2024", sourceLanguage: "en" },
    metrics: [
      {
        label: "Revenue",
        value: 1000,
        unit: "EUR",
        period: "FY 2024",
        evidence: { snippet: "Revenue FY 2024 was EUR 1000", confidence: 0.9 },
      },
    ],
    narratives: [
      {
        section: "executive_summary",
        text: "The company reported meaningful financial performance with enough detail to be useful.",
      },
    ],
    sentiment: { managementTone: "positive", outlook: "Stable", riskFactors: [] },
    ...overrides,
  };
}

describe("assessReportQuality", () => {
  it("passes a report with metadata, a numeric core metric, and meaningful narrative", () => {
    const result = assessReportQuality(baseData());

    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("fails when no metrics are extracted even if narrative text exists", () => {
    const result = assessReportQuality(baseData({ metrics: [] }));

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("No metrics were extracted.");
    expect(result.warnings).toContain("No core financial metric with a numeric value was extracted.");
  });

  it("fails when metrics are dominated by null values", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [
          {
            label: "Revenue",
            value: 1000,
            unit: "EUR",
            evidence: { snippet: "Revenue was EUR 1000", confidence: 0.9 },
          },
          { label: "EBITDA", value: null, unit: "EUR" },
          { label: "Net Profit", value: null, unit: "EUR" },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("Extraction is dominated by null-valued metrics (2/3).");
  });

  it("fails when no numeric core financial metric is extracted", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [
          { label: "Employees", value: 120 },
          { label: "Average salary", value: 1500, unit: "EUR" },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("No core financial metric with a numeric value was extracted.");
  });

  it("includes metadata warnings in the failure message", () => {
    const result = assessReportQuality(
      baseData({
        metadata: { companyName: "", reportPeriod: "", sourceLanguage: "en" },
      }),
    );

    expect(result.passed).toBe(false);
    expect(buildQualityGateFailureMessage(result.warnings)).toContain("Missing company name");
    expect(buildQualityGateFailureMessage(result.warnings)).toContain("Missing report period");
  });

  it("fails when key evidence is explicitly low confidence", () => {
    const result = assessReportQuality(
      baseData({
        metadata: {
          companyName: "Test Co",
          reportPeriod: "FY 2024",
          sourceLanguage: "en",
          evidence: {
            companyName: { confidence: 0.55, snippet: "Possibly Test Co" },
            reportPeriod: { confidence: 0.58, snippet: "2024" },
          },
        },
        metrics: [
          {
            label: "Revenue",
            value: 1000,
            unit: "EUR",
            canonicalId: "revenue",
            evidence: { confidence: 0.4, snippet: "unclear table row" },
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("Company name evidence confidence is low (0.55).");
    expect(result.warnings).toContain("Report period evidence confidence is low (0.58).");
    expect(result.warnings).toContain('Core metric "Revenue" evidence confidence is low (0.40).');
    expect(result.warnings).toContain('Headline metric "Revenue" is invalid: evidence confidence is low (0.40).');
  });

  it("fails when a headline metric is missing source evidence", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [{ label: "Revenue", value: 1000, unit: "EUR", canonicalId: "revenue" }],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('Headline metric "Revenue" is invalid: missing source evidence snippet.');
  });

  it("fails when a headline metric is missing a clear unit", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [
          {
            label: "Net Profit",
            value: 100,
            canonicalId: "net_profit",
            evidence: { snippet: "Net profit was 100", confidence: 0.9 },
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('Headline metric "Net Profit" is invalid: missing unit.');
  });

  it("fails when a headline metric period conflicts with the report period", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [
          {
            label: "Free Cash Flow",
            value: -5,
            unit: "EUR m",
            period: "FY 2023",
            canonicalId: "free_cash_flow",
            evidence: { snippet: "Free cash flow FY 2023 was EUR -5m", confidence: 0.9 },
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain(
      'Headline metric "Free Cash Flow" is invalid: period "FY 2023" does not match report period "FY 2024".',
    );
  });

  it("fails when current-report sanity checks detect incompatible headline metrics", () => {
    const result = assessReportQuality(
      baseData({
        metrics: [
          {
            label: "Revenue",
            value: 139,
            unit: "EUR",
            canonicalId: "revenue",
            normalizedValue: 139,
            evidence: { snippet: "Revenue was EUR 139", confidence: 0.9 },
          },
          {
            label: "Net Profit",
            value: -61_792_000,
            unit: "EUR",
            canonicalId: "net_profit",
            normalizedValue: -61_792_000,
            evidence: { snippet: "Net profit was EUR -61,792,000", confidence: 0.9 },
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("Net profit"))).toBe(true);
  });
});
