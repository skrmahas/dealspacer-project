"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Scale,
  Swords,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ExtractedData, Report } from "@bei/shared";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { BreakdownBarChart } from "@/components/charts/breakdown-bar-chart";
import { AppSiteHeader } from "@/components/app-site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  REPORT_TYPE_LABEL,
  buildMetricsMap,
  buildOverlayTrendSeries,
  computeWeightedComparison,
  displayName,
  fmtCurrency,
  formatDelta,
  isHigherBetter,
  isPillarMetric,
  pickBreakdownSegments,
  sortMetricEntries,
} from "@/lib/compare-utils";

const GUIDANCE_STYLES: Record<string, string> = {
  raised: "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  maintained: "border border-amber-400/35 bg-amber-500/10 text-amber-100",
  lowered: "border border-red-500/35 bg-red-500/10 text-red-200",
};

const METRICS_HEADER_CELL_CLASS =
  "whitespace-nowrap pb-3 pr-4 font-medium last:pr-0";
const METRICS_VALUE_CELL_CLASS =
  "py-3.5 pr-4 align-middle font-[family-name:var(--font-mono)] text-base/6 tabular-nums sm:text-[13px]";
const compareNavLinkClassName =
  "inline-flex min-h-11 items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] transition sm:min-h-0 sm:text-[10px]";
const compareNavIconClassName = "size-4 shrink-0 sm:size-3.5";

type CompareClientProps = {
  initialReportA: string | null;
  initialReportB: string | null;
};

function BeiShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative min-h-screen bg-[#080b10] text-[#e8ecf2]",
        "font-[family-name:var(--font-body)]",
      )}
    >
      <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="landing-aurora pointer-events-none fixed inset-0 z-0 opacity-70" aria-hidden />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function DashboardSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border border-[#2a3544] bg-[#0c1018]/90">
      <span
        className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]"
        aria-hidden
      />
      <div className="border-b border-[#1e2733] px-5 py-4">
        {eyebrow && (
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[#f4f6f9]">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ReportPillar({
  side,
  name,
  fiscalYear,
  reportType,
  language,
  reportId,
  guidance,
}: {
  side: "A" | "B";
  name: string;
  fiscalYear: number;
  reportType: string;
  language: string;
  reportId: string;
  guidance?: string | null;
}) {
  const accent = side === "A" ? "#2b79db" : "#5a8f8f";
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col gap-3 border bg-[#0c1018]/80 p-5 sm:p-6",
        side === "A" ? "border-[#2b79db]/30" : "border-[#5a8f8f]/30",
      )}
    >
      <span
        className="absolute -left-px top-4 h-10 w-[2px]"
        style={{ background: accent }}
        aria-hidden
      />
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[#6b7d92]">
        Report {side}
      </p>
      <h3 className="font-[family-name:var(--font-display)] text-[clamp(1.1rem,2.5vw,1.65rem)] font-medium leading-tight tracking-tight text-[#f4f6f9]">
        {name}
      </h3>
      <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[#8b9aad]">
        {fiscalYear} · {REPORT_TYPE_LABEL[reportType] || reportType} · {language.toUpperCase()}
      </p>
      {guidance && (
        <span
          className={cn(
            "inline-flex w-fit px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-semibold uppercase tracking-[0.1em]",
            GUIDANCE_STYLES[guidance] ?? "border border-[#2a3544] text-[#8b9aad]",
          )}
        >
          Guidance {guidance}
        </span>
      )}
      <Link
        href={`/reports/${reportId}`}
        className={cn(compareNavLinkClassName, "mt-auto gap-1.5 text-[#2b79db] hover:text-[#63a6f5]")}
      >
        Open report <ExternalLink className={compareNavIconClassName} aria-hidden />
      </Link>
    </div>
  );
}

function CompareLoading() {
  return (
    <BeiShell>
      <div className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[#6b7d92]">
            Loading comparison...
          </p>
          <div className="mx-auto mt-4 h-px w-24 animate-pulse bg-gradient-to-r from-transparent via-[#2b79db]/50 to-transparent" />
        </div>
      </div>
    </BeiShell>
  );
}

export default function ComparePage({ initialReportA, initialReportB }: CompareClientProps) {
  const idA = initialReportA;
  const idB = initialReportB;

  const [reportA, setReportA] = useState<Report | null>(null);
  const [reportB, setReportB] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) {
      setError("Select two reports to compare.");
      setLoading(false);
      return;
    }
    if (idA === idB) {
      setError("Select two different reports to compare.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    Promise.all([
      fetch(`/api/reports/${idA}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/reports/${idB}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        if (!a || !b) {
          setError("One or both reports not found.");
          setLoading(false);
          return;
        }
        setReportA(a);
        setReportB(b);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idA, idB]);

  const snapA = (reportA?.extractedJsonSnapshot ?? {}) as ExtractedData;
  const snapB = (reportB?.extractedJsonSnapshot ?? {}) as ExtractedData;

  const nameA = reportA ? displayName(reportA, "Report A") : "Report A";
  const nameB = reportB ? displayName(reportB, "Report B") : "Report B";

  const metricsMap = useMemo(
    () => buildMetricsMap(snapA.metrics ?? [], snapB.metrics ?? []),
    [snapA, snapB],
  );

  const comparison = useMemo(
    () =>
      reportA && reportB
        ? computeWeightedComparison(snapA, snapB, metricsMap, nameA, nameB)
        : null,
    [reportA, reportB, snapA, snapB, metricsMap, nameA, nameB],
  );

  const trendOverlay = useMemo(
    () => (reportA && reportB ? buildOverlayTrendSeries(snapA, snapB, nameA, nameB) : null),
    [reportA, reportB, snapA, snapB, nameA, nameB],
  );

  const breakdownA = useMemo(() => pickBreakdownSegments(snapA), [snapA]);
  const breakdownB = useMemo(() => pickBreakdownSegments(snapB), [snapB]);

  const sortedMetrics = useMemo(
    () => sortMetricEntries([...metricsMap.entries()]),
    [metricsMap],
  );

  if (loading) return <CompareLoading />;

  if (error) {
    return (
      <BeiShell>
        <div className="grid min-h-screen place-items-center gap-4 px-6 text-center">
          <div className="max-w-md border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-6 py-5">
            <p className="text-sm text-[#e8a0a8]">{error}</p>
            <Link
              href="/companies"
              className={cn(compareNavLinkClassName, "mt-4 text-[#2b79db] hover:text-[#63a6f5]")}
            >
              Back to catalog
            </Link>
          </div>
        </div>
      </BeiShell>
    );
  }

  if (!reportA || !reportB) {
    return (
      <BeiShell>
        <div className="grid min-h-screen place-items-center px-6 text-[#8b9aad]">
          Reports not found.
        </div>
      </BeiShell>
    );
  }

  const leader =
    comparison && comparison.scoreA > comparison.scoreB
      ? "a"
      : comparison && comparison.scoreB > comparison.scoreA
        ? "b"
        : "tie";

  return (
    <BeiShell>
      <AppSiteHeader
        maxWidthClass="max-w-6xl"
        breadcrumbs={[
          { label: "Catalog", href: "/companies" },
          { label: "Compare" },
        ]}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-8"
        >
          <div className="flex flex-col gap-2">
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.24em] text-[#5a8f8f]">
              Head-to-head
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-[1.05] tracking-tight text-[#f4f6f9]">
              Earnings comparison
            </h1>
            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-[#8b9aad]">
              Revenue, free cash flow, and guidance count double in the scorecard. Everything else
              is weighted once.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-center">
            <ReportPillar
              side="A"
              name={nameA}
              fiscalYear={reportA.fiscalYear}
              reportType={reportA.reportType}
              language={reportA.language}
              reportId={reportA.id}
              guidance={snapA.sentiment?.guidanceDirection}
            />
            <div
              className="relative z-10 flex shrink-0 items-center justify-center border border-[#2a3544] bg-[#080b10] px-4 py-3 lg:-mx-4 lg:px-5"
              aria-hidden
            >
              <Swords className="size-5 text-[#2b79db]" />
              <span className="sr-only">versus</span>
            </div>
            <ReportPillar
              side="B"
              name={nameB}
              fiscalYear={reportB.fiscalYear}
              reportType={reportB.reportType}
              language={reportB.language}
              reportId={reportB.id}
              guidance={snapB.sentiment?.guidanceDirection}
            />
          </div>

          {comparison && comparison.totalWeight > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className={cn(
                "relative overflow-hidden border px-5 py-4 sm:px-6",
                leader === "a" && "border-emerald-500/30 bg-emerald-500/[0.07]",
                leader === "b" && "border-red-500/25 bg-red-500/[0.06]",
                leader === "tie" && "border-[#2a3544] bg-[#0c1018]/80",
              )}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center border",
                    leader === "a" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                    leader === "b" && "border-red-500/35 bg-red-500/10 text-red-300",
                    leader === "tie" && "border-[#2a3544] bg-[#080b10] text-[#5a8f8f]",
                  )}
                >
                  {leader === "a" ? (
                    <TrendingUp className="size-5" aria-hidden />
                  ) : leader === "b" ? (
                    <TrendingDown className="size-5" aria-hidden />
                  ) : (
                    <Scale className="size-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-display)] text-base font-medium text-[#f4f6f9] sm:text-lg">
                    {leader === "a"
                      ? `${nameA} leads the weighted scorecard`
                      : leader === "b"
                        ? `${nameB} leads the weighted scorecard`
                        : "Scorecard is tied on weighted metrics"}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[#8b9aad]">
                    {nameA}{" "}
                    <span className="text-[#4f9bff]">{comparison.scoreA}</span>
                    {" · "}
                    {nameB}{" "}
                    <span className="text-[#5a8f8f]">{comparison.scoreB}</span>
                    {" · "}
                    {comparison.totalWeight} weighted points compared
                  </p>
                  {comparison.pillarNotes.length > 0 && (
                    <p className="mt-2 break-words font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#5a8f8f]">
                      {comparison.pillarNotes.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="hidden gap-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] sm:flex">
                  <span className="text-[#6b7d92]">2× pillars</span>
                  <span className="text-[#3d4d62]">Revenue · FCF · Guidance</span>
                </div>
              </div>
            </motion.div>
          )}

          <DashboardSection title="Metrics" eyebrow="Shared extracted figures">
            <div className="-mx-5 -my-2 overflow-x-auto overscroll-x-contain whitespace-nowrap">
              <div className="inline-block min-w-full px-5 py-2 align-middle">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#1e2733] font-[family-name:var(--font-mono)] text-xs/5 tracking-[0.02em] text-[#6b7d92] sm:text-[11px]">
                      <th className={METRICS_HEADER_CELL_CLASS}>Metric</th>
                      <th className={cn(METRICS_HEADER_CELL_CLASS, "text-[#4f9bff]")}>{nameA}</th>
                      <th className={METRICS_HEADER_CELL_CLASS}>Delta</th>
                      <th className={cn(METRICS_HEADER_CELL_CLASS, "text-[#5a8f8f]")}>{nameB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMetrics.map(([key, { a, b }], idx) => {
                      const label = a?.label || b?.label || key;
                      const valA = a?.value;
                      const valB = b?.value;
                      const unit = a?.unit || b?.unit || "";
                      const fmt = (v: number | null | undefined) =>
                        v == null ? "—" : `${fmtCurrency(v)}${unit ? ` ${unit}` : ""}`;
                      const higherBetter = isHigherBetter(label);
                      const pillar = isPillarMetric(label);
                      const delta =
                        valA != null && valB != null
                          ? formatDelta(valA, valB, higherBetter)
                          : null;

                      return (
                        <motion.tr
                          key={key}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.02 * idx, duration: 0.35 }}
                          className="border-b border-[#1a2230]/80 last:border-0"
                        >
                          <td className="py-3.5 pr-4 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-[family-name:var(--font-body)] text-base/6 font-medium text-[#e8ecf2] sm:text-[13px]">
                                {label}
                              </span>
                              {pillar && (
                                <span className="border border-[#2b79db]/35 bg-[#2b79db]/10 px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#4f9bff] sm:text-[8px]">
                                  2×
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={cn(METRICS_VALUE_CELL_CLASS, "text-[#e8ecf2]")}>
                            {fmt(valA)}
                          </td>
                          <td className="py-3.5 pr-4 align-middle">
                            {delta ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-base/6 font-medium tabular-nums sm:text-[12px]",
                                  delta.favorable === true && "text-emerald-400",
                                  delta.favorable === false && "text-red-400",
                                  delta.favorable === null && "text-[#6b7d92]",
                                )}
                              >
                                {delta.favorable === true ? (
                                  <ArrowUp className="size-4 shrink-0 sm:size-3.5" aria-hidden />
                                ) : delta.favorable === false ? (
                                  <ArrowDown className="size-4 shrink-0 sm:size-3.5" aria-hidden />
                                ) : null}
                                {delta.text}
                              </span>
                            ) : (
                              <span className="text-base/6 text-[#3d4d62] sm:text-[13px]">—</span>
                            )}
                          </td>
                          <td className={cn(METRICS_VALUE_CELL_CLASS, "pr-0 text-[#c5d0de]")}>
                            {fmt(valB)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </DashboardSection>

          {(breakdownA || breakdownB) && (
            <DashboardSection title="Revenue breakdown" eyebrow="Segment or geography mix">
              <div className="grid gap-6 lg:grid-cols-2">
                {breakdownA ? (
                  <div>
                    <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#4f9bff]">
                      {nameA} · {breakdownA.kind}
                    </p>
                    <BreakdownBarChart segments={breakdownA.segments} surface="beiDark" />
                  </div>
                ) : (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                    No breakdown for {nameA}
                  </p>
                )}
                {breakdownB ? (
                  <div>
                    <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
                      {nameB} · {breakdownB.kind}
                    </p>
                    <BreakdownBarChart segments={breakdownB.segments} surface="beiDark" />
                  </div>
                ) : (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                    No breakdown for {nameB}
                  </p>
                )}
              </div>
            </DashboardSection>
          )}

          {trendOverlay && (
            <DashboardSection title="Profitability trends" eyebrow="Overlaid multi-period series">
              <TrendLineChart
                labels={trendOverlay.labels}
                series={trendOverlay.series}
                surface="beiDark"
              />
            </DashboardSection>
          )}

          {(snapA.sentiment || snapB.sentiment) && (
            <DashboardSection title="Sentiment" eyebrow="Management narrative">
              <div className="grid gap-4 lg:grid-cols-2">
                {(
                  [
                    { field: "managementTone" as const, title: "Management tone" },
                    { field: "outlook" as const, title: "Outlook" },
                  ] as const
                ).map(({ field, title }) => (
                  <React.Fragment key={field}>
                    <SentimentPanel
                      title={title}
                      subtitle={nameA}
                      accent="#4f9bff"
                      body={snapA.sentiment?.[field]}
                    />
                    <SentimentPanel
                      title={title}
                      subtitle={nameB}
                      accent="#5a8f8f"
                      body={snapB.sentiment?.[field]}
                    />
                  </React.Fragment>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <RiskPanel title={`Risk factors — ${nameA}`} items={snapA.sentiment?.riskFactors} />
                <RiskPanel title={`Risk factors — ${nameB}`} items={snapB.sentiment?.riskFactors} />
              </div>
            </DashboardSection>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1e2733] pt-6">
            <Link
              href="/companies"
              className={cn(compareNavLinkClassName, "text-[#6b7d92] hover:text-[#2b79db]")}
            >
              <ArrowLeft className={compareNavIconClassName} aria-hidden />
              Back to catalog
            </Link>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-none border-[#3d4d62] bg-transparent px-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#c5d0de] hover:border-[#2b79db]/40 hover:bg-[#2b79db]/10 sm:h-10"
            >
              <Link href={`/companies`}>Compare other filings</Link>
            </Button>
          </div>
        </motion.div>
      </main>
    </BeiShell>
  );
}

function SentimentPanel({
  title,
  subtitle,
  accent,
  body,
}: {
  title: string;
  subtitle: string;
  accent: string;
  body?: string;
}) {
  return (
    <div className="border border-[#2a3544] bg-[#080b10]/60 p-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 shrink-0" style={{ background: accent }} aria-hidden />
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b7d92]">
          {title} — {subtitle}
        </p>
      </div>
      <p className="mt-3 text-pretty text-[13px] leading-relaxed text-[#c5d0de]">{body || "—"}</p>
    </div>
  );
}

function RiskPanel({ title, items }: { title: string; items?: string[] }) {
  const list = items?.filter(Boolean) ?? [];
  return (
    <div className="border border-[#2a3544] bg-[#080b10]/60 p-4">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b7d92]">
        {title}
      </p>
      {list.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#5a6980]">—</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {list.map((item, i) => (
            <li
              key={`${item.slice(0, 24)}-${i}`}
              className="border-l border-[#2b79db]/25 pl-3 text-[13px] leading-relaxed text-[#b8c4d4]"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
