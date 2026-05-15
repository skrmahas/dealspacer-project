import { describe, it, expect } from "vitest";
import { computeYoYChange } from "./chart-renderer";
import type { ProfitabilityTrends } from "@bei/shared";

describe("computeYoYChange", () => {
  it("computes positive YoY change", () => {
    const trends: ProfitabilityTrends = {
      periods: ["Q1 2023", "Q1 2024"],
      revenue: [100, 120],
    };
    const change = computeYoYChange("Revenue", trends);
    expect(change).toBe(20);
  });

  it("computes negative YoY change", () => {
    const trends: ProfitabilityTrends = {
      periods: ["Q1 2023", "Q1 2024"],
      revenue: [100, 80],
    };
    const change = computeYoYChange("Revenue", trends);
    expect(change).toBe(-20);
  });

  it("returns null with fewer than 2 periods", () => {
    const trends: ProfitabilityTrends = {
      periods: ["Q1 2024"],
      revenue: [100],
    };
    const change = computeYoYChange("Revenue", trends);
    expect(change).toBeNull();
  });

  it("returns null when trends is undefined", () => {
    const change = computeYoYChange("Revenue", undefined);
    expect(change).toBeNull();
  });

  it("handles null values in series — uses last two non-null", () => {
    const trends: ProfitabilityTrends = {
      periods: ["2022", "2023", "2024"],
      revenue: [100, null, 150],
    };
    const change = computeYoYChange("Revenue", trends);
    // Last two non-null: 100, 150 → +50%
    expect(change).toBe(50);
  });

  it("returns null when fewer than 2 non-null values exist", () => {
    const trends: ProfitabilityTrends = {
      periods: ["2022", "2023", "2024"],
      revenue: [100, null, null],
    };
    const change = computeYoYChange("Revenue", trends);
    expect(change).toBeNull();
  });

  it("matches EBITDA label", () => {
    const trends: ProfitabilityTrends = {
      periods: ["2023", "2024"],
      ebitda: [50, 55],
    };
    const change = computeYoYChange("EBITDA", trends);
    expect(change).toBe(10);
  });

  it("matches Net Profit / Net Income label", () => {
    const trends: ProfitabilityTrends = {
      periods: ["2023", "2024"],
      netProfit: [30, 36],
    };
    const change = computeYoYChange("Net Profit", trends);
    expect(change).toBe(20);
  });

  it("returns null when base value is 0 (division by zero)", () => {
    const trends: ProfitabilityTrends = {
      periods: ["2023", "2024"],
      revenue: [0, 100],
    };
    const change = computeYoYChange("Revenue", trends);
    expect(change).toBeNull();
  });
});
