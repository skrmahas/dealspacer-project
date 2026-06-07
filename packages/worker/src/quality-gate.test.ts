import { describe, expect, it } from "vitest";
import type { ExtractedData } from "@bei/shared";
import { assessReportQuality, buildQualityGateFailureMessage } from "./quality-gate.js";

function baseData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "FY 2024", sourceLanguage: "en" },
    metrics: [{ label: "Revenue", value: 1000, unit: "EUR" }],
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
          { label: "Revenue", value: 1000, unit: "EUR" },
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
});
