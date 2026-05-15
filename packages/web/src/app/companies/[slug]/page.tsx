"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, FileText, Download, ExternalLink } from "lucide-react";

interface Company {
  id: string; name: string; ticker: string | null; exchange: string;
  slug: string; country: string | null; sector: string | null; reportCount: number;
}

interface Report {
  id: string; companyId: string | null; fiscalYear: number; reportType: string;
  language: string; jobId: string | null; s3Key: string;
  previewRevenue?: number | null; previewEbitda?: number | null;
  previewNetProfit?: number | null; companyName?: string | null; createdAt: string;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  annual: "Annual", q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4", "semi-annual": "Semi", other: "Other",
};

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Fetch company by slug via companies API
        const compRes = await fetch("/api/companies");
        if (!compRes.ok) throw new Error("Failed to load company");
        const companies: Company[] = await compRes.json();
        const found = companies.find((c) => c.slug === slug) || null;
        if (cancelled) return;
        setCompany(found);

        if (found) {
          const repRes = await fetch(`/api/companies/${slug}/reports`);
          if (repRes.ok) {
            const reps: Report[] = await repRes.json();
            if (!cancelled) setReports(reps);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      // Max 2 — if already 2 selected, remove oldest and add new
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
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#c0392b" }}>{error}</p>
        <Link href="/" style={{ color: "#365d9c", fontWeight: 600 }}>Back to directory</Link>
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "#0f2e52" }}>Company not found</h2>
        <p style={{ color: "#5f6f83" }}>The company &quot;{slug}&quot; does not exist in our directory.</p>
        <Link href="/" style={{ color: "#365d9c", fontWeight: 600 }}>Back to directory</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 48px", fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif", color: "#21324a" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <Link href="/" style={{ color: "#3b5f93", marginTop: 4 }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: "#0f2e52" }}>{company.name}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
            {company.ticker && (
              <span style={{ fontSize: 14, fontWeight: 600, color: "#3b5f93" }}>{company.ticker}</span>
            )}
            <span style={{ fontSize: 12, background: "#edf2ff", color: "#2d5fbf", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
              {company.exchange}
            </span>
            <span style={{ fontSize: 12, color: "#8b9cb8" }}>
              {company.reportCount} report{company.reportCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <Link
          href={`/app?company=${slug}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(90deg, #5d7dff, #63d2ff)", color: "#fff",
            fontWeight: 700, textDecoration: "none", fontSize: 14, whiteSpace: "nowrap",
          }}
        >
          <Plus size={16} /> Add Report
        </Link>
      </div>

      {/* Empty state */}
      {reports.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <FileText size={48} style={{ color: "#bcc8d8", marginBottom: 16 }} />
          <h2 style={{ color: "#0f2e52", margin: "0 0 8px" }}>No reports yet for {company.name}</h2>
          <p style={{ color: "#5f6f83", marginBottom: 20 }}>Add the first report to see it here.</p>
          <Link
            href={`/app?company=${slug}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 10,
              background: "linear-gradient(90deg, #5d7dff, #63d2ff)", color: "#fff",
              fontWeight: 700, textDecoration: "none",
            }}
          >
            <Plus size={16} /> Add First Report
          </Link>
        </div>
      )}

      {/* Report timeline */}
      {reports.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#0f2e52" }}>Reports</h2>
            {selected.size === 2 && (
              <button
                onClick={goCompare}
                style={{
                  border: "none", borderRadius: 10, padding: "10px 20px",
                  background: "linear-gradient(90deg, #5d7dff, #63d2ff)", color: "#fff",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <ExternalLink size={14} /> Compare Selected
              </button>
            )}
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "40px 80px 70px 1fr 1fr 1fr 100px 130px",
              gap: 8, padding: "10px 14px", background: "#f8fafd", borderBottom: "1px solid #e2e8f0",
              fontSize: 11, fontWeight: 700, color: "#687991", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span></span>
              <span>Year</span>
              <span>Type</span>
              <span>Revenue</span>
              <span>EBITDA</span>
              <span>Net Profit</span>
              <span>Date</span>
              <span>Actions</span>
            </div>

            {reports.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid", gridTemplateColumns: "40px 80px 70px 1fr 1fr 1fr 100px 130px",
                  gap: 8, padding: "12px 14px", borderBottom: "1px solid #f0f3f7",
                  alignItems: "center", fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600 }}>{r.fiscalYear}</span>
                <span style={{ color: "#607287" }}>{REPORT_TYPE_LABEL[r.reportType] || r.reportType}</span>
                <span style={{ fontWeight: 600, color: "#173b68" }}>{fmtCurrency(r.previewRevenue)}</span>
                <span style={{ fontWeight: 600, color: "#173b68" }}>{fmtCurrency(r.previewEbitda)}</span>
                <span style={{ fontWeight: 600, color: "#173b68" }}>{fmtCurrency(r.previewNetProfit)}</span>
                <span style={{ color: "#8b9cb8", fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {r.jobId && (
                    <a
                      href={`/api/jobs/${r.jobId}/download`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#365d9c", textDecoration: "none", fontSize: 12, fontWeight: 600 }}
                    >
                      <Download size={12} /> PDF
                    </a>
                  )}
                  <Link
                    href={`/reports/${r.id}`}
                    style={{ color: "#365d9c", textDecoration: "none", fontSize: 12, fontWeight: 600 }}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
