import { describe, it, expect } from "vitest";
import { sanitizeExtractedData } from "./sanitizer.js";
import type { ExtractedData } from "@bei/shared";

function baseData(overrides?: Partial<ExtractedData>): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "2024", sourceLanguage: "en" },
    metrics: [
      { label: "Revenue", value: 1000000, unit: "EUR" },
      { label: "EBITDA", value: 500000, unit: "EUR" },
    ],
    narratives: [
      { section: "executive_summary", text: "Strong quarter with revenue growth of 15% year-on-year. Operating margins improved across all segments." },
    ],
    sentiment: { managementTone: "positive", outlook: "Continued growth expected.", riskFactors: ["Market volatility"] },
    ...overrides,
  };
}

describe("sanitizeExtractedData", () => {
  it("passes through clean data unchanged", () => {
    const input = baseData();
    const { data, warnings } = sanitizeExtractedData(input);

    expect(data.metrics).toHaveLength(2);
    expect(data.revenueBreakdown).toBeUndefined();
    expect(warnings.duplicateLabels).toHaveLength(0);
    expect(warnings.droppedNullMetrics).toBe(0);
    expect(warnings.nonCanonicalNarrativeSections).toHaveLength(0);
    expect(warnings.missingExecutiveSummary).toBe(false);
    expect(warnings.revenueBreakdownDropped).toBe(false);
  });

  describe("narrative sections", () => {
    it("normalizes known non-canonical narrative sections", () => {
      const input = baseData({
        narratives: [
          { section: "financial_performance", text: "Revenue and EBITDA improved materially." },
          { section: "riskFactors", text: "The company remains exposed to energy prices." },
          { section: "company-profile", text: "The group operates across Baltic markets." },
          { section: "strategic goals", text: "Management prioritizes automation and efficiency." },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.narratives).toEqual([
        { section: "executive_summary", text: "Revenue and EBITDA improved materially." },
        { section: "other", text: "The company remains exposed to energy prices." },
        { section: "business_overview", text: "The group operates across Baltic markets." },
        { section: "strategic_priorities", text: "Management prioritizes automation and efficiency." },
      ]);
      expect(warnings.nonCanonicalNarrativeSections).toEqual([
        "financial_performance",
        "riskFactors",
        "company-profile",
        "strategic goals",
      ]);
      expect(warnings.missingExecutiveSummary).toBe(false);
    });

    it("merges narratives that normalize to the same canonical section", () => {
      const input = baseData({
        narratives: [
          { section: "financial_results", text: "Revenue increased." },
          { section: "executive_summary", text: "Margins expanded." },
          { section: "financial overview", text: "Cash generation improved." },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.narratives).toEqual([
        {
          section: "executive_summary",
          text: "Revenue increased.\n\nMargins expanded.\n\nCash generation improved.",
        },
      ]);
      expect(warnings.nonCanonicalNarrativeSections).toEqual([
        "financial_results",
        "financial overview",
      ]);
      expect(warnings.missingExecutiveSummary).toBe(false);
    });

    it("preserves unknown narrative content in an other bucket", () => {
      const input = baseData({
        narratives: [
          { section: "shareholder_rights", text: "Shareholders approved dividend distribution." },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.narratives).toEqual([
        { section: "other", text: "Shareholders approved dividend distribution." },
      ]);
      expect(warnings.nonCanonicalNarrativeSections).toEqual(["shareholder_rights"]);
      expect(warnings.missingExecutiveSummary).toBe(true);
    });

    it("warns when executive summary is missing after normalization", () => {
      const input = baseData({
        narratives: [
          { section: "management_commentary", text: "Management described stable demand." },
          { section: "outlook", text: "The company expects moderate growth." },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.narratives.map((n) => n.section)).toEqual([
        "management_commentary",
        "outlook",
      ]);
      expect(warnings.missingExecutiveSummary).toBe(true);
    });
  });

  describe("duplicate labels", () => {
    it("drops exact duplicate labels (case-insensitive)", () => {
      const input = baseData({
        metrics: [
          { label: "Revenue", value: 100, unit: "EUR" },
          { label: "revenue", value: 110, unit: "EUR" },
          { label: "EBITDA", value: 50, unit: "EUR" },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.metrics).toHaveLength(2);
      expect(warnings.duplicateLabels).toContain("revenue");
    });
  });

  describe("null metrics", () => {
    it("drops metrics with null value and no unit", () => {
      const input = baseData({
        metrics: [
          { label: "Revenue", value: 100, unit: "EUR" },
          { label: "Some Figure", value: null },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.metrics).toHaveLength(1);
      expect(warnings.droppedNullMetrics).toBe(1);
    });

    it("keeps metrics with null value but has a unit", () => {
      const input = baseData({
        metrics: [
          { label: "Revenue", value: 100, unit: "EUR" },
          { label: "Dividend", value: null, unit: "EUR" },
        ],
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.metrics).toHaveLength(2);
      expect(warnings.droppedNullMetrics).toBe(0);
    });
  });

  describe("revenue breakdown", () => {
    it("drops breakdown with 0 segments", () => {
      const input = baseData({
        revenueBreakdown: { bySegment: [] },
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.revenueBreakdown).toBeUndefined();
      expect(warnings.revenueBreakdownDropped).toBe(true);
    });

    it("drops breakdown with 1 segment", () => {
      const input = baseData({
        revenueBreakdown: { bySegment: [{ name: "Ferries", value: 100 }] },
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.revenueBreakdown).toBeUndefined();
      expect(warnings.revenueBreakdownDropped).toBe(true);
    });

    it("keeps breakdown with 2+ segments", () => {
      const input = baseData({
        revenueBreakdown: {
          bySegment: [
            { name: "Ferries", value: 100 },
            { name: "Cargo", value: 50 },
          ],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.revenueBreakdown).toBeDefined();
      expect(warnings.revenueBreakdownDropped).toBe(false);
    });
  });

  describe("profitability trends", () => {
    it("drops trends with <2 periods", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2024"],
          revenue: [100],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.profitabilityTrends).toBeUndefined();
      expect(warnings.profitabilityTrendsDropped).toBe(true);
    });

    it("keeps trends with 2+ periods", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2024", "2025"],
          revenue: [100, 120],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);
      expect(data.profitabilityTrends).toBeDefined();
      expect(warnings.profitabilityTrendsDropped).toBe(false);
    });
  });

  describe("implausible YoY detection", () => {
    it("detects YoY changes >500%", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2024", "2025"],
          revenue: [10, 1000], // +9900% — from 10 to 1000
        },
      });

      const { warnings } = sanitizeExtractedData(input);
      expect(warnings.implausibleYoYCount).toBeGreaterThanOrEqual(1);
    });

    it("detects YoY changes <−500%", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2024", "2025"],
          revenue: [1000, 10], // −99%
        },
      });

      const { warnings } = sanitizeExtractedData(input);
      // -99% is within ±500% so this should NOT trigger
      expect(warnings.implausibleYoYCount).toBe(0);
    });

    it("passes normal YoY changes", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2024", "2025"],
          revenue: [100, 120], // +20%
        },
      });

      const { warnings } = sanitizeExtractedData(input);
      expect(warnings.implausibleYoYCount).toBe(0);
    });
  });

  describe("integration: multiple issues", () => {
    it("handles duplicates + null metrics + broken sections in one pass", () => {
      const input = baseData({
        metrics: [
          { label: "Revenue", value: 100, unit: "EUR" },
          { label: "REVENUE", value: 110, unit: "EUR" },
          { label: "Garbage", value: null },
          { label: "EBITDA", value: 50, unit: "EUR" },
        ],
        revenueBreakdown: { bySegment: [{ name: "Only", value: 100 }] },
        profitabilityTrends: { periods: ["2024"], revenue: [100] },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.metrics).toHaveLength(2);
      expect(warnings.duplicateLabels).toContain("REVENUE");
      expect(warnings.droppedNullMetrics).toBe(1);
      expect(warnings.revenueBreakdownDropped).toBe(true);
      expect(warnings.profitabilityTrendsDropped).toBe(true);
    });
  });
});
