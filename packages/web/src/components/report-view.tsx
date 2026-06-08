"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Gauge,
  ScrollText,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { DonutChart, type DonutSegment } from "@/components/charts/donut-chart";
import { cn } from "@/lib/utils";
import type {
  ExtractedData,
  ExtractedMetric,
  ExtractedNarrative,
  ExtractedSentiment,
} from "@bei/shared";
import { inferCanonicalMetricId } from "@bei/shared/canonical-metrics";

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for rendering an extracted-report payload.
//
// Used by:
//   - /upload page (post-pipeline preview)
//   - /reports/[reportId] page (full report view)
//
// Any visual change to how extracted data is displayed should land here.
// ─────────────────────────────────────────────────────────────────────────────

export type ExtractedPayload = Partial<ExtractedData> & {
  metadata?: Partial<ExtractedData["metadata"]>;
  metrics?: ExtractedMetric[];
  narratives?: ExtractedNarrative[];
  sentiment?: ExtractedSentiment;
};

export const NARRATIVE_ORDER = [
  "executive_summary",
  "management_commentary",
  "business_overview",
  "segment_performance",
  "strategic_priorities",
  "outlook",
  "other",
] as const;

export const PRIORITY_KPI_LABELS = [
  "revenue",
  "ebitda",
  "net profit",
  "net income",
  "free cash flow",
  "operating profit",
];

const PRIORITY_KPI_IDS = ["revenue", "ebitda", "net_profit", "free_cash_flow"] as const;

export const GUIDANCE_STYLES: Record<string, { label: string; cls: string }> = {
  raised: {
    label: "Guidance raised",
    cls: "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  },
  maintained: {
    label: "Guidance maintained",
    cls: "border border-amber-400/35 bg-amber-500/10 text-amber-100",
  },
  lowered: {
    label: "Guidance lowered",
    cls: "border border-red-500/35 bg-red-500/10 text-red-200",
  },
};

const METRICS_TABLE_HEADER_CELL_CLASS =
  "whitespace-nowrap pb-3 pr-3 font-medium last:pr-0";
const METRICS_TABLE_VALUE_CELL_CLASS =
  "py-3 pr-3 font-[family-name:var(--font-mono)] text-base/6 tabular-nums sm:text-sm/6";

// ── Utilities ──────────────────────────────────────────────────────────────

export function parseExtractedJson(raw: string | null | undefined): ExtractedPayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExtractedPayload;
  } catch {
    return null;
  }
}

