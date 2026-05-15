"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus } from "lucide-react";

interface UnmatchedReport {
  id: string; companyId: null; fiscalYear: number; reportType: string;
  language: string; jobId: string | null; s3Key: string;
  extractedJsonSnapshot: any; createdAt: string;
}

interface Company {
  id: string; name: string; exchange: string; slug: string;
}

const EXCHANGES = ["Nasdaq Tallinn", "Nasdaq Riga", "Nasdaq Vilnius"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminUnmatchedPage() {
  const [reports, setReports] = useState<UnmatchedReport[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<string | null>(null); // reportId
  const [newName, setNewName] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newExchange, setNewExchange] = useState("Nasdaq Tallinn");
  const [newSlug, setNewSlug] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/unmatched").then((r) => r.json()),
      fetch("/api/companies").then((r) => r.json()),
    ]).then(([repData, compData]) => {
      if (Array.isArray(repData)) setReports(repData);
      if (Array.isArray(compData)) setCompanies(compData);
    }).catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  async function mapReport(reportId: string, companyId: string) {
    await fetch(`/api/reports/${reportId}/map`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setOpenDropdown(null);
  }

  async function createAndMap(reportId: string) {
    const res = await fetch("/api/companies/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, ticker: newTicker || null, exchange: newExchange, slug: newSlug }),
    });
    if (!res.ok) return;
    const company = await res.json();
    await mapReport(reportId, company.id);
    setCreateForm(null);
  }

  function startCreate(reportId: string, extractedName: string) {
    setCreateForm(reportId);
    setNewName(extractedName);
    setNewSlug(slugify(extractedName));
    setNewTicker("");
    setNewExchange("Nasdaq Tallinn");
    setOpenDropdown(null);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#c0392b" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px", fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif", color: "#21324a" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <Link href="/companies" style={{ color: "#3b5f93" }} aria-label="Back to catalog"><ArrowLeft size={20} /></Link>
        <h1 style={{ margin: 0, fontSize: 24, color: "#0f2e52" }}>Unmatched Reports</h1>
        <span style={{ fontSize: 12, background: "#edf2ff", borderRadius: 999, padding: "3px 10px", color: "#2d5fbf", fontWeight: 600 }}>
          {reports.length}
        </span>
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p style={{ fontSize: 16, color: "#5f6f83" }}>All reports are mapped to companies. Nothing to review.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 60px 1fr", gap: 8, padding: "10px 14px", background: "#f8fafd", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#687991" }}>
            <span>AI-Extracted Name</span>
            <span>Year</span>
            <span>Type</span>
            <span>Lang</span>
            <span>Action</span>
          </div>
          {reports.map((r) => {
            const name = r.extractedJsonSnapshot?.metadata?.companyName || "Unknown";
            return (
              <React.Fragment key={r.id}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 60px 1fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f0f3f7", alignItems: "center", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span>{r.fiscalYear}</span>
                  <span style={{ color: "#607287" }}>{r.reportType}</span>
                  <span style={{ color: "#8b9cb8" }}>{r.language?.toUpperCase()}</span>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setOpenDropdown(openDropdown === r.id ? null : r.id)}
                      style={{ border: "1px solid #cfd8e3", borderRadius: 6, padding: "4px 10px", background: "#fff", cursor: "pointer", fontSize: 12 }}>
                      Map ▾
                    </button>
                    {openDropdown === r.id && (
                      <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 250, overflowY: "auto", minWidth: 200 }}>
                        {companies.map((c) => (
                          <button key={c.id} onClick={() => mapReport(r.id, c.id)}
                            style={{ display: "block", width: "100%", border: "none", background: "none", padding: "8px 12px", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
                            {c.name} ({c.exchange.replace("Nasdaq ", "")})
                          </button>
                        ))}
                        <button onClick={() => startCreate(r.id, name)}
                          style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", border: "none", background: "#f8fafd", padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#365d9c", borderTop: "1px solid #e2e8f0" }}>
                          <Plus size={12} /> Create new company
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {createForm === r.id && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "12px 14px", background: "#f8fafd", borderBottom: "1px solid #e2e8f0", fontSize: 13 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "#687991" }}>Name</label>
                      <input value={newName} onChange={(e) => { setNewName(e.target.value); setNewSlug(slugify(e.target.value)); }}
                        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd8e3", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "#687991" }}>Ticker</label>
                      <input value={newTicker} onChange={(e) => setNewTicker(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd8e3", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "#687991" }}>Exchange</label>
                      <select value={newExchange} onChange={(e) => setNewExchange(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd8e3", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}>
                        {EXCHANGES.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "#687991" }}>Slug</label>
                      <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd8e3", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                      <button onClick={() => createAndMap(r.id)}
                        style={{ display: "flex", alignItems: "center", gap: 4, border: "none", borderRadius: 6, padding: "6px 14px", background: "#365d9c", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <Check size={14} /> Create & Map
                      </button>
                      <button onClick={() => setCreateForm(null)}
                        style={{ border: "1px solid #cfd8e3", borderRadius: 6, padding: "6px 14px", background: "#fff", color: "#607287", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
