import { describe, expect, it } from "vitest";
import {
  buildMetricsMap,
  computeWeightedComparison,
  formatDelta,
  metricDisplayLabel,
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

  it("matches metrics by canonical id instead of flexible source labels", () => {
    const map = buildMetricsMap(
      [{ ...metric("Sales", 100), canonicalId: "revenue", normalizedValue: 100, normalizedUnit: "EUR" }],
      [{ ...metric("Revenue", 80), canonicalId: "revenue", normalizedValue: 80, normalizedUnit: "EUR" }],
    );

    expect(map).toHaveLength(1);
    const [key, row] = [...map.entries()][0]!;
    expect(key).toBe("canonical:revenue");
    expect(metricDisplayLabel(key, row.a ?? row.b)).toBe("Revenue");
    expect(row.a?.label).toBe("Sales");
    expect(row.b?.label).toBe("Revenue");
  });

  it("uses normalized values when scoring canonical metrics", () => {
    const snapA: ExtractedData = {
      metadata: { companyName: "A", reportPeriod: "2024", sourceLanguage: "en" },
      metrics: [{ ...metric("Sales", 90), canonicalId: "revenue", normalizedValue: 90_000, normalizedUnit: "EUR" }],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };
    const snapB: ExtractedData = {
      metadata: { companyName: "B", reportPeriod: "2024", sourceLanguage: "en" },
      metrics: [{ ...metric("Revenue", 100), canonicalId: "revenue", normalizedValue: 100, normalizedUnit: "EUR" }],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };

    const result = computeWeightedComparison(snapA, snapB, buildMetricsMap(snapA.metrics, snapB.metrics), "A", "B");

    expect(result.scoreA).toBe(2);
    expect(result.scoreB).toBe(0);
  });

  it("formats delta with favorability", () => {
    const up = formatDelta(100, 110, true);
    expect(up.favorable).toBe(true);
    expect(up.text).toContain("+");
  });
});
