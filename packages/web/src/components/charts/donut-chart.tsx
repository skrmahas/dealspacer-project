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
  /** Matches Baltic catalog / companies dark dashboards */
  surface?: "default" | "beiDark";
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

export function DonutChart({
  segments,
  className,
  title,
  surface = "default",
}: DonutChartProps) {
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
              backgroundColor:
                surface === "beiDark" ? "rgba(12,16,24,0.96)" : "rgba(15,23,42,0.92)",
              titleColor: surface === "beiDark" ? "#e8ecf2" : "#f8fafc",
              bodyColor: surface === "beiDark" ? "#c5d0de" : "#e2e8f0",
              borderColor:
                surface === "beiDark" ? "rgba(43,121,219,0.35)" : "rgba(148,163,184,0.35)",
              borderWidth: 1,
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
  }, [segments, colors, surface]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 md:flex-row md:items-center", className)} data-testid="donut-chart">
      <div className="relative size-56 shrink-0 max-w-full">
        <canvas
          ref={canvasRef}
          aria-label={title ? `${title} donut chart` : "Donut chart"}
          role="img"
        />
      </div>
      <ul className={cn("min-w-0 flex-1 grid gap-2 text-sm", surface === "beiDark" && "font-[family-name:var(--font-body)]")}>
        {segments.map((s, i) => (
          <li key={s.label} className="flex min-w-0 items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: colors[i] }}
                aria-hidden
              />
              <span
                className={cn(
                  "truncate",
                  surface === "beiDark" ? "text-[#c5d0de]" : "text-foreground",
                )}
              >
                {s.label}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap tabular-nums",
                surface === "beiDark"
                  ? "font-[family-name:var(--font-mono)] text-xs font-medium text-[#e8ecf2]"
                  : "font-semibold text-foreground",
              )}
            >
              {fmt(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