export function narrativeTitle(section: string): string {
  const map: Record<string, string> = {
    executive_summary: "Executive Summary",
    management_commentary: "Management Commentary",
    business_overview: "Business Overview",
    segment_performance: "Segment Performance",
    strategic_priorities: "Strategic Priorities",
    outlook: "Outlook",
    other: "Other Narrative Notes",
  };
  return (
    map[section] ??
    section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatMetricValue(metric: ExtractedMetric): string {
  const value = metric.normalizedValue ?? metric.value;
  if (value == null) return "—";
  const v = value;
  const abs = Math.abs(v);
  const unit = (metric.normalizedUnit ?? metric.unit)?.trim() ?? "";
  const isCurrency = /€|eur|usd|\$/i.test(unit);
  if (isCurrency) {
    if (abs >= 1e9) return `€${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `€${(v / 1e3).toFixed(0)}K`;
    return `€${v.toLocaleString()}`;
  }
  const num = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${num} ${unit}` : num;
}

function formatEvidenceMeta(metric: ExtractedMetric): string | null {
  const evidence = metric.evidence;
  if (!evidence) return null;
  const parts = [
    typeof evidence.confidence === "number" && Number.isFinite(evidence.confidence)
      ? `${Math.round(evidence.confidence * 100)}% confidence`
      : null,
    evidence.page ? `page ${evidence.page}` : null,
    evidence.chunkIndex != null ? `chunk ${evidence.chunkIndex + 1}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function pickKpis(metrics: ExtractedMetric[]): ExtractedMetric[] {
  const priority: ExtractedMetric[] = [];
  const seen = new Set<string>();
  for (const want of PRIORITY_KPI_IDS) {
    const m = metrics.find(
      (x) => (x.canonicalId ?? inferCanonicalMetricId(x.originalLabel ?? x.label)) === want,
    );
    if (m && !seen.has(m.label)) {
      priority.push(m);
      seen.add(m.label);
    }
    if (priority.length >= 4) break;
  }
  for (const want of PRIORITY_KPI_LABELS) {
    if (priority.length >= 4) break;
    const m = metrics.find((x) => x.label.toLowerCase().includes(want));
    if (m && !seen.has(m.label)) {
      priority.push(m);
      seen.add(m.label);
    }
    if (priority.length >= 4) break;
  }
  if (priority.length < 4) {
    for (const m of metrics) {
      if (priority.length >= 4) break;
      if (!seen.has(m.label) && m.value != null) {
        priority.push(m);
        seen.add(m.label);
      }
    }
  }
  return priority;
}

export function toneVisual(tone: string | undefined): {
  label: string;
  className: string;
  dot: string;
} {
  const t = (tone ?? "").toLowerCase();
  if (!t)
    return {
      label: "Not detected",
      className: "border-[#2a3544] bg-[#0c1018] text-[#6b7d92]",
      dot: "#5a6980",
    };
  if (t.includes("very positive"))
    return {
      label: tone!,
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      dot: "#6db88a",
    };
  if (t.includes("positive"))
    return {
      label: tone!,
      className: "border-emerald-500/30 bg-emerald-500/8 text-emerald-200/95",
      dot: "#6db88a",
    };
  if (t.includes("cautious") || t.includes("mixed"))
    return {
      label: tone!,
      className: "border-amber-400/35 bg-amber-500/10 text-amber-100",
      dot: "#d4a35a",
    };
  if (t.includes("negative"))
    return {
      label: tone!,
      className: "border-red-500/35 bg-red-500/10 text-red-200",
      dot: "#c97a6a",
    };
  return {
    label: tone!,
    className: "border-[#2b79db]/35 bg-[#2b79db]/10 text-[#b8d4f5]",
    dot: "#2b79db",
  };
}

export function selectDonutSegments(extracted: ExtractedPayload | null): {
  segments: DonutSegment[];
  kind: "segment" | "geography";
} {
  const bd = extracted?.revenueBreakdown;
  const source = bd?.bySegment ?? bd?.byGeography ?? [];
  const segments = source
    .filter((s) => Number.isFinite(s.value))
    .map((s) => ({ label: s.name, value: s.value }));
  const kind: "segment" | "geography" = bd?.bySegment ? "segment" : "geography";
  return { segments, kind };
}

// ── Reusable panel chrome ──────────────────────────────────────────────────

export function PanelFrame({
  icon: Icon,
  eyebrow,
  title,
  children,
  contentClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="relative w-full min-w-0 max-w-full border border-[#2a3544] bg-[#0c1018]/90">
      <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]" aria-hidden />
      <span className="pointer-events-none absolute -right-px -top-px block size-2 border-r border-t border-[#2b79db]" aria-hidden />
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2733] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center border border-[#2a3544] bg-[#080b10] text-[#2b79db]">
            <Icon className="size-3.5" />
          </span>
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">
              {eyebrow}
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-base font-medium tracking-tight text-[#f4f6f9]">
              {title}
            </h2>
          </div>
        </div>
      </header>
      <div className={cn("min-w-0 p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}

// ── KPI strip ──────────────────────────────────────────────────────────────

export function KpiStrip({ kpis }: { kpis: ExtractedMetric[] }) {
  return (
    <div className="grid gap-px border border-[#2a3544] bg-[#2a3544] sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((m, i) => (
        <motion.div
          key={`${m.label}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.4 }}
          className="relative overflow-hidden bg-[#0c1018] px-5 py-4"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7"][i % 4],
            }}
          />
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7d92]">
            {m.label}
          </p>
          <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-medium tabular-nums tracking-tight text-[#f4f6f9] sm:text-[1.65rem]">
            {formatMetricValue(m)}
          </div>
          {m.period && (
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#5a8f8f]">
              {m.period}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── Sentiment ──────────────────────────────────────────────────────────────

export function SentimentPanel({ sentiment }: { sentiment: ExtractedSentiment }) {
  const tone = toneVisual(sentiment.managementTone);
  const guidance = sentiment.guidanceDirection
    ? GUIDANCE_STYLES[sentiment.guidanceDirection]
    : null;
  return (
    <PanelFrame
      icon={Gauge}
      eyebrow="Narrative signals"
      title="Management Sentiment"
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]",
              tone.className,
            )}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: tone.dot }}
              aria-hidden
            />
            Tone · {tone.label}
          </span>
          {guidance && (
            <span
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]",
                guidance.cls,
              )}
            >
              <Sparkles className="size-3" />
              {guidance.label}
            </span>
          )}
        </div>

        {sentiment.outlook ? (
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#5a8f8f]">
              Outlook
            </p>
            <p className="mt-2 font-[family-name:var(--font-body)] text-[15px] leading-[1.65] text-[#c5d0de]">
              {sentiment.outlook}
            </p>
          </div>
        ) : (
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[#6b7d92]">
            No outlook statement extracted.
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="size-3.5 text-[#c97a6a]" />
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#5a8f8f]">
              Risk factors
            </p>
          </div>
          {sentiment.riskFactors && sentiment.riskFactors.length > 0 ? (
            <ul className="grid gap-1.5">
              {sentiment.riskFactors.map((risk, i) => (
                <li
                  key={`${risk}-${i}`}
                  className="flex gap-3 border-l border-[#9e4a5a]/40 pl-3 text-sm leading-relaxed text-[#c5d0de]"
                >
                  <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-[#9e4a5a]" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[#6b7d92]">
              No risks flagged.
            </p>
          )}
        </div>
      </div>
    </PanelFrame>
  );
}

// ── Revenue breakdown ──────────────────────────────────────────────────────

export function BreakdownPanel({
  segments,
  kind,
}: {
  segments: DonutSegment[];
  kind: "segment" | "geography";
}) {
  return (
    <PanelFrame
      icon={Sparkles}
      eyebrow={kind === "segment" ? "Revenue by segment" : "Revenue by geography"}
      title="Composition"
    >
      <DonutChart segments={segments} surface="beiDark" />
    </PanelFrame>
  );
}

// ── Secondary metrics table ────────────────────────────────────────────────

export function MetricsTablePanel({ metrics }: { metrics: ExtractedMetric[] }) {
  return (
    <PanelFrame
      icon={ScrollText}
      eyebrow="Additional figures"
      title="All Extracted Metrics"
    >
      <div className="-mx-4 -my-2 overflow-x-auto overscroll-x-contain whitespace-nowrap sm:-mx-5">
        <div className="inline-block min-w-full px-4 py-2 align-middle sm:px-5">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="font-[family-name:var(--font-mono)] text-left text-xs/5 tracking-[0.02em] text-[#5a8f8f] sm:text-[11px]">
                <th className={METRICS_TABLE_HEADER_CELL_CLASS}>Metric</th>
                <th className={METRICS_TABLE_HEADER_CELL_CLASS}>Period</th>
                <th className={cn(METRICS_TABLE_HEADER_CELL_CLASS, "pl-3 text-right")}>Value</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const evidenceMeta = formatEvidenceMeta(m);
                return (
                  <tr
                    key={`${m.label}-${i}`}
                    className="border-t border-[#1e2733]/80"
                  >
                    <td className="max-w-[22rem] py-3 pr-3 text-base/6 text-[#e8ecf2] sm:text-sm/6">
                      <span className="block text-base/6 sm:text-sm/6">{m.label}</span>
                      {(evidenceMeta || m.evidence?.snippet) && (
                        <span className="mt-1 block whitespace-normal text-xs/5 text-[#8b9aad]">
                          {evidenceMeta && (
                            <span className="block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#5a8f8f]">
                              {evidenceMeta}
                            </span>
                          )}
                          {m.evidence?.snippet}
                        </span>
                      )}
                    </td>
                    <td className={cn(METRICS_TABLE_VALUE_CELL_CLASS, "text-[#6b7d92]")}>
                      {m.period ?? "—"}
                    </td>
                    <td
                      className={cn(
                        METRICS_TABLE_VALUE_CELL_CLASS,
                        "pl-3 pr-0 text-right text-[#b8d4f5]",
                      )}
                    >
                      {formatMetricValue(m)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PanelFrame>
  );
}

// ── Editorial narrative (drop-cap on lead) ─────────────────────────────────

export function NarrativeEditorial({
  narratives,
}: {
  narratives: ExtractedNarrative[];
}) {
  const ordered = [
    ...NARRATIVE_ORDER.map((s) =>
      narratives.find((n) => n.section === s),
    ).filter(Boolean),
    ...narratives.filter(
      (n) =>
        !NARRATIVE_ORDER.includes(
          n.section as (typeof NARRATIVE_ORDER)[number],
        ),
    ),
  ] as ExtractedNarrative[];

  return (
    <PanelFrame
      icon={ScrollText}
      eyebrow="Filing in prose"
      title="Editorial Brief"
      contentClassName="p-0 sm:p-0"
    >
      <div className="divide-y divide-[#1e2733]/80">
        {ordered.map((n, idx) => {
          const text = n.text?.trim();
          if (!text) return null;
          const isLead = idx === 0;
          const firstChar = text[0];
          const restOfFirstWord = text.slice(1).match(/^\S*/)?.[0] ?? "";
          const remainder = text.slice(1 + restOfFirstWord.length);
          return (
            <article key={n.section} className="px-6 py-8 sm:px-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-[#f4f6f9] sm:text-2xl">
                  {narrativeTitle(n.section)}
                </h3>
                <span className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums uppercase tracking-[0.18em] text-[#5a8f8f]">
                  §{String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="mt-4 max-w-prose font-[family-name:var(--font-body)] text-[15px] leading-[1.75] text-[#c5d0de]">
                {isLead ? (
                  <p>
                    <span className="float-left mr-2 mt-1 font-[family-name:var(--font-display)] text-[3.4rem] font-medium leading-[0.85] text-[#2b79db]">
                      {firstChar}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.12em] text-[#e8ecf2]">
                      {restOfFirstWord}
                    </span>
                    {remainder}
                  </p>
                ) : (
                  <p>{text}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </PanelFrame>
  );
}

export function EmptyNarratives() {
  return (
    <PanelFrame icon={ScrollText} eyebrow="Filing in prose" title="Editorial Brief">
      <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-[#8b9aad]">
        No narrative sections were extracted from this filing. The source PDF is
        still available above.
      </p>
    </PanelFrame>
  );
}

// ── High-level composition for the upload-page preview ─────────────────────
// A condensed, single-column preview that mirrors the polished /reports/[id]
// layout but skips the source-PDF embed (the raw file already lives in the
// pipeline status panel above).

export function ReportPreview({
  extracted,
}: {
  extracted: ExtractedPayload | null;
}) {
  if (!extracted) {
    return (
      <div className="border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-4 py-3 text-sm text-[#e8a0a8]">
        Could not parse extracted report data.
      </div>
    );
  }

  const metrics = extracted.metrics ?? [];
  const narratives = extracted.narratives ?? [];
  const sentiment = extracted.sentiment;
  const kpis = pickKpis(metrics);
  const otherMetrics = metrics.filter((m) => !kpis.includes(m));
  const { segments, kind } = selectDonutSegments(extracted);

  const companyName = extracted.metadata?.companyName?.trim();
  const reportPeriod = extracted.metadata?.reportPeriod?.trim();

  return (
    <div className="grid min-w-0 gap-6">
      {(companyName || reportPeriod) && (
        <section className="border border-[#2a3544] bg-[#0c1018]/90 px-5 py-4">
          {companyName && (
            <h3 className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-[#f4f6f9]">
              {companyName}
            </h3>
          )}
          {reportPeriod && (
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
              {reportPeriod}
            </p>
          )}
        </section>
      )}

      {kpis.length > 0 && <KpiStrip kpis={kpis} />}

      {sentiment && <SentimentPanel sentiment={sentiment} />}

      {segments.length > 0 && <BreakdownPanel segments={segments} kind={kind} />}

      {otherMetrics.length > 0 && <MetricsTablePanel metrics={otherMetrics} />}

      {narratives.length > 0 ? (
        <NarrativeEditorial narratives={narratives} />
      ) : (
        <EmptyNarratives />
      )}
    </div>
  );
}
