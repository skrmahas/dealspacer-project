"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import { AppSiteHeader } from "@/components/app-site-header";

interface Evidence {
  page?: number | null;
  chunkIndex?: number | null;
  snippet?: string;
  confidence?: number | null;
  rationale?: string;
}

interface Metric {
  label: string;
  value: number | null;
  unit?: string;
  period?: string;
  canonicalId?: string;
  normalizedValue?: number | null;
  normalizedUnit?: string;
  evidence?: Evidence;
}

interface Snapshot {
  metadata?: {
    companyName?: string;
    reportPeriod?: string;
    sourceLanguage?: string;
  };
  metrics?: Metric[];
}

interface ReportPreview {
  id: string;
  companyName?: string | null;
  companySlug?: string | null;
  fiscalYear: number;
  reportType: string;
  language: string;
  s3Key: string;
  extractedJsonSnapshot: Snapshot | null;
}

interface Candidate {
  id: string;
  reportId: string;
  jobId: string;
  s3Key: string;
  extractedJsonSnapshot: Snapshot;
  status: "pending_review" | "failed_quality" | "approved" | "rejected";
  qualityWarnings: string[];
  createdAt: string;
  report: ReportPreview;
}

const METRIC_ORDER = ["revenue", "ebitda", "net_profit", "free_cash_flow", "operating_cash_flow", "total_assets", "equity", "liabilities"];

