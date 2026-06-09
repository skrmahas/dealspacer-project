import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "canvas";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderSparkline, renderRevenueBreakdownBar, renderRevenueDonut, renderProfitabilityTrends } from "./chart-renderer.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bei-chart-test-"));
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
});

async function getPixelColor(dataUrl: string, x: number, y: number) {
  const image = await loadImage(dataUrl);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return { r, g, b };
}

describe("Sparkline thresholds", () => {
  it("returns empty string when fewer than 3 non-null values", async () => {
    const result = await renderSparkline([100, 200], tempDir, "spark-1.jpg");
    expect(result).toBe("");
  });

  it("returns empty string with 1 value", async () => {
    const result = await renderSparkline([100], tempDir, "spark-2.jpg");
    expect(result).toBe("");
  });

  it("returns empty string with all nulls", async () => {
    const result = await renderSparkline([null, null, null], tempDir, "spark-3.jpg");
    expect(result).toBe("");
  });

  it("returns a valid data image URL when ≥3 non-null values", async () => {
    const result = await renderSparkline([100, 200, 150, 180], tempDir, "spark-4.jpg");
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.length).toBeGreaterThan(10);
  });

  it("fills null gaps and still renders if ≥3 clean values remain", async () => {
    const result = await renderSparkline([100, null, 200, 150], tempDir, "spark-5.jpg");
    // null gets filled → 4 clean values → renders
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("Revenue breakdown bar thresholds", () => {
  it("returns empty string for 0 segments", async () => {
    const result = await renderRevenueBreakdownBar([], tempDir);
    expect(result).toBe("");
  });

  it("returns empty string for 1 segment", async () => {
    const result = await renderRevenueBreakdownBar([{ name: "Ferries", value: 100 }], tempDir);
    expect(result).toBe("");
  });

  it("renders for 2 segments", async () => {
    const result = await renderRevenueBreakdownBar([
      { name: "Ferries", value: 100 },
      { name: "Cargo", value: 50 },
    ], tempDir);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("renders for 3+ segments", async () => {
    const result = await renderRevenueBreakdownBar([
      { name: "A", value: 100 },
      { name: "B", value: 200 },
      { name: "C", value: 300 },
    ], tempDir);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("Revenue donut thresholds", () => {
  it("returns empty string for 0 segments", async () => {
    const result = await renderRevenueDonut([], tempDir);
    expect(result).toBe("");
  });

  it("returns empty string for 1 segment", async () => {
    const result = await renderRevenueDonut([{ name: "All", value: 100 }], tempDir);
    expect(result).toBe("");
  });

  it("renders for 2+ segments", async () => {
    const result = await renderRevenueDonut([
      { name: "A", value: 60 },
      { name: "B", value: 40 },
    ], tempDir);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("Profitability trends thresholds", () => {
  it("returns empty string when fewer than 2 periods", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024"],
      revenue: [100],
    }, tempDir);
    expect(result).toBe("");
  });

  it("returns empty string when no series has ≥2 non-null values", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025"],
      revenue: [100, null],
      ebitda: [null, 50],
    }, tempDir);
    expect(result).toBe("");
  });

  it("renders when ≥2 periods and at least one series has ≥2 non-null values", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025"],
      revenue: [100, 120],
    }, tempDir);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("renders with multiple series where one meets threshold", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2024", "2025", "2026"],
      revenue: [100, null, null],
      ebitda: [50, 55, 60],
    }, tempDir);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("renders with a white JPEG background", async () => {
    const result = await renderProfitabilityTrends({
      periods: ["2022", "2023", "2024"],
      revenue: [98, 78, 0],
      ebitda: [6, 6.4, null],
      netProfit: [5, 5.0, null],
    }, tempDir);

    const color = await getPixelColor(result, 8, 8);
    expect(color.r).toBeGreaterThan(180);
    expect(color.g).toBeGreaterThan(180);
    expect(color.b).toBeGreaterThan(180);
  });
});
