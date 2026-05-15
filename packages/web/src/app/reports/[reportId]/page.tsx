"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  ScrollText,
  Share2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { DealSpacerLogoLink } from "@/components/deal-spacer-logo";
import { DonutChart, type DonutSegment } from "@/components/charts/donut-chart";
import { cn } from "@/lib/utils";
import type {
  ExtractedData,
  ExtractedMetric,
  ExtractedNarrative,
  ExtractedSentiment,
} from "@bei/shared";

type ExtractedPayload = Partial<ExtractedData> & {
  metadata?: Partial<ExtractedData["metadata"]>;
  metrics?: ExtractedMetric[];
  narratives?: ExtractedNarrative[];
  sentiment?: ExtractedSentiment;
};

interface Report {
  id: string;
  companyId: string | null;
  fiscalYear: number;
  reportType: string;
  language: string;
  jobId: string | null;
  s3Key: string;
  extractedJsonSnapshot: ExtractedPayload | null;
  createdAt: string;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  annual: "Annual",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  "semi-annual": "Semi-Annual",
  other: "Other",
};

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  et: "Eesti",
  lv: "Latviešu",
  lt: "Lietuvių",
};

const NARRATIVE_ORDER = [
  "executive_summary",
  "management_commentary",
  "business_overview",
  "segment_performance",
  "outlook",
] as const;

