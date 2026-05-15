"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

interface ReportData {
  id: string; companyId: string | null; fiscalYear: number; reportType: string;
  language: string; extractedJsonSnapshot: any; companyName?: string | null;
  previewRevenue?: number | null; previewEbitda?: number | null; previewNetProfit?: number | null;
}

const REPORT_TYPE_LABEL: Record<string, string> = { annual: "Annual", q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4", "semi-annual": "Semi", other: "Other" };

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  if (Math.abs(val) >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `€${(val / 1e6).toFixed(0)}M`;
  if (Math.abs(val) >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
  return `€${val}`;
}

function labelKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function ComparePage() {
  const params = useSearchParams();
  const idA = params.get("reportA");
  const idB = params.get("reportB");

  const [reportA, setReportA] = useState<ReportData | null>(null);
  const [reportB, setReportB] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) { setError("Select two reports to compare."); setLoading(false); return; }
    if (idA === idB) { setError("Select two different reports to compare."); setLoading(false); return; }

    Promise.all([
      fetch(`/api/reports/${idA}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/reports/${idB}`).then((r) => r.ok ? r.json() : null),
    ]).then(([a, b]) => {
      if (!a || !b) { setError("One or both reports not found."); setLoading(false); return; }
      setReportA(a);
      setReportB(b);
      setLoading(false);
    }).catch((err) => { setError(err.message); setLoading(false); });
  }, [idA, idB]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading comparison...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#c0392b" }}>{error}</p><Link href="/" style={{ color: "#365d9c" }}>Back to directory</Link></div>;
  if (!reportA || !reportB) return <div style={{ padding: 40, textAlign: "center" }}>Reports not found.</div>;

  const snapA = reportA.extractedJsonSnapshot || {};
  const snapB = reportB.extractedJsonSnapshot || {};
  const metricsA: any[] = snapA.metrics || [];
  const metricsB: any[] = snapB.metrics || [];

  // Build shared metrics map
  const metricsMap = new Map<string, { a: any; b: any }>();
  for (const m of metricsA) metricsMap.set(labelKey(m.label), { a: m, b: null });
  for (const m of metricsB) {
    const key = labelKey(m.label);
    if (metricsMap.has(key)) {
      metricsMap.get(key)!.b = m;
    } else {
      metricsMap.set(key, { a: null, b: m });
    }
  }

  // Directional callout
  let aLeads = 0, bLeads = 0;
  const favorableLabels = new Set(["revenue", "ebitda", "net profit", "net income", "operating profit", "eps"]);
  for (const [, { a, b }] of metricsMap) {
    if (a?.value != null && b?.value != null) {
      const label = labelKey(a.label);
      if (favorableLabels.has(label) || label.includes("profit") || label.includes("revenue")) {
        if (a.value > b.value) aLeads++;
        else if (b.value > a.value) bLeads++;
      }
    }
  }
  const totalCompared = aLeads + bLeads;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 48px", fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif", color: "#21324a" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <Link href="/" style={{ color: "#3b5f93" }}><ArrowLeft size={20} /></Link>
        <h1 style={{ margin: 0, fontSize: 22, color: "#0f2e52" }}>
          {snapA.metadata?.companyName || "Report A"} · {reportA.fiscalYear} {REPORT_TYPE_LABEL[reportA.reportType] || reportA.reportType}
          {" vs "}
          {snapB.metadata?.companyName || "Report B"} · {reportB.fiscalYear} {REPORT_TYPE_LABEL[reportB.reportType] || reportB.reportType}
        </h1>
      </div>

      {/* Directional callout */}
      {totalCompared > 0 && (
        <div style={{
          border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px",
          background: aLeads > bLeads ? "#f0f9f0" : bLeads > aLeads ? "#fff5f5" : "#f8fafd",
          marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
        }}>
          {aLeads > bLeads ? <TrendingUp size={18} style={{ color: "#2a8f5d" }} /> :
           bLeads > aLeads ? <TrendingDown size={18} style={{ color: "#c0392b" }} /> :
           null}
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {aLeads > bLeads
              ? `${snapA.metadata?.companyName || "A"} leads on ${aLeads} of ${totalCompared} metrics`
              : bLeads > aLeads
              ? `${snapB.metadata?.companyName || "B"} leads on ${bLeads} of ${totalCompared} metrics`
              : `Both reports are tied on ${totalCompared} metrics`}
          </span>
        </div>
      )}

      {/* Metrics comparison table */}
      <h2 style={{ fontSize: 18, color: "#0f2e52", marginBottom: 10 }}>Metrics</h2>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafd", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#687991" }}>
          <span>Metric</span>
          <span>{snapA.metadata?.companyName || "A"}</span>
          <span>Δ</span>
          <span>{snapB.metadata?.companyName || "B"}</span>
        </div>
        {[...metricsMap.entries()].map(([key, { a, b }]) => {
          const label = a?.label || b?.label;
          const valA = a?.value;
          const valB = b?.value;
          const unit = a?.unit || b?.unit || "";
          const fmt = (v: number | null) => `${fmtCurrency(v)}${v != null && unit ? " " + unit : ""}`;
          let delta: string | null = null;
          let deltaColor = "#687991";
          if (valA != null && valB != null && valA !== 0) {
            const pct = ((valB - valA) / Math.abs(valA)) * 100;
            delta = `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(1)}%`;
            deltaColor = pct > 0 ? "#2a8f5d" : pct < 0 ? "#c0392b" : "#687991";
          }
          const isFavorable = favorableLabels.has(key) || key.includes("profit") || key.includes("revenue");
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f0f3f7", alignItems: "center", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ color: valA != null ? "#173b68" : "#94a3b8", fontWeight: valA != null ? 600 : 400 }}>{fmt(valA)}</span>
              <span style={{ color: deltaColor, fontWeight: 600, fontSize: 12 }}>{delta || "—"}</span>
              <span style={{ color: valB != null ? "#173b68" : "#94a3b8", fontWeight: valB != null ? 600 : 400 }}>{fmt(valB)}</span>
            </div>
          );
        })}
      </div>

      {/* Sentiment comparison */}
      {(snapA.sentiment || snapB.sentiment) && (
        <>
          <h2 style={{ fontSize: 18, color: "#0f2e52", marginBottom: 10 }}>Sentiment</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            {["managementTone", "outlook"].map((field) => (
              <React.Fragment key={field}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#fdfeff" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#687991", marginBottom: 6 }}>
                    {field === "managementTone" ? "Management Tone" : "Outlook"} — {snapA.metadata?.companyName || "A"}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#4d627f" }}>
                    {snapA.sentiment?.[field === "managementTone" ? "managementTone" : "outlook"] || "—"}
                  </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#fdfeff" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#687991", marginBottom: 6 }}>
                    {field === "managementTone" ? "Management Tone" : "Outlook"} — {snapB.metadata?.companyName || "B"}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#4d627f" }}>
                    {snapB.sentiment?.[field === "managementTone" ? "managementTone" : "outlook"] || "—"}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Link href={`/companies/${reportA.companyId || ""}`} style={{ color: "#365d9c", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← {snapA.metadata?.companyName || "Report A"}
        </Link>
        <Link href={`/companies/${reportB.companyId || ""}`} style={{ color: "#365d9c", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← {snapB.metadata?.companyName || "Report B"}
        </Link>
      </div>
    </div>
  );
}
