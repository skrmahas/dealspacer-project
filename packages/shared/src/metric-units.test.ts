import { describe, expect, it } from "vitest";
import { applySnapshotCurrencyScale, normalizeMetricToEur } from "./metric-units.js";

describe("normalizeMetricToEur", () => {
  it("converts EUR millions", () => {
    expect(normalizeMetricToEur(0.39, "EUR m", "Revenue")).toBe(390_000);
    expect(normalizeMetricToEur(91.702, "EUR m", "Total assets")).toBe(91_702_000);
  });

  it("converts thousand EUR", () => {
    expect(normalizeMetricToEur(7685, "thousand EUR", "Revenue")).toBe(7_685_000);
  });

  it("leaves large plain EUR values unchanged", () => {
    expect(normalizeMetricToEur(210_400_000, "EUR", "Revenue")).toBe(210_400_000);
  });

  it("scales mislabeled plain EUR thousands for aggregate metrics", () => {
    expect(normalizeMetricToEur(7685, "EUR", "Revenue")).toBe(7_685_000);
    expect(normalizeMetricToEur(7685, "EUR", "Net Profit")).toBe(7_685_000);
  });

  it("does not scale per-share metrics", () => {
    expect(normalizeMetricToEur(-0.03, "EUR", "EPS")).toBe(-0.03);
    expect(normalizeMetricToEur(-0.03, "EUR m", "Earnings per share (EPS)")).toBe(-0.03);
  });

  it("leaves small EUR test fixtures unchanged", () => {
    expect(normalizeMetricToEur(100, "EUR", "Revenue")).toBe(100);
    expect(normalizeMetricToEur(40, "EUR", "EBITDA")).toBe(40);
  });
});

describe("applySnapshotCurrencyScale", () => {
  it("scales plain EUR aggregates when the filing uses thousand EUR elsewhere", () => {
    const snapshot = {
      metrics: [
        { label: "Revenue", value: 7685, unit: "EUR" },
        { label: "Total Liabilities", value: 49873, unit: "thousand EUR" },
      ],
    };
    expect(
      applySnapshotCurrencyScale(-479, "EUR", "Net Profit", snapshot, -479),
    ).toBe(-479_000);
  });
});
