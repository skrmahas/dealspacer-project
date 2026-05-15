"use client";

import * as React from "react";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export interface TrendLineChartProps {
  labels: string[];
  series: TrendSeries[];
  className?: string;
  /** Matches Baltic catalog / companies dark dashboards */
  surface?: "default" | "beiDark";
}

function formatTick(val: number): string {
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

export function TrendLineChart({
  labels,
  series,
  className,
  surface = "default",
}: TrendLineChartProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const chartRef = React.useRef<Chart | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  const visibleSeries = React.useMemo(
    () => series.filter((s) => !hidden.has(s.key)),
    [series, hidden],
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let chart: Chart | null = null;
    try {
      const datasets: ChartDataset<"line">[] = visibleSeries.map((s) => ({
        label: s.label,
        data: s.values.map((v) => (v == null ? Number.NaN : v)),
        borderColor: s.color,
        backgroundColor: s.color,
        spanGaps: true,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      }));

      const muted = "#6b7d92";
      const gridMinor = "rgba(255,255,255,0.06)";
      chart = new Chart(canvas, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor:
                surface === "beiDark" ? "rgba(12,16,24,0.96)" : "rgba(15,23,42,0.92)",
              titleColor: surface === "beiDark" ? "#e8ecf2" : "#f8fafc",
              bodyColor: surface === "beiDark" ? "#c5d0de" : "#e2e8f0",
              borderColor:
                surface === "beiDark" ? "rgba(43,121,219,0.35)" : "rgba(148,163,184,0.35)",
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.parsed.y);
                  return `${ctx.dataset.label}: ${formatTick(v)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks:
                surface === "beiDark"
                  ? {
                      color: muted,
                      font: { family: "IBM Plex Mono, ui-monospace, monospace", size: 10 },
                    }
                  : undefined,
            },
            y: {
              ticks: {
                callback: (v) => formatTick(Number(v)),
                ...(surface === "beiDark"
                  ? {
                      color: muted,
                      font: { family: "IBM Plex Mono, ui-monospace, monospace", size: 10 },
                    }
                  : {}),
              },
              grid: { color: surface === "beiDark" ? gridMinor : "rgba(120,120,140,0.12)" },
            },
          },
        },
      });
      chartRef.current = chart;
    } catch {
      // jsdom or canvas-less env — fall back to label-only rendering
    }
    return () => {
      chart?.destroy();
      chartRef.current = null;
    };
  }, [labels, visibleSeries, surface]);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="trend-line-chart">
      <div className="flex flex-wrap gap-2">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <Button
              key={s.key}
              size="sm"
              variant="outline"
              onClick={() => toggle(s.key)}
              className={cn(
                surface === "beiDark"
                  ? "h-7 rounded-none border-[#2a3544] bg-[#080b10] px-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#c5d0de] hover:border-[#3d4d62] hover:bg-[#2b79db]/10 hover:text-[#e8ecf2]"
                  : "h-7 rounded-full px-2.5 text-xs",
                off && "opacity-50",
              )}
              aria-pressed={!off}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              {s.label}
            </Button>
          );
        })}
      </div>
      <div className="relative h-72 w-full">
        <canvas ref={canvasRef} aria-label="Trend line chart" role="img" />
      </div>
    </div>
  );
}
