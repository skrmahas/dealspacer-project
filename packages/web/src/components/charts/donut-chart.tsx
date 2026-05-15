"use client";

import * as React from "react";
import Chart from "chart.js/auto";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  className?: string;
  title?: string;
}

const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#eab308",
  "#f472b6",
];

function fmt(val: number): string {
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

export function DonutChart({ segments, className, title }: DonutChartProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const chartRef = React.useRef<Chart | null>(null);

  const colors = React.useMemo(
    () => segments.map((_, i) => PALETTE[i % PALETTE.length]),
    [segments],
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;
    let chart: Chart | null = null;
    try {
      chart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: segments.map((s) => s.label),
          datasets: [
            {
              data: segments.map((s) => s.value),
              backgroundColor: colors,
              borderColor: "transparent",
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${fmt(Number(ctx.raw))}`,
              },
            },
          },
        },
      });
      chartRef.current = chart;
    } catch {
      // jsdom safety
    }
    return () => {
      chart?.destroy();
      chartRef.current = null;
    };
  }, [segments, colors]);

  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center", className)} data-testid="donut-chart">
      <div className="relative size-56 max-w-full">
        <canvas
          ref={canvasRef}
          aria-label={title ? `${title} donut chart` : "Donut chart"}
          role="img"
        />
      </div>
      <ul className="flex-1 grid gap-2 text-sm">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 truncate">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: colors[i] }}
                aria-hidden
              />
              <span className="truncate text-foreground">{s.label}</span>
            </span>
            <span className="font-semibold text-foreground">{fmt(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
