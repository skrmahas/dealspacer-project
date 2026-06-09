import { Chart, ChartConfiguration, Plugin, registerables } from "chart.js";
import { createCanvas, Canvas, CanvasRenderingContext2D } from "canvas";
import type { ExtractedMetric, RevenueBreakdown, ProfitabilityTrends } from "@bei/shared";

// Register all chart.js components
Chart.register(...registerables);

const whiteCanvasBackgroundPlugin: Plugin = {
  id: "white-canvas-background",
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// ── Canvas setup helpers ────────────────────────────────────────────────────

interface ChartCanvas {
  canvas: Canvas;
  ctx: CanvasRenderingContext2D;
}

function makeCanvas(width: number, height: number): ChartCanvas {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

async function renderChartToFile(
  config: ChartConfiguration,
  width: number,
  height: number,
  _tempDir: string,
  _filename: string,
): Promise<string> {
  const { canvas } = makeCanvas(width, height);
  const chartConfig: ChartConfiguration = {
    ...config,
    plugins: [whiteCanvasBackgroundPlugin, ...(config.plugins ?? [])],
  };

  // chart.js needs the canvas element to be cast-friendly
  const chart = new Chart(canvas as unknown as HTMLCanvasElement, chartConfig);
  // Force synchronous rendering (Chart.js v4 renders synchronously by default)
  const buffer = canvas.toBuffer("image/jpeg", { quality: 0.85 });
  chart.destroy();

  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

// ── Sparkline ───────────────────────────────────────────────────────────────

export async function renderSparkline(
  values: (number | null)[],
  tempDir: string,
  filename: string,
  width = 160,
  height = 28,
): Promise<string> {
  // Filter out nulls and fill gaps with nearest neighbor for visual continuity
  const cleanValues = cleanSeries(values);
  if (cleanValues.length < 3) {
    console.warn(`[chart-renderer] Skipping sparkline: only ${cleanValues.length} non-null value(s), need ≥3`);
    return "";
  }

  const labels = cleanValues.map((_, i) => String(i));
  const min = Math.min(...cleanValues) * 0.95;
  const max = Math.max(...cleanValues) * 1.05;

  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: cleanValues,
          borderColor: "#2b79db",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: { display: false },
        y: { display: false, min, max },
      },
    },
  };

  return renderChartToFile(config, width, height, tempDir, filename);
}

// ── Revenue Breakdown: Bar chart ────────────────────────────────────────────

export async function renderRevenueBreakdownBar(
  segments: { name: string; value: number }[],
  tempDir: string,
  width = 440,
  height = 240,
): Promise<string> {
  if (segments.length < 2) {
    console.warn(`[chart-renderer] Skipping revenue breakdown bar chart: only ${segments.length} segment(s), need ≥2`);
    return "";
  }

  const colors = [
    "#2b79db", "#1a5ca8", "#3d82d0", "#5b9fe8",
    "#66BBEE", "#99CCFF", "#336699", "#1A5276",
  ];

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: segments.map((s) => s.name),
      datasets: [
        {
          label: "Revenue",
          data: segments.map((s) => s.value),
          backgroundColor: segments.map((_, i) => colors[i % colors.length]),
          borderColor: segments.map((_, i) => colors[i % colors.length]),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 11 }, color: "#333" },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { size: 10 },
            color: "#666",
            callback: (val) => formatAxisValue(val as number),
          },
          grid: { color: "#e5e5e5" },
        },
      },
    },
  };

  return renderChartToFile(config, width, height, tempDir, "revenue-bar.jpg");
}

// ── Revenue Breakdown: Donut chart ──────────────────────────────────────────

export async function renderRevenueDonut(
  segments: { name: string; value: number }[],
  tempDir: string,
  width = 360,
  height = 240,
): Promise<string> {
  if (segments.length < 2) {
    console.warn(`[chart-renderer] Skipping revenue donut chart: only ${segments.length} segment(s), need ≥2`);
    return "";
  }

  const colors = [
    "#2b79db", "#1a5ca8", "#3d82d0", "#5b9fe8",
    "#66BBEE", "#99CCFF", "#336699", "#1A5276",
  ];

  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: segments.map((s) => s.name),
      datasets: [
        {
          data: segments.map((s) => s.value),
          backgroundColor: segments.map((_, i) => colors[i % colors.length]),
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            font: { size: 10 },
            color: "#333",
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: { enabled: false },
      },
    },
  };

  return renderChartToFile(config, width, height, tempDir, "revenue-donut.jpg");
}

// ── Profitability Trends ────────────────────────────────────────────────────

