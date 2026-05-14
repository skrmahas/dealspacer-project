import { describe, it, expect } from "vitest";
import { renderSparkline, renderRevenueBreakdownBar, renderRevenueDonut, renderProfitabilityTrends } from "./chart-renderer.js";

describe("Sparkline thresholds", () => {
  it("returns empty string when fewer than 3 non-null values", async () => {
    const result = await renderSparkline([100, 200]);
    expect(result).toBe("");
  });

  it("returns empty string with 1 value", async () => {
    const result = await renderSparkline([100]);
    expect(result).toBe("");
  });

  it("returns empty string with all nulls", async () => {
    const result = await renderSparkline([null, null, null]);
    expect(result).toBe("");
  });

  it("returns a valid base64 PNG when ≥3 non-null values", async () => {
    const result = await renderSparkline([100, 200, 150, 180]);
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result.length).toBeGreaterThan(50);
  });

  it("fills null gaps and still renders if ≥3 clean values remain", async () => {
    const result = await renderSparkline([100, null, 200, 150]);
    // null gets filled → 4 clean values → renders
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe("Revenue breakdown bar thresholds", () => {
  it("returns empty string for 0 segments", async () => {
    const result = await renderRevenueBreakdownBar([]);
    expect(result).toBe("");
  });

  it("returns empty string for 1 segment", async () => {
    const result = await renderRevenueBreakdownBar([{ name: "Ferries", value: 100 }]);
    expect(result).toBe("");
  });

  it("renders for 2 segments", async () => {
    const result = await renderRevenueBreakdownBar([
      { name: "Ferries", value: 100 },
      { name: "Cargo", value: 50 },
    ]);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("renders for 3+ segments", async () => {
    const result = await renderRevenueBreakdownBar([
      { name: "A", value: 100 },
      { name: "B", value: 200 },
      { name: "C", value: 300 },
    ]);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe("Revenue donut thresholds", () => {
  it("returns empty string for 0 segments", async () => {
    const result = await renderRevenueDonut([]);
    expect(result).toBe("");
  });

  it("returns empty string for 1 segment", async () => {
    const result = await renderRevenueDonut([{ name: "All", value: 100 }]);
    expect(result).toBe("");
  });

  it("renders for 2+ segments", async () => {
    const result = await renderRevenueDonut([
      { name: "A", value: 60 },
      { name: "B", value: 40 },
    ]);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe("Profitability trends thresholds", () => {
  it("returns empty string when fewer than 2 periods", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024"],
      revenue: [100],
    });
    expect(result).toBe("");
  });

  it("returns empty string when no series has ≥2 non-null values", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025"],
      revenue: [100, null],
      ebitda: [null, 50],
    });
    expect(result).toBe("");
  });

  it("renders when ≥2 periods and at least one series has ≥2 non-null values", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025"],
      revenue: [100, 120],
    });
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("renders with multiple series where one meets threshold", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025", "2026"],
      revenue: [100, null, null],
      ebitda: [50, 55, 60],
    });
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});
