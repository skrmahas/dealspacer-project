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
}

function formatTick(val: number): string {
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

export function TrendLineChart({ labels, series, className }: TrendLineChartProps) {
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
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.parsed.y);
                  return `${ctx.dataset.label}: ${formatTick(v)}`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              ticks: { callback: (v) => formatTick(Number(v)) },
              grid: { color: "rgba(120,120,140,0.12)" },
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
  }, [labels, visibleSeries]);

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
                "h-7 rounded-full px-2.5 text-xs",
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
