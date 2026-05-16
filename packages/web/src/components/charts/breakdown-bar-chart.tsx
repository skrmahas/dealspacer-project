"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BreakdownSegment {
  label: string;
  value: number;
}

export interface BreakdownBarChartProps {
  segments: BreakdownSegment[];
  className?: string;
  title?: string;
  /** Matches Baltic catalog / companies dark dashboards */
  surface?: "default" | "beiDark";
}

// Compact currency formatter — €1.2B / €15M / €198K / €42
function fmtCurrency(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e9) return `€${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `€${(val / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val.toLocaleString()}`;
}

function fmtPct(val: number): string {
  if (val >= 10) return `${val.toFixed(1)}%`;
  return `${val.toFixed(2)}%`;
}

// Rank-based color treatment. Top streams get full brand saturation;
// the long tail fades into a muted teal so the eye lands on what matters.
function rankColor(rank: number, total: number): { bar: string; tint: string; chip: string } {
  if (rank === 0) {
    return {
      bar: "linear-gradient(90deg, #4f9bff 0%, #2b79db 55%, rgba(43,121,219,0.45) 100%)",
      tint: "#4f9bff",
      chip: "#2b79db",
    };
  }
  if (rank <= 2) {
    return {
      bar: "linear-gradient(90deg, #2b79db 0%, #1f5fb0 60%, rgba(31,95,176,0.35) 100%)",
      tint: "#2b79db",
      chip: "#2b79db",
    };
  }
  // long tail: cooler / dimmer the further down it goes
  const fade = Math.max(0.35, 1 - (rank - 2) / Math.max(total - 2, 1));
  return {
    bar: `linear-gradient(90deg, rgba(90,143,143,${0.55 + fade * 0.25}) 0%, rgba(90,143,143,${0.35 + fade * 0.2}) 65%, rgba(90,143,143,0.1) 100%)`,
    tint: "#5a8f8f",
    chip: "#3d6f6f",
  };
}

export function BreakdownBarChart({
  segments,
  className,
  title,
  surface = "default",
}: BreakdownBarChartProps) {
  const dark = surface === "beiDark";

  // Sort descending by absolute value; preserve original index for stable keys
  const ranked = React.useMemo(() => {
    return segments
      .map((s, originalIndex) => ({ ...s, originalIndex }))
      .filter((s) => Number.isFinite(s.value))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [segments]);

  const total = React.useMemo(
    () => ranked.reduce((acc, s) => acc + Math.abs(s.value), 0),
    [ranked],
  );

  // The bars are normalized against the *largest* stream, not the total.
  // This keeps visual signal even when one segment dominates by an order of magnitude.
  const maxValue = ranked[0]?.value ?? 0;

  const top3Share = React.useMemo(() => {
    if (!total) return 0;
    const slice = ranked.slice(0, Math.min(3, ranked.length));
    const sum = slice.reduce((acc, s) => acc + Math.abs(s.value), 0);
    return (sum / total) * 100;
  }, [ranked, total]);

  if (ranked.length === 0) {
    return (
      <div
        className={cn(
          "border border-dashed px-5 py-6 text-center",
          dark
            ? "border-[#2a3544] bg-[#0c1018]/60 text-[#6b7d92]"
            : "border-slate-200 bg-slate-50 text-slate-500",
          className,
        )}
        data-testid="breakdown-bar-chart"
      >
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]">
          No breakdown data
        </p>
      </div>
    );
  }

  const top = ranked[0];
  const topShare = total ? (Math.abs(top.value) / total) * 100 : 0;

  return (
    <div
      className={cn("flex flex-col gap-5", className)}
      data-testid="breakdown-bar-chart"
      role="img"
      aria-label={title ? `${title} bar chart` : "Revenue breakdown bar chart"}
    >
      {/* ── Header strip: the actual story above the chart ─────────────────── */}
      <div
        className={cn(
          "grid grid-cols-1 gap-px overflow-hidden border sm:grid-cols-3",
          dark ? "border-[#2a3544] bg-[#2a3544]" : "border-slate-200 bg-slate-200",
        )}
      >
        <HeaderCell
          dark={dark}
          eyebrow="Total"
          value={fmtCurrency(total)}
          accent="#2b79db"
        />
        <HeaderCell
          dark={dark}
          eyebrow="Top stream"
          value={top.label}
          secondary={`${fmtPct(topShare)} share`}
          accent={rankColor(0, ranked.length).tint}
          truncate
        />
        <HeaderCell
          dark={dark}
          eyebrow={`Top ${Math.min(3, ranked.length)} concentration`}
          value={fmtPct(top3Share)}
          secondary={`${ranked.length} streams tracked`}
          accent="#5a8f8f"
        />
      </div>

      {/* ── Scale axis ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex justify-between border-b pb-1 pl-[88px] pr-[112px] font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em]",
          dark ? "border-[#1d2633] text-[#3d4d62]" : "border-slate-200 text-slate-400",
        )}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <span key={tick} className="tabular-nums">
            {tick === 0 ? "0" : `${tick}%`}
          </span>
        ))}
      </div>

      {/* ── Bars ───────────────────────────────────────────────────────────── */}
      <ol className="flex flex-col gap-3">
        {ranked.map((s, idx) => {
          const color = rankColor(idx, ranked.length);
          const dominance = maxValue > 0 ? (Math.abs(s.value) / Math.abs(maxValue)) * 100 : 0;
          const share = total > 0 ? (Math.abs(s.value) / total) * 100 : 0;
          const isLead = idx === 0;

          return (
            <motion.li
              key={`${s.label}-${s.originalIndex}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.04 * idx,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "group relative grid grid-cols-[60px_minmax(0,1fr)_96px] items-center gap-x-3 border-l-[2px] py-2 pl-3 pr-1 transition-colors",
                dark
                  ? "border-l-transparent hover:border-l-[#2b79db]/70 hover:bg-[#0c1018]/60"
                  : "border-l-transparent hover:border-l-blue-500/60 hover:bg-slate-50",
              )}
            >
              {/* index + share */}
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] text-[10px] tabular-nums tracking-[0.16em]",
                    isLead
                      ? dark
                        ? "text-[#4f9bff]"
                        : "text-blue-600"
                      : dark
                        ? "text-[#3d4d62]"
                        : "text-slate-400",
                  )}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] text-[9px] tabular-nums tracking-[0.1em]",
                    dark ? "text-[#5a6980]" : "text-slate-400",
                  )}
                >
                  {fmtPct(share)}
                </span>
              </div>

              {/* label + bar */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 shrink-0",
                      isLead && "size-2 ring-2",
                    )}
                    style={{
                      background: color.chip,
                      boxShadow: isLead ? `0 0 0 1px ${color.chip}` : undefined,
                    }}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "truncate font-[family-name:var(--font-body)] text-[13px]",
                      isLead
                        ? dark
                          ? "font-medium text-[#f4f6f9]"
                          : "font-semibold text-slate-900"
                        : dark
                          ? "text-[#c5d0de]"
                          : "text-slate-700",
                    )}
                    title={s.label}
                  >
                    {s.label}
                  </span>
                  {isLead && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 border px-1.5 py-px font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em]",
                        dark
                          ? "border-[#2b79db]/40 bg-[#2b79db]/10 text-[#4f9bff]"
                          : "border-blue-500/30 bg-blue-50 text-blue-700",
                      )}
                    >
                      Lead
                    </span>
                  )}
                </div>

                {/* Bar rail + fill */}
                <div
                  className={cn(
                    "relative h-2.5 w-full overflow-hidden",
                    dark ? "bg-[#0e1320]" : "bg-slate-100",
                  )}
                >
                  {/* gridlines inside rail */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: dark
                        ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 25%)"
                        : "repeating-linear-gradient(90deg, rgba(15,23,42,0.05) 0 1px, transparent 1px 25%)",
                    }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, dominance))}%` }}
                    transition={{
                      duration: 0.9,
                      delay: 0.05 * idx + 0.1,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative h-full"
                    style={{ background: color.bar }}
                  >
                    {/* leading edge accent */}
                    <span
                      aria-hidden
                      className="absolute right-0 top-0 h-full w-px"
                      style={{
                        background: color.tint,
                        boxShadow: `0 0 6px ${color.tint}`,
                      }}
                    />
                  </motion.div>
                </div>
              </div>

              {/* value */}
              <div className="flex flex-col items-end">
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] text-[13px] tabular-nums",
                    isLead
                      ? dark
                        ? "font-medium text-[#f4f6f9]"
                        : "font-semibold text-slate-900"
                      : dark
                        ? "text-[#e8ecf2]"
                        : "text-slate-800",
                  )}
                >
                  {fmtCurrency(s.value)}
                </span>
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] text-[9px] uppercase tabular-nums tracking-[0.14em]",
                    dark ? "text-[#5a6980]" : "text-slate-400",
                  )}
                >
                  vs lead {fmtPct(dominance)}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function HeaderCell({
  dark,
  eyebrow,
  value,
  secondary,
  accent,
  truncate,
}: {
  dark: boolean;
  eyebrow: string;
  value: string;
  secondary?: string;
  accent: string;
  truncate?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 px-4 py-3",
        dark ? "bg-[#0c1018]" : "bg-white",
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: accent }}
      />
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.22em]",
          dark ? "text-[#5a8f8f]" : "text-slate-500",
        )}
      >
        {eyebrow}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-display)] text-lg font-medium leading-tight tracking-tight",
          truncate && "truncate",
          dark ? "text-[#f4f6f9]" : "text-slate-900",
        )}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
      {secondary && (
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-[10px] tabular-nums tracking-[0.1em]",
            dark ? "text-[#8b9aad]" : "text-slate-500",
          )}
        >
          {secondary}
        </span>
      )}
    </div>
  );
}
