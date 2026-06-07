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
  Share2,
  XCircle,
} from "lucide-react";
import { AppSiteHeader } from "@/components/app-site-header";
import {
  BreakdownPanel,
  EmptyNarratives,
  KpiStrip,
  MetricsTablePanel,
  NarrativeEditorial,
  SentimentPanel,
  pickKpis,
  selectDonutSegments,
  type ExtractedPayload,
} from "@/components/report-view";
import { cn } from "@/lib/utils";

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

const heroActionClassName =
  "inline-flex h-11 w-full items-center justify-center gap-2 border px-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] transition sm:h-9 sm:w-auto sm:px-3";
const heroActionIconClassName = "size-4 sm:size-3.5";
const reportNavLinkClassName =
  "inline-flex min-h-11 items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] transition sm:min-h-0 sm:text-[10px]";
const reportNavIconClassName = "size-4 sm:size-3";

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
  const donut = useMemo(() => selectDonutSegments(extracted), [extracted]);

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
      <AppSiteHeader
        breadcrumbs={[
          { label: "Catalog", href: "/companies" },
          { label: companyName },
        ]}
      />

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[1240px] px-4 pb-20 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-10 lg:pt-12"
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

        <div className="mt-10 flex flex-col gap-8">
          <PdfPanel
            reportId={reportId}
            fiscalYear={report.fiscalYear}
            typeLabel={typeLabel}
          />
          {sentiment && <SentimentPanel sentiment={sentiment} />}
          {donut.segments.length > 0 && (
            <BreakdownPanel segments={donut.segments} kind={donut.kind} />
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
        aria-label={companySlug ? "Back to company" : "Back to catalog"}
        className={cn(reportNavLinkClassName, "text-[#6b7d92] hover:text-[#2b79db]")}
      >
        <ArrowLeft className={reportNavIconClassName} />
        Back to {companySlug ? "company" : "catalog"}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="border-l-[3px] border-[#2b79db] pl-4 sm:pl-6">
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

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <a
            href={`/api/reports/${reportId}/download`}
            className={cn(
              heroActionClassName,
              "border-[#2b79db] bg-[#2b79db] text-white hover:bg-[#3d8de8]",
            )}
          >
            <Download className={heroActionIconClassName} />
            Download PDF
          </a>
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              heroActionClassName,
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-[#3d4d62] bg-transparent text-[#c5d0de] hover:border-[#5a8f8f]/60 hover:bg-[#5a8f8f]/8",
            )}
            aria-live="polite"
          >
            {copied ? (
              <>
                <CheckCircle2 className={heroActionIconClassName} />
                Link copied
              </>
            ) : (
              <>
                <Share2 className={heroActionIconClassName} />
                Share
              </>
            )}
          </button>
          {companySlug && (
            <Link
              href={`/companies/${companySlug}`}
              className={cn(
                heroActionClassName,
                "border-[#3d4d62] bg-transparent text-[#c5d0de] hover:border-[#5a8f8f]/60 hover:bg-[#5a8f8f]/8",
              )}
            >
              <Building2 className={heroActionIconClassName} />
              Open Company
            </Link>
          )}
        </div>
      </div>
    </section>
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
          className={cn(reportNavLinkClassName, "gap-1.5 text-[#2b79db] hover:text-[#63a6f5]")}
        >
          Open
          <ExternalLink className={reportNavIconClassName} />
        </a>
      </header>
      <div className="relative bg-[#05080c]">
        <iframe
          src={`/api/reports/${reportId}/download#toolbar=0&navpanes=0`}
          className="block h-[min(70vh,560px)] min-h-[240px] w-full border-0 sm:min-h-[420px] lg:min-h-[640px] lg:h-[78vh]"
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
            className={cn(reportNavLinkClassName, "gap-1.5 text-[#5a8f8f] hover:text-[#2b79db]")}
          >
            <ArrowLeft className={reportNavIconClassName} /> Company dashboard
          </Link>
        )}
        <Link
          href="/companies"
          className={cn(reportNavLinkClassName, "gap-1.5 text-[#5a8f8f] hover:text-[#2b79db]")}
        >
          Catalog
          <ArrowUpRight className={reportNavIconClassName} />
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
          className={cn(reportNavLinkClassName, "mt-5 gap-1.5 text-[#2b79db] hover:text-[#63a6f5]")}
        >
          <ArrowLeft className={reportNavIconClassName} /> Back to catalog
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
          className={cn(reportNavLinkClassName, "mt-6 gap-1.5 text-[#2b79db] hover:text-[#63a6f5]")}
        >
          <ArrowLeft className={reportNavIconClassName} /> Back to catalog
        </Link>
      </div>
    </div>
  );
}
