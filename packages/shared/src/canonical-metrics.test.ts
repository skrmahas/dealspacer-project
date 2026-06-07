import { describe, expect, it } from "vitest";
import type { ExtractedData, ExtractedMetric } from "./contracts";
import {
  canonicalizeExtractedData,
  canonicalizeMetric,
  inferCanonicalMetricId,
} from "./canonical-metrics.js";

const metric = (label: string, value = 100, unit = "EUR"): ExtractedMetric => ({
  label,
  value,
  unit,
});

describe("canonical metrics", () => {
  it.each([
    ["Revenue", "revenue"],
    ["Sales", "revenue"],
    ["Turnover", "revenue"],
    ["Net sales", "revenue"],
    ["EBITDA", "ebitda"],
    ["Profit for the period", "net_profit"],
    ["Net income", "net_profit"],
    ["FCF", "free_cash_flow"],
    ["Free cash flow", "free_cash_flow"],
    ["Operating cash flow", "operating_cash_flow"],
    ["CAPEX", "capex"],
    ["Total assets", "total_assets"],
    ["Equity", "equity"],
    ["Liabilities", "liabilities"],
    ["EPS", "eps"],
    ["Dividends", "dividends"],
  ] as const)("maps %s to %s", (label, expected) => {
    expect(inferCanonicalMetricId(label)).toBe(expected);
  });

  it("keeps source label/unit while adding canonical id and normalized value", () => {
    const normalized = canonicalizeMetric(metric("Sales", 7_685, "thousand EUR"), {
      metrics: [metric("Sales", 7_685, "thousand EUR")],
    });

    expect(normalized).toMatchObject({
      label: "Sales",
      originalLabel: "Sales",
      originalUnit: "thousand EUR",
      canonicalId: "revenue",
      normalizedValue: 7_685_000,
      normalizedUnit: "EUR",
    });
  });

  it("normalizes all extracted metrics in a snapshot", () => {
    const data: ExtractedData = {
      metadata: { companyName: "ACME", reportPeriod: "2025", sourceLanguage: "en" },
      metrics: [metric("Turnover", 1.2, "EUR m"), metric("Profit for the period", 300, "thousand EUR")],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };

    const normalized = canonicalizeExtractedData(data);

    expect(normalized.metrics.map((m) => m.canonicalId)).toEqual(["revenue", "net_profit"]);
    expect(normalized.metrics.map((m) => m.normalizedValue)).toEqual([1_200_000, 300_000]);
  });
});