function narrativeTitle(section: string): string {
  const map: Record<string, string> = {
    executive_summary: "Executive Summary",
    management_commentary: "Management Commentary",
    business_overview: "Business Overview",
    segment_performance: "Segment Performance",
    outlook: "Outlook",
  };
  return (
    map[section] ??
    section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function toneVisual(tone: string | undefined): {
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

const GUIDANCE_STYLES: Record<string, { label: string; cls: string }> = {
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

function formatMetricValue(metric: ExtractedMetric): string {
  if (metric.value == null) return "—";
  const v = metric.value;
  const abs = Math.abs(v);
  const unit = metric.unit?.trim() ?? "";
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

const PRIORITY_KPI_LABELS = [
  "revenue",
  "ebitda",
  "net profit",
  "net income",
  "free cash flow",
  "operating profit",
];

function pickKpis(metrics: ExtractedMetric[]): ExtractedMetric[] {
  const priority: ExtractedMetric[] = [];
  const seen = new Set<string>();
  for (const want of PRIORITY_KPI_LABELS) {
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

export default function ReportViewPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [companySlug, setCompanySlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/${reportId}`)
      .then(async (r) => {
        if (cancelled) return;
        // Defend against the dev server occasionally returning an HTML
        // error page (e.g. webpack hot-reload corruption) instead of JSON.
        const contentType = r.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        if (!isJson) {
          setError(
            r.ok
              ? "Server returned a non-JSON response."
              : `Server error ${r.status}. Try restarting the dev server (delete packages/web/.next and run npm run dev:web).`,
          );
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || data?.error) {
          setError(data?.error || `Failed to load report (${r.status})`);
          return;
        }
        setReport(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err?.message ?? "Network error";
        // Friendlier message when JSON.parse fails because the server
        // returned HTML.
        if (typeof message === "string" && message.includes("<")) {
          setError(
            "Server returned an HTML error page instead of JSON. The dev server may need a restart.",
          );
        } else {
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Resolve company slug from the companies list so the "Open Company"
  // button always lands on the analytics dashboard.
  useEffect(() => {
    if (!report?.companyId) return;
    let cancelled = false;
    fetch("/api/companies")
      .then((r) => r.json())
      .then((list: Array<{ id: string; slug: string }>) => {
        if (cancelled) return;
        const match = Array.isArray(list)
          ? list.find((c) => c.id === report.companyId)
          : null;
        if (match) setCompanySlug(match.slug);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [report?.companyId]);

  const extracted = report?.extractedJsonSnapshot ?? null;
  const metrics = useMemo(() => extracted?.metrics ?? [], [extracted]);
  const narratives = useMemo(
    () => extracted?.narratives ?? [],
    [extracted],
  );
  const sentiment = extracted?.sentiment;
  const kpis = useMemo(() => pickKpis(metrics), [metrics]);
  const otherMetrics = useMemo(
    () => metrics.filter((m) => !kpis.includes(m)),
    [metrics, kpis],
  );
  const donutSegments: DonutSegment[] = useMemo(() => {
    const bd = extracted?.revenueBreakdown;
    const source = bd?.bySegment ?? bd?.byGeography ?? [];
    return source
      .filter((s) => Number.isFinite(s.value))
      .map((s) => ({ label: s.name, value: s.value }));
  }, [extracted]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/reports/${reportId}`
      : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) return <PageShell><LoadingState /></PageShell>;
  if (error)
    return (
      <PageShell>
        <ErrorState message={error} />
      </PageShell>
    );
  if (!report)
    return (
      <PageShell>
        <NotFoundState />
      </PageShell>
    );

  const companyName =
    extracted?.metadata?.companyName ?? "Company not identified";
  const reportPeriod = extracted?.metadata?.reportPeriod ?? null;
  const language = LANGUAGE_LABEL[report.language] ?? report.language?.toUpperCase();
  const typeLabel = REPORT_TYPE_LABEL[report.reportType] ?? report.reportType;
  const filingDate = new Date(report.createdAt);

  return (
    <PageShell>
      <SiteHeader companyName={companyName} />

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-8 sm:px-6 lg:px-10 lg:pt-12"
      >
        <ReportHero
          companyName={companyName}
          reportPeriod={reportPeriod}
          fiscalYear={report.fiscalYear}
          typeLabel={typeLabel}
          language={language}
          filingDate={filingDate}
          reportId={reportId}
          companySlug={companySlug}
          copied={copied}
          onCopy={handleCopy}
        />

        {kpis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mt-10"
          >
            <KpiStrip kpis={kpis} />
          </motion.div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PdfPanel
              reportId={reportId}
              fiscalYear={report.fiscalYear}
              typeLabel={typeLabel}
            />
          </div>

          <div className="flex flex-col gap-8">
            {sentiment && <SentimentPanel sentiment={sentiment} />}
            {donutSegments.length > 0 && (
              <BreakdownPanel
                segments={donutSegments}
                kind={extracted?.revenueBreakdown?.bySegment ? "segment" : "geography"}
              />
            )}
            {otherMetrics.length > 0 && (
              <MetricsTablePanel metrics={otherMetrics} />
            )}
            {narratives.length > 0 ? (
              <NarrativeEditorial narratives={narratives} />
            ) : (
              <EmptyNarratives />
            )}
          </div>
        </div>

        <FooterBar reportId={reportId} companySlug={companySlug} />
      </motion.main>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Layout shell
// ─────────────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative min-h-screen",
        "bg-[#080b10] text-[#e8ecf2]",
        "font-[family-name:var(--font-body)]",
      )}
    >
      <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="landing-aurora pointer-events-none fixed inset-0 z-0 opacity-60" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SiteHeader({ companyName }: { companyName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#2b79db]/12 bg-[#080b10]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <DealSpacerLogoLink className="shrink-0 text-[#8b9aad] hover:text-[#f4f6f9]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#3d4d62]">
            /
          </span>
          <Link
            href="/companies"
            className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f] transition hover:text-[#2b79db]"
          >
            Catalog
          </Link>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#3d4d62]">
            /
          </span>
          <span className="truncate font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#8b9aad]">
            {companyName}
          </span>
        </div>
        <nav className="hidden items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] sm:flex">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 border border-[#2b79db]/40 bg-[#2b79db]/10 px-3 py-2 text-[#b8d4f5] transition hover:bg-[#2b79db]/18"
          >
            Upload
            <ArrowUpRight className="size-3" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────

function ReportHero({
  companyName,
  reportPeriod,
  fiscalYear,
  typeLabel,
  language,
  filingDate,
  reportId,
  companySlug,
  copied,
  onCopy,
}: {
  companyName: string;
  reportPeriod: string | null;
  fiscalYear: number;
  typeLabel: string;
  language: string;
  filingDate: Date;
  reportId: string;
  companySlug: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="relative">
      <Link
        href={companySlug ? `/companies/${companySlug}` : "/companies"}
        aria-label="Back to company"
        className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6b7d92] transition hover:text-[#2b79db]"
      >
        <ArrowLeft className="size-3" />
        Back to {companySlug ? "company" : "catalog"}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="border-l-[3px] border-[#2b79db] pl-6">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.24em] text-[#5a8f8f]">
            Filing brief · {fiscalYear} {typeLabel}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.04] tracking-[-0.02em] text-[#f4f6f9]">
            {companyName}
          </h1>
          {reportPeriod && (
            <p className="mt-3 font-[family-name:var(--font-display)] text-lg italic text-[#8b9aad]">
              {reportPeriod}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]">
            <span className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0c1018] px-3 py-1.5 text-[#b8d4f5]">
              <span className="size-1.5 rounded-full bg-[#2b79db]" aria-hidden />
              FY {fiscalYear}
            </span>
            <span className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0c1018] px-3 py-1.5 text-[#8b9aad]">
              {typeLabel}
            </span>
            <span className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0c1018] px-3 py-1.5 text-[#8b9aad]">
              {language}
            </span>
            <span className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0c1018] px-3 py-1.5 text-[#6b7d92]">
              Indexed {filingDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href={`/api/reports/${reportId}/download`}
            className="inline-flex h-11 items-center gap-2 border border-[#2b79db] bg-[#2b79db] px-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-white transition hover:bg-[#3d8de8]"
          >
            <Download className="size-3.5" />
            Download PDF
          </a>
          <button
            onClick={onCopy}
            className={cn(
              "inline-flex h-11 items-center gap-2 border px-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] transition",
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-[#3d4d62] bg-transparent text-[#c5d0de] hover:border-[#5a8f8f]/60 hover:bg-[#5a8f8f]/8",
            )}
            aria-live="polite"
          >
            {copied ? (
              <>
                <CheckCircle2 className="size-3.5" />
                Link copied
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                Share
              </>
            )}
          </button>
          {companySlug && (
            <Link
              href={`/companies/${companySlug}`}
              className="inline-flex h-11 items-center gap-2 border border-[#3d4d62] bg-transparent px-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#c5d0de] transition hover:border-[#5a8f8f]/60 hover:bg-[#5a8f8f]/8"
            >
              <Building2 className="size-3.5" />
              Open Company
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// KPI strip
// ─────────────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: ExtractedMetric[] }) {
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

// ─────────────────────────────────────────────────────────────────────────
// PDF panel
// ─────────────────────────────────────────────────────────────────────────

function PdfPanel({
  reportId,
  fiscalYear,
  typeLabel,
}: {
  reportId: string;
  fiscalYear: number;
  typeLabel: string;
}) {
  return (
    <section className="relative border border-[#2a3544] bg-[#0c1018]/90">
      <span className="pointer-events-none absolute -left-px -top-px block size-3 border-l-2 border-t-2 border-[#2b79db]" aria-hidden />
      <span className="pointer-events-none absolute -right-px -top-px block size-3 border-r-2 border-t-2 border-[#2b79db]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-px -left-px block size-3 border-b-2 border-l-2 border-[#5a8f8f]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-px -right-px block size-3 border-b-2 border-r-2 border-[#5a8f8f]" aria-hidden />

      <header className="flex items-center justify-between gap-3 border-b border-[#1e2733] bg-[#080b10]/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="size-3.5 text-[#5a8f8f]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#8b9aad]">
            Source PDF · FY{fiscalYear} {typeLabel}
          </span>
        </div>
        <a
          href={`/api/reports/${reportId}/download`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#2b79db] transition hover:text-[#63a6f5]"
        >
          Open
          <ExternalLink className="size-3" />
        </a>
      </header>
      <div className="relative bg-[#05080c]">
        <iframe
          src={`/api/reports/${reportId}/download#toolbar=0&navpanes=0`}
          className="block h-[78vh] min-h-[640px] w-full border-0"
          title="Source report PDF"
        />
      </div>
      <div className="flex items-center justify-between border-t border-[#1e2733] bg-[#080b10]/60 px-4 py-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] text-[#5a6980]">
        <span className="uppercase">Verified source · primary filing</span>
        <span className="tabular-nums">{reportId.slice(0, 8)}</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sentiment panel
// ─────────────────────────────────────────────────────────────────────────

function SentimentPanel({ sentiment }: { sentiment: ExtractedSentiment }) {
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

// ─────────────────────────────────────────────────────────────────────────
// Revenue breakdown
// ─────────────────────────────────────────────────────────────────────────

function BreakdownPanel({
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

// ─────────────────────────────────────────────────────────────────────────
// Secondary metrics table
// ─────────────────────────────────────────────────────────────────────────

function MetricsTablePanel({ metrics }: { metrics: ExtractedMetric[] }) {
  return (
    <PanelFrame
      icon={ScrollText}
      eyebrow="Additional figures"
      title="All Extracted Metrics"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="font-[family-name:var(--font-mono)] text-left text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
              <th className="pb-3 pr-3 font-medium">Metric</th>
              <th className="pb-3 pr-3 font-medium">Period</th>
              <th className="pb-3 pl-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={`${m.label}-${i}`}
                className="border-t border-[#1e2733]/80"
              >
                <td className="py-3 pr-3 text-sm text-[#e8ecf2]">{m.label}</td>
                <td className="py-3 pr-3 font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                  {m.period ?? "—"}
                </td>
                <td className="py-3 pl-3 text-right font-[family-name:var(--font-mono)] text-sm tabular-nums text-[#b8d4f5]">
                  {formatMetricValue(m)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Editorial narrative — pull-quote style with drop cap
// ─────────────────────────────────────────────────────────────────────────

function NarrativeEditorial({
  narratives,
}: {
  narratives: ExtractedNarrative[];
}) {
  // Order by NARRATIVE_ORDER, then any remaining sections.
  const ordered = [
    ...NARRATIVE_ORDER.map((s) => narratives.find((n) => n.section === s)).filter(
      Boolean,
    ),
    ...narratives.filter(
      (n) => !NARRATIVE_ORDER.includes(n.section as (typeof NARRATIVE_ORDER)[number]),
    ),
  ] as ExtractedNarrative[];

  return (
    <PanelFrame
      icon={ScrollText}
      eyebrow="Filing in prose"
      title="Editorial Brief"
      contentClassName="px-0 py-0"
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

function EmptyNarratives() {
  return (
    <PanelFrame icon={ScrollText} eyebrow="Filing in prose" title="Editorial Brief">
      <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-[#8b9aad]">
        No narrative sections were extracted from this filing. The source PDF is
        still available above.
      </p>
    </PanelFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reusable panel frame (corner ticks + terminal header)
// ─────────────────────────────────────────────────────────────────────────

function PanelFrame({
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
    <section className="relative border border-[#2a3544] bg-[#0c1018]/90">
      <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]" aria-hidden />
      <span className="pointer-events-none absolute -right-px -top-px block size-2 border-r border-t border-[#2b79db]" aria-hidden />
      <header className="flex items-center justify-between border-b border-[#1e2733] px-5 py-3.5">
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
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Footer bar
// ─────────────────────────────────────────────────────────────────────────

function FooterBar({
  reportId,
  companySlug,
}: {
  reportId: string;
  companySlug: string | null;
}) {
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[#1e2733] pt-6">
      <div className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a6980]">
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#2b79db]" />
          Report ID · <span className="tabular-nums text-[#8b9aad]">{reportId}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {companySlug && (
          <Link
            href={`/companies/${companySlug}`}
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a8f8f] transition hover:text-[#2b79db]"
          >
            <ArrowLeft className="size-3" /> Company dashboard
          </Link>
        )}
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a8f8f] transition hover:text-[#2b79db]"
        >
          Catalog
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Async states
// ─────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center border border-[#2a3544] bg-[#0c1018] text-[#2b79db]">
          <FileText className="size-5" />
        </div>
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[#6b7d92]">
          Loading filing…
        </p>
        <div className="mt-4 mx-auto h-px w-16 bg-[#2b79db]/40" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center gap-4 px-6 text-center">
      <div className="max-w-md border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-6 py-6">
        <XCircle className="mx-auto size-7 text-[#c97a6a]" />
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#c97a6a]">
          Could not load report
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#e8a0a8]">{message}</p>
        <Link
          href="/companies"
          className="mt-5 inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#2b79db] transition hover:text-[#63a6f5]"
        >
          <ArrowLeft className="size-3" /> Back to catalog
        </Link>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="grid min-h-screen place-items-center gap-4 px-6 text-center">
      <div className="max-w-md border border-[#2a3544] bg-[#0c1018]/90 px-6 py-10">
        <FileText className="mx-auto size-8 text-[#5a8f8f]" />
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-medium text-[#f4f6f9]">
          Report not found
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#8b9aad]">
          The filing you&apos;re looking for has been removed or never existed.
        </p>
        <Link
          href="/companies"
          className="mt-6 inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#2b79db] transition hover:text-[#63a6f5]"
        >
          <ArrowLeft className="size-3" /> Back to catalog
        </Link>
      </div>
    </div>
  );
}