function metricKey(metric: Metric): string {
  return metric.canonicalId || metric.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function formatValue(metric: Metric | undefined): string {
  if (!metric || metric.value == null || !Number.isFinite(metric.value)) return "-";
  const value = metric.normalizedValue ?? metric.value;
  const unit = metric.normalizedUnit || metric.unit || "";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`;
}

function formatEvidence(evidence: Evidence | undefined): string | null {
  if (!evidence) return null;
  const facts = [
    typeof evidence.confidence === "number" ? `${Math.round(evidence.confidence * 100)}%` : null,
    evidence.page ? `p. ${evidence.page}` : null,
    evidence.chunkIndex != null ? `chunk ${evidence.chunkIndex + 1}` : null,
  ].filter(Boolean);
  return facts.length > 0 ? facts.join(" · ") : null;
}

function collectMetricRows(current: Snapshot | null, rerun: Snapshot) {
  const byKey = new Map<string, { key: string; label: string; current?: Metric; rerun?: Metric }>();
  for (const metric of current?.metrics ?? []) {
    const key = metricKey(metric);
    byKey.set(key, { key, label: metric.label, current: metric });
  }
  for (const metric of rerun.metrics ?? []) {
    const key = metricKey(metric);
    const existing = byKey.get(key);
    byKey.set(key, { key, label: existing?.label || metric.label, current: existing?.current, rerun: metric });
  }
  return [...byKey.values()].sort((a, b) => {
    const ai = METRIC_ORDER.indexOf(a.key);
    const bi = METRIC_ORDER.indexOf(b.key);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.label.localeCompare(b.label);
  });
}

function statusLabel(status: Candidate["status"]): string {
  return status.replace("_", " ");
}

export default function AdminReportRerunsPage() {
  const searchParams = useSearchParams();
  const requestedCandidateId = searchParams.get("candidate");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report-rerun-candidates")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCandidates(data);
          setSelectedId(
            data.some((candidate) => candidate.id === requestedCandidateId)
              ? requestedCandidateId
              : data[0]?.id ?? null,
          );
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [requestedCandidateId]);

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null,
    [candidates, selectedId],
  );
  const metricRows = selected ? collectMetricRows(selected.report.extractedJsonSnapshot, selected.extractedJsonSnapshot) : [];

  async function resolveCandidate(candidateId: string, action: "promote" | "reject") {
    setBusy(`${candidateId}:${action}`);
    setError(null);
    try {
      const response = await fetch(`/api/report-rerun-candidates/${candidateId}/${action}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `${action} failed`);
      }
      setCandidates((prev) => {
        const next = prev.filter((candidate) => candidate.id !== candidateId);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a8f8f] transition hover:text-[#2b79db]"
          aria-label="Back to catalog"
        >
          <ArrowLeft className="size-4" />
          Catalog
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[#f4f6f9] sm:text-3xl">
          Rerun review
        </h1>
        <span className="border border-[#2b79db]/30 bg-[#2b79db]/10 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#b8d4f5]">
          {candidates.length}
        </span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-[#8b9aad]">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="py-16 text-center text-[#8b9aad]">No rerun candidates need review.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <aside className="border border-[#2a3544] bg-[#0c1018]/90">
            <ul className="m-0 list-none divide-y divide-[#2a3544] p-0">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="list-none">
                  <button
                    type="button"
                    onClick={() => setSelectedId(candidate.id)}
                    className={`block w-full p-4 text-left transition ${
                      selected?.id === candidate.id ? "bg-[#2b79db]/12" : "hover:bg-[#111823]"
                    }`}
                  >
                    <span className="block truncate font-medium text-[#f4f6f9]">
                      {candidate.report.companyName || candidate.extractedJsonSnapshot.metadata?.companyName || "Unknown company"}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] text-[#8b9aad]">
                      <span>FY {candidate.report.fiscalYear}</span>
                      <span>{candidate.report.reportType}</span>
                      <span>{candidate.report.language.toUpperCase()}</span>
                    </span>
                    <span className={`mt-3 inline-block border px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] ${
                      candidate.status === "failed_quality"
                        ? "border-[#9e4a5a]/40 bg-[#9e4a5a]/10 text-[#e8a0a8]"
                        : "border-[#d4a35a]/40 bg-[#d4a35a]/10 text-[#e8c98a]"
                    }`}>
                      {statusLabel(candidate.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <section className="border border-[#2a3544] bg-[#0c1018]/90">
              <div className="border-b border-[#2a3544] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a8f8f]">
                      {selected.report.reportType} · FY {selected.report.fiscalYear} · {selected.report.language.toUpperCase()}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
                      {selected.report.companyName || selected.extractedJsonSnapshot.metadata?.companyName || "Unknown company"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/reports/${selected.reportId}`}
                      className="inline-flex min-h-10 items-center gap-2 border border-[#2a3544] px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#c5d0de] transition hover:border-[#2b79db]/40"
                    >
                      <ExternalLink className="size-3.5" />
                      Current
                    </Link>
                    <button
                      type="button"
                      disabled={busy != null || selected.status !== "pending_review"}
                      onClick={() => resolveCandidate(selected.id, "promote")}
                      className="inline-flex min-h-10 items-center gap-2 bg-[#207c5b] px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Check className="size-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => resolveCandidate(selected.id, "reject")}
                      className="inline-flex min-h-10 items-center gap-2 border border-[#9e4a5a]/50 px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8a0a8] transition disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <X className="size-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="mt-4 border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-3 py-2 text-sm text-[#e8a0a8]">
                    {error}
                  </p>
                )}
              </div>

              {selected.qualityWarnings.length > 0 && (
                <div className="border-b border-[#2a3544] p-4 sm:p-5">
                  <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#d4a35a]">
                    Quality warnings
                  </p>
                  <ul className="mt-3 m-0 list-none space-y-2 p-0">
                    {selected.qualityWarnings.map((warning) => (
                      <li key={warning} className="list-none border-l border-[#d4a35a]/50 pl-3 text-sm/6 text-[#e8c98a]">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#2a3544] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#6b7d92]">
                      <th className="px-4 py-3 font-medium">Metric</th>
                      <th className="px-4 py-3 font-medium">Current</th>
                      <th className="px-4 py-3 font-medium">Rerun</th>
                      <th className="px-4 py-3 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map((row) => {
                      const evidenceFacts = formatEvidence(row.rerun?.evidence);
                      return (
                        <tr key={row.key} className="border-b border-[#18202c] align-top">
                          <td className="px-4 py-3 font-medium text-[#f4f6f9]">{row.label}</td>
                          <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-[#8b9aad]">
                            {formatValue(row.current)}
                          </td>
                          <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-[#e8ecf2]">
                            {formatValue(row.rerun)}
                          </td>
                          <td className="max-w-md px-4 py-3">
                            {evidenceFacts && (
                              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#5a8f8f]">
                                {evidenceFacts}
                              </p>
                            )}
                            {row.rerun?.evidence?.snippet ? (
                              <p className="mt-1 break-words text-sm/6 text-[#c5d0de]">
                                {row.rerun.evidence.snippet}
                              </p>
                            ) : (
                              <p className="text-sm text-[#6b7d92]">-</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080b10] font-[family-name:var(--font-body)] text-[#e8ecf2]">
      <AppSiteHeader maxWidthClass="max-w-6xl" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
