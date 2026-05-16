"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  Download,
  ExternalLink,
  FileText,
  Plus,
  Wallet,
} from "lucide-react";
import { TrendLineChart, type TrendSeries } from "@/components/charts/trend-line-chart";
import {
  BreakdownBarChart,
  type BreakdownSegment,
} from "@/components/charts/breakdown-bar-chart";
import { AppSiteHeader } from "@/components/app-site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildTrendChartFromSnapshot,
  compareReportRecency,
  hasProfitabilityTrendSeries,
  formatReportPeriodLabel,
  pickHeadlineReports,
  pickTrendReports,
  resolvePriorPreviewMetric,
  type ExtractedData,
  type PreviewMetricKey,
  type ReportType,
} from "@bei/shared/company-dashboard";

interface Company {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string;
  slug: string;
  country: string | null;
  sector: string | null;
  reportCount: number;
}

interface ExtractedMetric {
  label: string;
  value: number | null;
  unit?: string;
  period?: string;
}

interface ExtractedSentiment {
  managementTone?: string;
  outlook?: string;
  riskFactors?: string[];
  guidanceDirection?: "raised" | "maintained" | "lowered" | null;
}

interface RevenueBreakdown {
  bySegment?: { name: string; value: number }[];
  byGeography?: { name: string; value: number }[];
}

interface Report {
  id: string;
  companyId: string | null;
  fiscalYear: number;
  reportType: ReportType;
  language: string;
  jobId: string | null;
  s3Key: string;
  previewRevenue?: number | null;
  previewEbitda?: number | null;
  previewNetProfit?: number | null;
  previewFcf?: number | null;
  extractedJsonSnapshot?: ExtractedData | null;
  companyName?: string | null;
  createdAt: string;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  annual: "Annual",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  "semi-annual": "Semi",
  other: "Other",
};

const METRIC_COLORS: Record<string, string> = {
  revenue: "#3b82f6",
  ebitda: "#22c55e",
  netProfit: "#f59e0b",
  fcf: "#a855f7",
};

const EXCHANGE_ACCENT: Record<string, string> = {
  "Nasdaq Tallinn": "#4a7ab8",
  "Nasdaq Riga": "#9e4a5a",
  "Nasdaq Vilnius": "#8a9e4a",
};

const GUIDANCE_STYLES: Record<string, string> = {
  raised: "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  maintained: "border border-amber-400/35 bg-amber-500/10 text-amber-100",
  lowered: "border border-red-500/35 bg-red-500/10 text-red-200",
};
const reportTableHeaderClassName = "whitespace-nowrap pb-3 pr-3 font-medium";
const reportTableNumberClassName =
  "py-3.5 pr-3 align-middle font-[family-name:var(--font-mono)] text-base/6 tabular-nums text-[#e8ecf2] sm:text-[13px]";

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

function fmtPct(val: number): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function yoyDelta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

const PREVIEW_FIELD: Record<
  PreviewMetricKey,
  keyof Pick<Report, "previewRevenue" | "previewEbitda" | "previewNetProfit" | "previewFcf">
> = {
  revenue: "previewRevenue",
  ebitda: "previewEbitda",
  netProfit: "previewNetProfit",
  fcf: "previewFcf",
};

function getMetric(
  report: Report | undefined,
  key: PreviewMetricKey,
  opts?: { prior?: boolean },
): number | null | undefined {
  if (!report) return null;
  if (opts?.prior) {
    return resolvePriorPreviewMetric(report.extractedJsonSnapshot ?? null, key);
  }
  return report[PREVIEW_FIELD[key]] ?? null;
}

function getComparablePrior(
  latest: Report | undefined,
  previous: Report | undefined,
  key: PreviewMetricKey,
): number | null | undefined {
  const fromPriorReport = getMetric(previous, key);
  if (fromPriorReport != null) return fromPriorReport;
  if (latest && !previous) return getMetric(latest, key, { prior: true });
  return null;
}

function BeiShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative min-h-screen",
        "bg-[#080b10] text-[#e8ecf2]",
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
      <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]" aria-hidden />
      <div className="border-b border-[#1e2733] px-5 py-4">
        {eyebrow && (
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">{eyebrow}</p>
        )}
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[#f4f6f9]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function CompanyAnalyticsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const compRes = await fetch("/api/companies");
        if (!compRes.ok) throw new Error("Failed to load company");
        const companies: Company[] = await compRes.json();
        if (cancelled) return;
        const found = companies.find((c) => c.slug === slug) || null;
        setCompany(found);
        if (!found) {
          setNotFound(true);
          return;
        }
        const repRes = await fetch(`/api/companies/${slug}/reports`);
        if (repRes.ok) {
          const reps: Report[] = await repRes.json();
          if (!cancelled) setReports(reps);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const trendReports = useMemo(() => pickTrendReports(reports), [reports]);
  const sentimentReports = useMemo(
    () => [...reports].sort(compareReportRecency).reverse(),
    [reports],
  );
  const { latest, previous } = useMemo(() => pickHeadlineReports(reports), [reports]);
  const periodLabel = latest ? formatReportPeriodLabel(latest) : null;

  const kpiCards = useMemo(
    () => [
      {
        key: "revenue" as const,
        label: "Revenue",
        value: getMetric(latest, "revenue"),
        prev: getComparablePrior(latest, previous, "revenue"),
        accent: METRIC_COLORS.revenue,
      },
      {
        key: "ebitda" as const,
        label: "EBITDA",
        value: getMetric(latest, "ebitda"),
        prev: getComparablePrior(latest, previous, "ebitda"),
        accent: METRIC_COLORS.ebitda,
      },
      {
        key: "netProfit" as const,
        label: "Net Profit",
        value: getMetric(latest, "netProfit"),
        prev: getComparablePrior(latest, previous, "netProfit"),
        accent: METRIC_COLORS.netProfit,
      },
      {
        key: "fcf" as const,
        label: "Free Cash Flow",
        value: getMetric(latest, "fcf"),
        prev: getComparablePrior(latest, previous, "fcf"),
        accent: METRIC_COLORS.fcf,
      },
    ],
    [latest, previous],
  );

  const trendData = useMemo(() => {
    const embedded =
      trendReports.length <= 1 && latest && hasProfitabilityTrendSeries(latest.extractedJsonSnapshot ?? null)
        ? buildTrendChartFromSnapshot(latest.extractedJsonSnapshot ?? null)
        : null;

    if (embedded) {
      const series: TrendSeries[] = [
        {
          key: "revenue",
          label: "Revenue",
          color: METRIC_COLORS.revenue,
          values: embedded.revenue,
        },
        {
          key: "ebitda",
          label: "EBITDA",
          color: METRIC_COLORS.ebitda,
          values: embedded.ebitda,
        },
        {
          key: "netProfit",
          label: "Net Profit",
          color: METRIC_COLORS.netProfit,
          values: embedded.netProfit,
        },
        {
          key: "fcf",
          label: "Free Cash Flow",
          color: METRIC_COLORS.fcf,
          values: embedded.fcf,
        },
      ];
      return { labels: embedded.labels, series };
    }

    const labels = trendReports.map((r) => formatReportPeriodLabel(r));
    const series: TrendSeries[] = [
      {
        key: "revenue",
        label: "Revenue",
        color: METRIC_COLORS.revenue,
        values: trendReports.map((r) => r.previewRevenue ?? null),
      },
      {
        key: "ebitda",
        label: "EBITDA",
        color: METRIC_COLORS.ebitda,
        values: trendReports.map((r) => r.previewEbitda ?? null),
      },
      {
        key: "netProfit",
        label: "Net Profit",
        color: METRIC_COLORS.netProfit,
        values: trendReports.map((r) => r.previewNetProfit ?? null),
      },
      {
        key: "fcf",
        label: "Free Cash Flow",
        color: METRIC_COLORS.fcf,
        values: trendReports.map((r) => r.previewFcf ?? null),
      },
    ];
    return { labels, series };
  }, [trendReports, latest]);

  const breakdownSegments: BreakdownSegment[] = useMemo(() => {
    const breakdown = latest?.extractedJsonSnapshot?.revenueBreakdown;
    const source = breakdown?.bySegment ?? breakdown?.byGeography ?? [];
    return source
      .filter((s) => Number.isFinite(s.value))
      .map((s) => ({ label: s.name, value: s.value }));
  }, [latest]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 2) {
        const [first] = next;
        next.delete(first);
      }
      next.add(id);
      return next;
    });
  }

  function goCompare() {
    const [a, b] = [...selected];
    router.push(`/compare?reportA=${a}&reportB=${b}`);
  }

  if (loading) {
    return (
      <BeiShell>
        <div className="grid min-h-screen place-items-center px-6">
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[#6b7d92]">
              Loading company...
            </p>
            <div className="mt-4 mx-auto h-px w-16 bg-[#2b79db]/40" />
          </div>
        </div>
      </BeiShell>
    );
  }

  if (error) {
    return (
      <BeiShell>
        <div className="grid min-h-screen place-items-center gap-4 px-6 text-center">
          <div className="max-w-md border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-6 py-5">
            <p className="text-sm text-[#e8a0a8]">{error}</p>
            <Link
              href="/companies"
              className="mt-4 inline-flex font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#2b79db] transition hover:text-[#63a6f5]"
            >
              Back to directory
            </Link>
          </div>
        </div>
      </BeiShell>
    );
  }

  if (notFound || !company) {
    return (
      <BeiShell>
        <div className="grid min-h-screen place-items-center gap-4 px-6 text-center">
          <Building2 className="mx-auto size-10 text-[#5a8f8f]" />
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[#f4f6f9]">
            Company not found
          </h2>
          <p className="max-w-md text-pretty text-sm text-[#8b9aad]">
            The company &quot;{slug}&quot; does not exist in our Baltic directory yet.
          </p>
          <Link
            href="/companies"
            className="mt-2 inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b7d92] transition hover:text-[#2b79db]"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to directory
          </Link>
        </div>
      </BeiShell>
    );
  }

  return (
    <BeiShell>
      <AppSiteHeader
        maxWidthClass="max-w-6xl"
        breadcrumbs={[{ label: "Catalog", href: "/companies" }]}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <CompanyHeader company={company} reportCount={reports.length} />

        {reports.length === 0 ? (
          <EmptyState companyName={company.name} slug={slug} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <KpiCardsRow cards={kpiCards} periodLabel={periodLabel} />

            <DashboardSection title="Performance trends" eyebrow="Historical series">
              {trendData.labels.length >= 1 ? (
                <TrendLineChart
                  labels={trendData.labels}
                  series={trendData.series}
                  surface="beiDark"
                />
              ) : (
                <p className="text-sm text-[#8b9aad]">Not enough data to plot trends.</p>
              )}
            </DashboardSection>

            {breakdownSegments.length > 0 && (
              <DashboardSection title="Revenue breakdown" eyebrow="Latest filing">
                <BreakdownBarChart
                  segments={breakdownSegments}
                  title="Revenue breakdown"
                  surface="beiDark"
                />
              </DashboardSection>
            )}

            <SentimentTimeline reports={sentimentReports} />

            <ReportsTable
              reports={reports}
              selected={selected}
              onToggle={toggleSelect}
              onCompare={goCompare}
            />
          </motion.div>
        )}
      </main>
    </BeiShell>
  );
}

function CompanyHeader({ company, reportCount }: { company: Company; reportCount: number }) {
  const accent = EXCHANGE_ACCENT[company.exchange] ?? "#5a8f8f";
  return (
    <div className="mb-10 flex flex-wrap items-start gap-4 lg:gap-6">
      <Link
        href="/companies"
        aria-label="Back to catalog"
        className="mt-1 inline-flex size-10 shrink-0 items-center justify-center border border-[#2a3544] bg-[#080b10] text-[#8b9aad] transition-colors hover:border-[#2b79db]/35 hover:bg-[#0f141c] hover:text-[#2b79db]"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <div
          className="border-l-[3px] pl-5"
          style={{ borderLeftColor: accent }}
        >
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">
            Issuer snapshot
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-tight text-[#f4f6f9]">
            {company.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 gap-y-2">
            {company.ticker && (
              <span className="inline-flex items-center justify-center border border-[#2a3544] bg-[#080b10] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#2b79db]">
                {company.ticker}
              </span>
            )}
            <span
              className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0c1018] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#8b9aad]"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
              {company.exchange}
            </span>
            {company.sector && (
              <span className="w-full font-[family-name:var(--font-body)] text-sm text-[#6b7d92] sm:w-auto">
                {company.sector}
              </span>
            )}
          </div>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[#6b7d92]">
            {reportCount} report{reportCount !== 1 ? "s" : ""} indexed
          </p>
        </div>
      </div>
      <Button
        asChild
        className="h-11 w-full shrink-0 rounded-none border-0 bg-[#2b79db] px-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-white hover:bg-[#3d8de8] sm:w-auto"
      >
        <Link href={`/upload?company=${company.slug}`}>
          <Plus className="size-3.5" />
          Add Report
        </Link>
      </Button>
    </div>
  );
}

function KpiCardsRow({
  cards,
  periodLabel,
}: {
  cards: {
    key: string;
    label: string;
    value: number | null | undefined;
    prev: number | null | undefined;
    accent: string;
  }[];
  periodLabel: string | null;
}) {
  return (
    <div className="grid gap-px border border-[#2a3544] bg-[#2a3544] sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const delta = yoyDelta(c.value, c.prev);
        const up = delta != null && delta >= 0;
        return (
          <div key={c.key} className="relative overflow-hidden bg-[#0c1018] px-5 py-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: c.accent }}
            />
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7d92]">{c.label}</p>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-medium tabular-nums tracking-tight text-[#f4f6f9] sm:text-[1.65rem]">
              {fmtCurrency(c.value)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-[11px]">
              {delta == null ? (
                <span className="text-[#6b7d92]">No prior period</span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold",
                    up ? "text-emerald-400/95" : "text-red-300/95",
                  )}
                >
                  {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                  {fmtPct(delta)}
                </span>
              )}
              {periodLabel != null && <span className="text-[#5a8f8f]">{periodLabel}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SentimentTimeline({ reports }: { reports: Report[] }) {
  const items = reports.filter((r) => r.extractedJsonSnapshot?.sentiment);
  if (items.length === 0) return null;
  return (
    <DashboardSection title="Sentiment timeline" eyebrow="Narrative signals">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => {
          const s = r.extractedJsonSnapshot?.sentiment;
          const tone = s?.managementTone ?? "—";
          const direction = s?.guidanceDirection ?? null;
          return (
            <li key={r.id} className="flex flex-col gap-2 border border-[#2a3544] bg-[#080b10]/85 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#6b7d92]">
                  FY {r.fiscalYear}
                  {" · "}
                  {REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
                </span>
                {direction && (
                  <span
                    className={cn(
                      "shrink-0 rounded-none px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-semibold uppercase tracking-[0.08em]",
                      GUIDANCE_STYLES[direction] ?? "border border-[#2a3544] text-[#8b9aad]",
                    )}
                  >
                    {direction}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-[#c5d0de] line-clamp-4">{tone}</p>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}

function ReportsTable({
  reports,
  selected,
  onToggle,
  onCompare,
}: {
  reports: Report[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onCompare: () => void;
}) {
  return (
    <DashboardSection title="Reports">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {selected.size === 2 ? (
          <Button
            onClick={onCompare}
            variant="outline"
            className="min-h-11 w-full rounded-none border-[#3d4d62] bg-[#2b79db]/10 px-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8ecf2] hover:border-[#2b79db]/40 hover:bg-[#2b79db]/20 sm:h-10 sm:min-h-10 sm:w-auto"
          >
            <ExternalLink className="size-3.5" />
            Compare Selected
          </Button>
        ) : (
          <p className="font-[family-name:var(--font-mono)] text-base/6 uppercase tracking-[0.12em] text-[#6b7d92] sm:max-w-xs sm:text-right sm:text-[10px]">
            Pick two filings to compare
          </p>
        )}
      </div>
      <div className="-mx-5 -my-2 overflow-x-auto overscroll-x-contain whitespace-nowrap">
        <div className="inline-block min-w-full px-5 py-2 align-middle">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="font-[family-name:var(--font-mono)] text-left text-xs/5 tracking-[0.02em] text-[#6b7d92] sm:text-[11px]">
                <th className="w-10 whitespace-nowrap pb-3 pr-2 font-medium" />
                <th className={reportTableHeaderClassName}>Year</th>
                <th className={reportTableHeaderClassName}>Type</th>
                <th className={reportTableHeaderClassName}>Revenue</th>
                <th className={reportTableHeaderClassName}>EBITDA</th>
                <th className={reportTableHeaderClassName}>Net Profit</th>
                <th className={reportTableHeaderClassName}>Date</th>
                <th className="whitespace-nowrap pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-[#2a3544]">
                  <td className="py-3.5 pr-2 align-middle">
                    <span className="inline-grid size-5 grid-cols-1 sm:size-4">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => onToggle(r.id)}
                        className="peer col-start-1 row-start-1 cursor-pointer appearance-none rounded-sm border border-[#3d4d62] bg-[#080b10] checked:border-[#2b79db] checked:bg-[#2b79db] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b79db] forced-colors:appearance-auto"
                        aria-label={`Select report ${r.fiscalYear} ${REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}`}
                      />
                      <svg
                        viewBox="0 0 14 14"
                        fill="none"
                        className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white opacity-0 transition-opacity peer-checked:opacity-100 sm:size-3"
                        aria-hidden
                      >
                        <path
                          d="M3 8L6 11L11 3.5"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 align-middle font-[family-name:var(--font-display)] text-base font-medium text-[#f4f6f9]">
                    {r.fiscalYear}
                  </td>
                  <td className="py-3.5 pr-3 align-middle font-[family-name:var(--font-mono)] text-base/6 text-[#8b9aad] sm:text-xs">
                    {REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
                  </td>
                  <td className={reportTableNumberClassName}>
                    {fmtCurrency(r.previewRevenue)}
                  </td>
                  <td className={reportTableNumberClassName}>
                    {fmtCurrency(r.previewEbitda)}
                  </td>
                  <td className={reportTableNumberClassName}>
                    {fmtCurrency(r.previewNetProfit)}
                  </td>
                  <td className="py-3.5 pr-3 align-middle font-[family-name:var(--font-mono)] text-base/6 tabular-nums text-[#6b7d92] sm:text-[11px]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 align-middle font-[family-name:var(--font-mono)] text-base/6 font-medium sm:text-[11px]">
                    {r.jobId ? (
                      <a
                        href={`/api/jobs/${r.jobId}/download`}
                        className="inline-flex items-center gap-1 text-[#2b79db] transition hover:text-[#8ec0f5]"
                      >
                        <Download className="size-4 shrink-0 sm:size-3" /> PDF
                      </a>
                    ) : (
                      <span className="text-[#5a6980]/80">PDF</span>
                    )}
                    <Link href={`/reports/${r.id}`} className="text-[#2b79db] transition hover:text-[#8ec0f5]">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardSection>
  );
}

function EmptyState({ companyName, slug }: { companyName: string; slug: string }) {
  return (
    <div className="relative border border-[#2a3544] bg-[#0c1018]/90 px-6 py-14 text-center lg:py-16">
      <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]" aria-hidden />
      <div className="mx-auto mb-6 grid size-14 place-items-center border border-[#2a3544] bg-[#080b10] text-[#5a8f8f]">
        <FileText className="size-6" />
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-[#f4f6f9]">
        No reports yet for {companyName}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-[#8b9aad]">
        Add the first report to populate metrics, trends, and sentiment for this company.
      </p>
      <Button
        asChild
        className="mt-7 h-11 rounded-none border-0 bg-[#2b79db] px-6 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-white hover:bg-[#3d8de8]"
      >
        <Link href={`/upload?company=${slug}`}>
          <Wallet className="size-4" />
          Add First Report
        </Link>
      </Button>
    </div>
  );
}
