import { describe, expect, it } from "vitest";
import type { ExtractedMetric } from "@bei/shared";
import { deriveFreeCashFlow } from "./free-cash-flow.js";

function m(overrides: Partial<ExtractedMetric>): ExtractedMetric {
  return {
    label: overrides.label ?? "Metric",
    value: overrides.value ?? null,
    ...overrides,
  };
}

describe("deriveFreeCashFlow", () => {
  it("returns input unchanged when neither OCF nor CAPEX are present", () => {
    const metrics = [m({ label: "Revenue", value: 100, unit: "EUR" })];
    expect(deriveFreeCashFlow(metrics)).toBe(metrics);
  });

  it("does not derive FCF when only OCF is present", () => {
    const metrics = [m({ label: "Net cash from operating activities", value: 50, unit: "EUR" })];
    expect(deriveFreeCashFlow(metrics)).toBe(metrics);
  });

  it("does not derive FCF when only CAPEX is present", () => {
    const metrics = [m({ label: "Capital expenditures", value: 10, unit: "EUR" })];
    expect(deriveFreeCashFlow(metrics)).toBe(metrics);
  });

  it("derives FCF = OCF - |CAPEX| when CAPEX is reported as a positive outflow", () => {
    const metrics = [
      m({ label: "Net cash from operating activities", value: 50, unit: "EUR" }),
      m({ label: "Capital expenditures", value: 12, unit: "EUR" }),
    ];
    const result = deriveFreeCashFlow(metrics);
    const fcf = result.find((x) => x.canonicalId === "free_cash_flow");
    expect(fcf?.value).toBe(38);
    expect(fcf?.unit).toBe("EUR");
    expect(fcf?.evidence?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("derives FCF correctly when CAPEX is reported as a negative number", () => {
    const metrics = [
      m({ label: "Cash flow from operating activities", value: 50, unit: "EUR" }),
      m({ label: "Capex", value: -12, unit: "EUR" }),
    ];
    const fcf = deriveFreeCashFlow(metrics).find((x) => x.canonicalId === "free_cash_flow");
    expect(fcf?.value).toBe(38);
  });

  it("does not derive FCF when OCF and CAPEX units disagree", () => {
    const metrics = [
      m({ label: "Operating cash flow", value: 50, unit: "EUR" }),
      m({ label: "CAPEX", value: 12, unit: "EUR thousand" }),
    ];
    const result = deriveFreeCashFlow(metrics);
    expect(result.find((x) => x.canonicalId === "free_cash_flow")).toBeUndefined();
  });

  it("preserves an existing high-confidence FCF", () => {
    const existing = m({
      label: "Free cash flow",
      value: 999,
      unit: "EUR",
      canonicalId: "free_cash_flow",
      evidence: { confidence: 0.95, snippet: "FCF: 999" },
    });
    const metrics = [
      existing,
      m({ label: "Operating cash flow", value: 50, unit: "EUR" }),
      m({ label: "CAPEX", value: 12, unit: "EUR" }),
    ];
    const result = deriveFreeCashFlow(metrics);
    const fcfs = result.filter((x) => x.canonicalId === "free_cash_flow");
    expect(fcfs).toHaveLength(1);
    expect(fcfs[0].value).toBe(999);
  });

  it("replaces a low-confidence FCF with the computed value", () => {
    const fabricated = m({
      label: "Free cash flow",
      value: 50,
      canonicalId: "free_cash_flow",
      evidence: { confidence: 0.5, snippet: "Net cash flow from operating activities (50)" },
    });
    const metrics = [
      fabricated,
      m({ label: "Operating cash flow", value: 50, unit: "EUR" }),
      m({ label: "CAPEX", value: 12, unit: "EUR" }),
    ];
    const result = deriveFreeCashFlow(metrics);
    const fcfs = result.filter((x) => x.canonicalId === "free_cash_flow");
    expect(fcfs).toHaveLength(1);
    expect(fcfs[0].value).toBe(38);
    expect(fcfs[0].evidence?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("matches OCF and CAPEX by period and supports multiple periods", () => {
    const metrics = [
      m({ label: "Operating cash flow", value: 50, unit: "EUR", period: "FY 2023" }),
      m({ label: "CAPEX", value: 10, unit: "EUR", period: "FY 2023" }),
      m({ label: "Operating cash flow", value: 60, unit: "EUR", period: "FY 2024" }),
      m({ label: "CAPEX", value: 15, unit: "EUR", period: "FY 2024" }),
    ];
    const fcfs = deriveFreeCashFlow(metrics).filter((x) => x.canonicalId === "free_cash_flow");
    expect(fcfs.map((x) => ({ period: x.period, value: x.value })).sort((a, b) => (a.period ?? "").localeCompare(b.period ?? ""))).toEqual([
      { period: "FY 2023", value: 40 },
      { period: "FY 2024", value: 45 },
    ]);
  });
});
