import { describe, expect, it } from "vitest";
import {
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
});
