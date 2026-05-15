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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendLineChart, type TrendSeries } from "@/components/charts/trend-line-chart";
import { DonutChart, type DonutSegment } from "@/components/charts/donut-chart";
import { cn } from "@/lib/utils";

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

interface ExtractedData {
  metadata?: { companyName?: string; reportPeriod?: string };
  metrics?: ExtractedMetric[];
  sentiment?: ExtractedSentiment;
  revenueBreakdown?: RevenueBreakdown;
}

interface Report {
  id: string;
  companyId: string | null;
  fiscalYear: number;
  reportType: string;
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

const GUIDANCE_STYLES: Record<string, string> = {
  raised: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maintained: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  lowered: "bg-red-500/15 text-red-700 dark:text-red-300",
};

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

function getMetric(report: Report | undefined, key: "revenue" | "ebitda" | "netProfit" | "fcf"): number | null | undefined {
  if (!report) return null;
  if (key === "revenue") return report.previewRevenue;
  if (key === "ebitda") return report.previewEbitda;
  if (key === "netProfit") return report.previewNetProfit;
  return report.previewFcf;
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

  const sortedByYear = useMemo(
    () => [...reports].sort((a, b) => a.fiscalYear - b.fiscalYear),
    [reports],
  );
  const latest = sortedByYear[sortedByYear.length - 1];
  const previous = sortedByYear[sortedByYear.length - 2];

  const kpiCards = useMemo(
    () => [
      {
        key: "revenue" as const,
        label: "Revenue",
        value: getMetric(latest, "revenue"),
        prev: getMetric(previous, "revenue"),
        accent: METRIC_COLORS.revenue,
      },
      {
        key: "ebitda" as const,
        label: "EBITDA",
        value: getMetric(latest, "ebitda"),
        prev: getMetric(previous, "ebitda"),
        accent: METRIC_COLORS.ebitda,
      },
      {
        key: "netProfit" as const,
        label: "Net Profit",
        value: getMetric(latest, "netProfit"),
        prev: getMetric(previous, "netProfit"),
        accent: METRIC_COLORS.netProfit,
      },
      {
        key: "fcf" as const,
        label: "Free Cash Flow",
        value: getMetric(latest, "fcf"),
        prev: getMetric(previous, "fcf"),
        accent: METRIC_COLORS.fcf,
      },
    ],
    [latest, previous],
  );

  const trendData = useMemo(() => {
    const labels = sortedByYear.map((r) => String(r.fiscalYear));
    const series: TrendSeries[] = [
      {
        key: "revenue",
        label: "Revenue",
        color: METRIC_COLORS.revenue,
        values: sortedByYear.map((r) => r.previewRevenue ?? null),
      },
      {
        key: "ebitda",
        label: "EBITDA",
        color: METRIC_COLORS.ebitda,
        values: sortedByYear.map((r) => r.previewEbitda ?? null),
      },
      {
        key: "netProfit",
        label: "Net Profit",
        color: METRIC_COLORS.netProfit,
        values: sortedByYear.map((r) => r.previewNetProfit ?? null),
      },
      {
        key: "fcf",
        label: "Free Cash Flow",
        color: METRIC_COLORS.fcf,
        values: sortedByYear.map((r) => r.previewFcf ?? null),
      },
    ];
    return { labels, series };
  }, [sortedByYear]);

  const donutSegments: DonutSegment[] = useMemo(() => {
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
      <div className="grid min-h-screen place-items-center px-6 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 px-6 text-center">
        <p className="text-destructive">{error}</p>
        <Link href="/companies" className="font-semibold text-primary hover:underline">
          Back to directory
        </Link>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="grid min-h-screen place-items-center gap-2 px-6 text-center">
        <Building2 className="size-10 text-muted-foreground" />
        <h2 className="text-2xl font-semibold tracking-tight">Company not found</h2>
        <p className="text-muted-foreground">The company &quot;{slug}&quot; does not exist in our directory.</p>
        <Link href="/companies" className="mt-2 font-semibold text-primary hover:underline">
          Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <CompanyHeader company={company} reportCount={reports.length} />

        {reports.length === 0 ? (
          <EmptyState companyName={company.name} slug={slug} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            <KpiCardsRow cards={kpiCards} year={latest?.fiscalYear ?? null} />

            <Card className="rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
              <CardHeader>
                <CardTitle className="text-lg">Performance trends</CardTitle>
              </CardHeader>
              <CardContent>
                {trendData.labels.length >= 1 ? (
                  <TrendLineChart labels={trendData.labels} series={trendData.series} />
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data to plot trends.</p>
                )}
              </CardContent>
            </Card>

            {donutSegments.length > 0 && (
              <Card className="rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
                <CardHeader>
                  <CardTitle className="text-lg">Revenue breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart segments={donutSegments} title="Revenue breakdown" />
                </CardContent>
              </Card>
            )}

            <SentimentTimeline reports={[...sortedByYear].reverse()} />

            <ReportsTable
              reports={reports}
              selected={selected}
              onToggle={toggleSelect}
              onCompare={goCompare}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CompanyHeader({ company, reportCount }: { company: Company; reportCount: number }) {
  return (
    <div className="mb-8 flex flex-wrap items-start gap-4">
      <Link
        href="/companies"
        aria-label="Back to catalog"
        className="mt-1 inline-flex size-9 items-center justify-center rounded-xl border border-zinc-200 text-muted-foreground transition-colors hover:bg-muted dark:border-white/10"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <div className="flex-1 min-w-[200px]">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {company.ticker && (
            <span className="text-sm font-semibold text-muted-foreground">{company.ticker}</span>
          )}
          <Badge variant="secondary" className="rounded-full">
            {company.exchange}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {reportCount} report{reportCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <Button asChild className="rounded-xl">
        <Link href={`/upload?company=${company.slug}`}>
          <Plus className="size-4" />
          Add Report
        </Link>
      </Button>
    </div>
  );
}

function KpiCardsRow({
  cards,
  year,
}: {
  cards: { key: string; label: string; value: number | null | undefined; prev: number | null | undefined; accent: string }[];
  year: number | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const delta = yoyDelta(c.value, c.prev);
        const up = delta != null && delta >= 0;
        return (
          <Card
            key={c.key}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white to-zinc-50 shadow-zinc-950/5 dark:from-zinc-900/40 dark:to-zinc-900/10"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: c.accent }}
            />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold tracking-tight">
                {fmtCurrency(c.value)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                {delta == null ? (
                  <span className="text-muted-foreground">No prior data</span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-semibold",
                      up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {fmtPct(delta)}
                  </span>
                )}
                {year != null && (
                  <span className="text-muted-foreground">FY {year}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SentimentTimeline({ reports }: { reports: Report[] }) {
  const items = reports.filter((r) => r.extractedJsonSnapshot?.sentiment);
  if (items.length === 0) return null;
  return (
    <Card className="rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
      <CardHeader>
        <CardTitle className="text-lg">Sentiment timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const s = r.extractedJsonSnapshot?.sentiment;
            const tone = s?.managementTone ?? "—";
            const direction = s?.guidanceDirection ?? null;
            return (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-background/60 p-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    FY {r.fiscalYear} · {REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
                  </span>
                  {direction && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        GUIDANCE_STYLES[direction] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {direction}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-3">{tone}</p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
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
    <Card className="rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">Reports</CardTitle>
        {selected.size === 2 && (
          <Button onClick={onCompare} className="rounded-xl">
            <ExternalLink className="size-3.5" />
            Compare Selected
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="w-10 py-2"></th>
              <th className="py-2 pr-3">Year</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Revenue</th>
              <th className="py-2 pr-3">EBITDA</th>
              <th className="py-2 pr-3">Net Profit</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr
                key={r.id}
                className="border-t border-zinc-200/70 dark:border-white/10"
              >
                <td className="py-3 pr-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => onToggle(r.id)}
                    className="size-4 cursor-pointer accent-primary"
                    aria-label={`Select report ${r.fiscalYear} ${REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}`}
                  />
                </td>
                <td className="py-3 pr-3 font-semibold">{r.fiscalYear}</td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
                </td>
                <td className="py-3 pr-3 font-semibold">{fmtCurrency(r.previewRevenue)}</td>
                <td className="py-3 pr-3 font-semibold">{fmtCurrency(r.previewEbitda)}</td>
                <td className="py-3 pr-3 font-semibold">{fmtCurrency(r.previewNetProfit)}</td>
                <td className="py-3 pr-3 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="flex items-center gap-3 py-3">
                  {r.jobId && (
                    <a
                      href={`/api/jobs/${r.jobId}/download`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Download className="size-3" /> PDF
                    </a>
                  )}
                  <Link
                    href={`/reports/${r.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EmptyState({ companyName, slug }: { companyName: string; slug: string }) {
  return (
    <Card className="rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-zinc-200 bg-background text-muted-foreground dark:border-white/10">
          <FileText className="size-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">No reports yet for {companyName}</h2>
        <p className="max-w-md text-balance text-sm text-muted-foreground">
          Add the first report to populate metrics, trends, and sentiment for this company.
        </p>
        <Button asChild className="mt-2 rounded-xl">
          <Link href={`/upload?company=${slug}`}>
            <Wallet className="size-4" />
            Add First Report
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