export async function renderProfitabilityTrends(
  trends: ProfitabilityTrends,
  tempDir: string,
  width = 480,
  height = 240,
): Promise<string> {
  // Require ≥2 periods
  if (trends.periods.length < 2) {
    console.warn(`[chart-renderer] Skipping profitability chart: only ${trends.periods.length} period(s), need ≥2`);
    return "";
  }

  const datasets: {
    label: string;
    data: (number | null)[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    pointRadius: number;
    tension: number;
    fill: boolean;
  }[] = [];

  if (trends.revenue && trends.revenue.some((v) => v != null)) {
    datasets.push({
      label: "Revenue",
      data: trends.revenue,
      borderColor: "#2b79db",
      backgroundColor: "rgba(0, 51, 102, 0.1)",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.2,
      fill: false,
    });
  }
  if (trends.ebitda && trends.ebitda.some((v) => v != null)) {
    datasets.push({
      label: "EBITDA",
      data: trends.ebitda,
      borderColor: "#3d82d0",
      backgroundColor: "rgba(0, 119, 204, 0.1)",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.2,
      fill: false,
    });
  }
  if (trends.netProfit && trends.netProfit.some((v) => v != null)) {
    datasets.push({
      label: "Net Profit",
      data: trends.netProfit,
      borderColor: "#5b9fe8",
      backgroundColor: "rgba(51, 153, 221, 0.1)",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.2,
      fill: false,
    });
  }

  if (datasets.length === 0) return "";

  // Require at least one series with ≥2 non-null values
  const hasValidSeries = datasets.some(
    (ds) => ds.data.filter((v) => v != null).length >= 2
  );
  if (!hasValidSeries) {
    console.warn("[chart-renderer] Skipping profitability chart: no series has ≥2 non-null values");
    return "";
  }

  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels: trends.periods,
      datasets,
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 11 },
            color: "#333",
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, color: "#666" },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { size: 10 },
            color: "#666",
            callback: (val) => formatAxisValue(val as number),
          },
          grid: { color: "#e5e5e5" },
        },
      },
    },
  };

  return renderChartToFile(config, width, height, tempDir, "profitability-trends.jpg");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanSeries(values: (number | null)[]): number[] {
  const result: number[] = [];
  let lastValid: number | null = null;

  for (const v of values) {
    if (v != null) {
      result.push(v);
      lastValid = v;
    } else if (lastValid != null) {
      result.push(lastValid);
    }
  }

  return result;
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return String(value);
}

// ── YoY change calculation ─────────────────────────────────────────────────

/** Compute YoY change percentage from two-period trend data, if available. */
export function computeYoYChange(
  metricLabel: string,
  trends?: ProfitabilityTrends,
): number | null {
  if (!trends || trends.periods.length < 2) return null;

  const series = getTrendSeries(metricLabel, trends);
  if (!series) return null;

  // Find last two non-null values
  const valid: number[] = [];
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) valid.unshift(series[i]!);
    if (valid.length >= 2) break;
  }

  if (valid.length < 2 || valid[0] === 0) return null;
  return ((valid[1] - valid[0]) / Math.abs(valid[0])) * 100;
}

function getTrendSeries(
  label: string,
  trends: ProfitabilityTrends,
): (number | null)[] | null {
  const lower = label.toLowerCase();
  if (lower.includes("revenue")) return trends.revenue ?? null;
  if (lower.includes("ebitda")) return trends.ebitda ?? null;
  if (lower.includes("net profit") || lower.includes("net income"))
    return trends.netProfit ?? null;
  return null;
}

// ── Combined renderer for the assembler ─────────────────────────────────────

export interface ChartImages {
  sparklines: Map<string, string>; // metric label → embeddable image src
  yoyChanges: Map<string, number | null>; // metric label → YoY %
  revenueBarChart: string;     // embeddable image src or ""
  revenueDonutChart: string;   // embeddable image src or ""
  profitabilityChart: string;  // embeddable image src or ""
}

export async function renderAllCharts(
  metrics: ExtractedMetric[],
  tempDir: string,
  revenueBreakdown?: RevenueBreakdown,
  profitabilityTrends?: ProfitabilityTrends,
): Promise<ChartImages> {
  const result: ChartImages = {
    sparklines: new Map(),
    yoyChanges: new Map(),
    revenueBarChart: "",
    revenueDonutChart: "",
    profitabilityChart: "",
  };

  // Sparklines + YoY per key metric — rendered in parallel
  const keyMetrics = metrics.filter((m) => {
    const label = m.label.toLowerCase();
    return (
      label.includes("revenue") ||
      label.includes("ebitda") ||
      label.includes("net profit") ||
      label.includes("net income") ||
      label.includes("operating profit") ||
      label.includes("eps")
    );
  });

  // Compute YoY changes (sync)
  for (const m of keyMetrics) {
    const yoy = computeYoYChange(m.label, profitabilityTrends);
    result.yoyChanges.set(m.label, yoy);
  }

  // Collect all sparkline render promises for parallel execution
  const sparklinePromises: Promise<void>[] = [];
  for (const m of keyMetrics) {
    if (profitabilityTrends) {
      const series = getTrendSeries(m.label, profitabilityTrends);
      if (series && series.some((v) => v != null)) {
        const slug = m.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const filename = `sparkline-${slug}.jpg`;
        sparklinePromises.push(
          renderSparkline(series, tempDir, filename).then((url) => {
            if (url) result.sparklines.set(m.label, url);
          }),
        );
      }
    }
  }

  // Parallel: revenue charts + sparklines
  const revenuePromise = (async () => {
    if (revenueBreakdown?.bySegment && revenueBreakdown.bySegment.length > 0) {
      result.revenueBarChart =
        await renderRevenueBreakdownBar(revenueBreakdown.bySegment, tempDir);
      result.revenueDonutChart =
        await renderRevenueDonut(revenueBreakdown.bySegment, tempDir);
    } else if (
      revenueBreakdown?.byGeography &&
      revenueBreakdown.byGeography.length > 0
    ) {
      result.revenueBarChart = await renderRevenueBreakdownBar(
        revenueBreakdown.byGeography,
        tempDir,
      );
      result.revenueDonutChart = await renderRevenueDonut(
        revenueBreakdown.byGeography,
        tempDir,
      );
    }
  })();

  const profitabilityPromise = (async () => {
    if (
      profitabilityTrends &&
      profitabilityTrends.periods.length >= 2 &&
      (profitabilityTrends.revenue?.some((v) => v != null) ||
        profitabilityTrends.ebitda?.some((v) => v != null) ||
        profitabilityTrends.netProfit?.some((v) => v != null))
    ) {
      result.profitabilityChart =
        await renderProfitabilityTrends(profitabilityTrends, tempDir);
    }
  })();

  await Promise.all([...sparklinePromises, revenuePromise, profitabilityPromise]);

  return result;
}
