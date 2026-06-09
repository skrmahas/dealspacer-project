import { describe, expect, it } from "vitest";
import {
  buildRevenueBreakdownSegments,
  buildReportPreview,
  buildTrendChartFromSnapshot,
  findMetricByKey,
  resolvePriorPreviewMetric,
} from "./preview-metrics.js";

const ARTEA_SNAPSHOT = {
  metadata: { companyName: "AB Artea Bankas", reportPeriod: "2026-03-31" },
  metrics: [
    { unit: "EUR", label: "Pajamos", value: 45786 },
    { unit: "EUR", label: "Grynasis pelnas", value: 15420 },
    { unit: "EUR", label: "Veiklos pelnas", value: 20080 },
    { unit: "EUR", label: "Grynasis palūkanų pajamos", value: 35792 },
  ],
  profitabilityTrends: {
    periods: ["Q1 2025", "Q1 2026"],
    revenue: [49644, 45786],
    netProfit: [17683, 15420],
  },
};

describe("preview-metrics (Artea Bankas LT Q1)", () => {
  it("finds revenue and net profit from Lithuanian labels", () => {
    expect(findMetricByKey(ARTEA_SNAPSHOT, "revenue")?.label).toBe("Pajamos");
    expect(findMetricByKey(ARTEA_SNAPSHOT, "netProfit")?.label).toBe("Grynasis pelnas");
    expect(findMetricByKey(ARTEA_SNAPSHOT, "revenue")?.label).not.toMatch(/palūkan/);
  });

  it("prefers canonical ids for common revenue label variants", () => {
    const snapshot = {
      metrics: [
        { unit: "EUR", label: "Sales", value: 120, canonicalId: "revenue" as const },
        { unit: "EUR", label: "Profit for the period", value: 40, canonicalId: "net_profit" as const },
      ],
    };

    expect(findMetricByKey(snapshot, "revenue")?.label).toBe("Sales");
    expect(findMetricByKey(snapshot, "netProfit")?.label).toBe("Profit for the period");
  });

  it("builds normalized previews in whole EUR", () => {
    const preview = buildReportPreview(ARTEA_SNAPSHOT);
    expect(preview.previewRevenue).toBe(45_786_000);
    expect(preview.previewNetProfit).toBe(15_420_000);
  });

  it("reads prior period from profitabilityTrends for YoY", () => {
    expect(resolvePriorPreviewMetric(ARTEA_SNAPSHOT, "revenue")).toBe(49_644_000);
    expect(resolvePriorPreviewMetric(ARTEA_SNAPSHOT, "netProfit")).toBe(17_683_000);
  });

  it("builds multi-period trend chart from a single filing", () => {
    const chart = buildTrendChartFromSnapshot(ARTEA_SNAPSHOT);
    expect(chart?.labels).toEqual(["Q1 2025", "Q1 2026"]);
    expect(chart?.revenue).toEqual([49_644_000, 45_786_000]);
    expect(chart?.netProfit).toEqual([17_683_000, 15_420_000]);
  });

  it("infers million-scale trend values from current metric values", () => {
    const chart = buildTrendChartFromSnapshot({
      metrics: [
        { unit: "million EUR", label: "Revenue", value: 919.6 },
        { unit: "million EUR", label: "EBITDA", value: 77.4 },
        { unit: "million EUR", label: "Net Profit", value: 17.5 },
        { unit: "thousand EUR", label: "Capital Expenditures", value: 14366 },
      ],
      profitabilityTrends: {
        periods: ["2024", "2025"],
        revenue: [944.6, 919.6],
        ebitda: [90.7, 77.4],
        netProfit: [27, 17.5],
      },
    });

    expect(chart?.revenue).toEqual([944_600_000, 919_600_000]);
    expect(chart?.ebitda).toEqual([90_700_000, 77_400_000]);
    expect(chart?.netProfit).toEqual([27_000_000, 17_500_000]);
  });

  it("uses the inferred trend scale for series that are missing headline metrics", () => {
    const preview = buildReportPreview({
      metrics: [
        { unit: "EUR m", label: "Revenue", value: 17.99 },
        { unit: "EUR m", label: "Net Profit", value: 4.28 },
        { unit: "EUR m", label: "Free Cash Flow", value: 7.09 },
      ],
      profitabilityTrends: {
        periods: ["Q1 2025", "Q1 2026"],
        revenue: [16004, 17993],
        ebitda: [null, 8442],
        netProfit: [3436, 4277],
        freeCashFlow: [7402, 7093],
      },
    });

    expect(preview.previewEbitda).toBe(8_442_000);
  });

  it("keeps small trend values aligned with the inferred filing scale", () => {
    const chart = buildTrendChartFromSnapshot({
      metrics: [
        { unit: "EUR", label: "Revenue", value: 152425 },
        { unit: "EUR", label: "EBITDA", value: -4122 },
        { unit: "EUR", label: "Net Profit", value: -5155 },
      ],
      profitabilityTrends: {
        periods: ["Q3 2022", "9M 2022", "Q3 2024", "9M 2024"],
        revenue: [62960, 151745, 61104, 152425],
        ebitda: [1117, 43, -2557, -4122],
        netProfit: [1819, -218, -2879, -5155],
      },
    });

    expect(chart?.ebitda).toEqual([1_117_000, 43_000, -2_557_000, -4_122_000]);
    expect(chart?.netProfit).toEqual([1_819_000, -218_000, -2_879_000, -5_155_000]);
  });

  it("sorts annual trend periods chronologically while preserving aligned values", () => {
    const chart = buildTrendChartFromSnapshot({
      metrics: [{ unit: "EUR", label: "Revenue", value: 174047 }],
      profitabilityTrends: {
        periods: ["2025", "2021", "2022", "2023", "2024"],
        revenue: [174047, 152.8, 175.3, 209, 174.7],
        ebitda: [null, 7.2, 0.2, 12.4, 10.4],
        netProfit: [null, 2.6, -5.5, 5.2, 3.2],
      },
    });

    expect(chart?.labels).toEqual(["2021", "2022", "2023", "2024", "2025"]);
    expect(chart?.revenue).toEqual([152_800_000, 175_300_000, 209_000_000, 174_700_000, 174_047_000]);
    expect(chart?.ebitda).toEqual([7_200, 200, 12_400, 10_400, null]);
    expect(chart?.netProfit).toEqual([2_600, -5_500, 5_200, 3_200, null]);
  });

  it("sorts quarter and date trend periods by fiscal sequence", () => {
    const chart = buildTrendChartFromSnapshot({
      metrics: [{ unit: "EUR", label: "Revenue", value: 100 }],
      profitabilityTrends: {
        periods: ["Q3 2024", "2024-03-31", "Q2 2024", "2023"],
        revenue: [30, 10, 20, 5],
      },
    });

    expect(chart?.labels).toEqual(["2023", "2024-03-31", "Q2 2024", "Q3 2024"]);
    expect(chart?.revenue).toEqual([5, 10, 20, 30]);
  });

  it("sorts live mixed fiscal period label variants", () => {
    const chart = buildTrendChartFromSnapshot({
      metrics: [{ unit: "EUR", label: "Revenue", value: 100 }],
      profitabilityTrends: {
        periods: ["2024 9 months", "2023-09", "2024 Q1", "H1 2024", "2023-2024 Q1"],
        revenue: [50, 20, 40, 45, 30],
      },
    });

    expect(chart?.labels).toEqual(["2023-2024 Q1", "2023-09", "2024 Q1", "H1 2024", "2024 9 months"]);
    expect(chart?.revenue).toEqual([30, 20, 40, 45, 50]);
  });

  it("normalizes revenue breakdown values to the headline revenue scale", () => {
    const segments = buildRevenueBreakdownSegments(
      {
        metrics: [{ unit: "EUR", label: "Revenue", value: 35414 }],
        revenueBreakdown: {
          bySegment: [
            { name: "Residential Real Estate", value: 33432 },
            { name: "Commercial Real Estate", value: 1528 },
            { name: "Headquarters", value: 454 },
          ],
        },
      },
      35_414_000,
    );

    expect(segments).toEqual([
      { label: "Residential Real Estate", value: 33_432_000 },
      { label: "Commercial Real Estate", value: 1_528_000 },
      { label: "Headquarters", value: 454_000 },
    ]);
  });

  it("uses million-scale breakdown values when that best matches headline revenue", () => {
    const segments = buildRevenueBreakdownSegments(
      {
        metrics: [{ unit: "EUR", label: "Revenue", value: 67.977 }],
        revenueBreakdown: {
          bySegment: [
            { name: "Oil terminals", value: 39.5 },
            { name: "LNG terminal", value: 28.477 },
          ],
        },
      },
      67_977_000,
    );

    expect(segments).toEqual([
      { label: "Oil terminals", value: 39_500_000 },
      { label: "LNG terminal", value: 28_477_000 },
    ]);
  });

  it("filters percentage share breakdowns instead of rendering them as euros", () => {
    const segments = buildRevenueBreakdownSegments(
      {
        metrics: [{ unit: "EUR", label: "Revenue", value: 152425 }],
        revenueBreakdown: {
          byGeography: [
            { name: "Lithuania", value: "56%" },
            { name: "Latvia", value: "21%" },
            { name: "Estonia", value: "23%" },
          ],
        },
      },
      152_425_000,
    );

    expect(segments).toEqual([]);
  });

  it("filters breakdowns when no available scale is comparable to headline revenue", () => {
    const segments = buildRevenueBreakdownSegments(
      {
        metrics: [{ unit: "EUR", label: "Revenue", value: 1745 }],
        revenueBreakdown: {
          bySegment: [
            { name: "Crop production", value: 28.4 },
            { name: "Dairy", value: 16.42 },
          ],
        },
      },
      1_745_000,
    );

    expect(segments).toEqual([]);
  });
});
