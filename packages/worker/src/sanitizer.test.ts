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
    expect(warnings.revenueBreakdownDropped).toBe(false);
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

    it("merges duplicate segment and geography entries by normalized name", () => {
      const input = baseData({
        revenueBreakdown: {
          bySegment: [
            { name: "Passenger Ferries", value: 100 },
            { name: "passenger ferries", value: 25 },
            { name: "Cargo", value: 50 },
          ],
          byGeography: [
            { name: "Lithuania", value: 20 },
            { name: "Lithuania ", value: 5 },
            { name: "Latvia", value: 10 },
          ],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.revenueBreakdown?.bySegment).toEqual([
        { name: "Passenger Ferries", value: 125 },
        { name: "Cargo", value: 50 },
      ]);
      expect(data.revenueBreakdown?.byGeography).toEqual([
        { name: "Lithuania", value: 25 },
        { name: "Latvia", value: 10 },
      ]);
      expect(warnings.duplicateRevenueBreakdownEntries).toBe(2);
      expect(warnings.revenueBreakdownDropped).toBe(false);
    });

    it("drops breakdown when duplicate merging leaves only one chartable entry", () => {
      const input = baseData({
        revenueBreakdown: {
          bySegment: [
            { name: "Retail", value: 100 },
            { name: "retail", value: 25 },
          ],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.revenueBreakdown).toBeUndefined();
      expect(warnings.duplicateRevenueBreakdownEntries).toBe(1);
      expect(warnings.revenueBreakdownDropped).toBe(true);
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

    it("repairs trend series length mismatches by trimming and padding", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2023", "2024", "2025"],
          revenue: [100, 120, 140, 160],
          ebitda: [50],
          netProfit: [10, 20, 30],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.profitabilityTrends).toEqual({
        periods: ["2023", "2024", "2025"],
        revenue: [100, 120, 140],
        ebitda: [50, null, null],
        netProfit: [10, 20, 30],
      });
      expect(warnings.trendSeriesRepaired).toBe(2);
      expect(warnings.profitabilityTrendsDropped).toBe(false);
    });

    it("merges duplicate trend periods and keeps first non-null series values", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2023", "2024", "2024", "2025"],
          revenue: [100, null, 125, 150],
          ebitda: [40, 50, 55, 60],
          freeCashFlow: [null, 10, 12, 14],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.profitabilityTrends).toEqual({
        periods: ["2023", "2024", "2025"],
        revenue: [100, 125, 150],
        ebitda: [40, 50, 60],
        freeCashFlow: [null, 10, 14],
      });
      expect(warnings.duplicateTrendPeriods).toBe(1);
      expect(warnings.profitabilityTrendsDropped).toBe(false);
    });

    it("drops empty trend series and omits all-null trend sections", () => {
      const input = baseData({
        profitabilityTrends: {
          periods: ["2023", "2024"],
          revenue: [null, null],
          ebitda: [null, null],
        },
      });

      const { data, warnings } = sanitizeExtractedData(input);

      expect(data.profitabilityTrends).toBeUndefined();
      expect(warnings.droppedEmptyTrendSeries).toEqual(["revenue", "ebitda"]);
      expect(warnings.profitabilityTrendsDropped).toBe(true);
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
