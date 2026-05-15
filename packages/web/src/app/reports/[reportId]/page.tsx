"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Share2, Building2 } from "lucide-react";
import { ReportSummary } from "@/components/report-summary";

interface Report {
  id: string; companyId: string | null; fiscalYear: number; reportType: string;
  language: string; jobId: string | null; s3Key: string;
  extractedJsonSnapshot: any; createdAt: string;
}

const REPORT_TYPE_LABEL: Record<string, string> = { annual: "Annual", q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4", "semi-annual": "Semi", other: "Other" };

export default function ReportViewPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setReport(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/reports/${reportId}` : "";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#c0392b" }}>{error}</p><Link href="/" style={{ color: "#365d9c" }}>Back to directory</Link></div>;
  if (!report) return <div style={{ padding: 40, textAlign: "center" }}><h2>Report not found</h2><Link href="/" style={{ color: "#365d9c" }}>Back to directory</Link></div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 48px", fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif", color: "#21324a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Link href="/" style={{ color: "#3b5f93" }}><ArrowLeft size={20} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: "#0f2e52" }}>Report</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{report.fiscalYear}</span>
            <span style={{ fontSize: 12, background: "#edf2ff", borderRadius: 999, padding: "2px 8px", fontWeight: 600, color: "#2d5fbf" }}>
              {REPORT_TYPE_LABEL[report.reportType] || report.reportType}
            </span>
            <span style={{ fontSize: 12, color: "#8b9cb8" }}>{report.language?.toUpperCase()}</span>
          </div>
        </div>
        {report.companyId && (
          <Link href={`/companies/${report.extractedJsonSnapshot?.metadata?.companyName?.toLowerCase().replace(/\s+/g, "-") || ""}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#365d9c", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <Building2 size={14} /> Company
          </Link>
        )}
      </div>

      {/* PDF embed */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <iframe
          src={`/api/reports/${reportId}/download`}
          style={{ width: "100%", height: 600, border: 0 }}
          title="Report PDF"
        />
      </div>

      {/* Metrics summary */}
      {report.extractedJsonSnapshot && (
        <div style={{ marginBottom: 20 }}>
          <ReportSummary extractedJson={JSON.stringify(report.extractedJsonSnapshot)} />
        </div>
      )}

      {/* Share + Download */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a href={`/api/reports/${reportId}/download`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(90deg, #5d7dff, #63d2ff)", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
          <Download size={14} /> Download PDF
        </a>
        <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10,
            border: "1px solid #cdd9eb", background: "#fff", color: "#365d9c", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          <Share2 size={14} /> {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
