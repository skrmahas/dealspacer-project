import { describe, expect, it } from "vitest";
import {
  buildMetricsMap,
  computeWeightedComparison,
  formatDelta,
  metricWeight,
} from "./compare-utils";
import type { ExtractedData, ExtractedMetric } from "@bei/shared";

const metric = (label: string, value: number): ExtractedMetric => ({
  label,
  value,
  unit: "EUR",
});

describe("compare-utils", () => {
  it("weights pillar metrics at 2×", () => {
    expect(metricWeight("Revenue")).toBe(2);
    expect(metricWeight("Free Cash Flow")).toBe(2);
    expect(metricWeight("EBITDA")).toBe(1);
  });

  it("scores guidance and revenue with pillar weighting", () => {
    const snapA: ExtractedData = {
      metadata: { companyName: "A", reportPeriod: "2024", sourceLanguage: "en" },
      metrics: [metric("Revenue", 100), metric("EBITDA", 40)],
      narratives: [],
      sentiment: {
        managementTone: "positive",
        outlook: "good",
        riskFactors: [],
        guidanceDirection: "raised",
      },
    };
    const snapB: ExtractedData = {
      metadata: { companyName: "B", reportPeriod: "2024", sourceLanguage: "en" },
      metrics: [metric("Revenue", 80), metric("EBITDA", 50)],
      narratives: [],
      sentiment: {
        managementTone: "neutral",
        outlook: "mixed",
        riskFactors: [],
        guidanceDirection: "lowered",
      },
    };
    const map = buildMetricsMap(snapA.metrics, snapB.metrics);
    const result = computeWeightedComparison(snapA, snapB, map, "A", "B");
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
  });

  it("formats delta with favorability", () => {
    const up = formatDelta(100, 110, true);
    expect(up.favorable).toBe(true);
    expect(up.text).toContain("+");
  });
});
