"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { AppSiteHeader } from "@/components/app-site-header";

interface UnmatchedReport {
  id: string;
  companyId: null;
  fiscalYear: number;
  reportType: string;
  language: string;
  jobId: string | null;
  s3Key: string;
  extractedJsonSnapshot: { metadata?: { companyName?: string } } | null;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  exchange: string;
  slug: string;
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
  const [createForm, setCreateForm] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newExchange, setNewExchange] = useState("Nasdaq Tallinn");
  const [newSlug, setNewSlug] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/unmatched").then((r) => r.json()),
      fetch("/api/companies").then((r) => r.json()),
    ])
      .then(([repData, compData]) => {
        if (Array.isArray(repData)) setReports(repData);
        if (Array.isArray(compData)) setCompanies(compData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function mapReport(reportId: string, companyId: string) {
    await fetch(`/api/reports/${reportId}/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setOpenDropdown(null);
  }

  async function createAndMap(reportId: string) {
    const res = await fetch("/api/companies/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        ticker: newTicker || null,
        exchange: newExchange,
        slug: newSlug,
      }),
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

  if (loading) {
    return (
      <AdminShell>
        <p className="py-16 text-center text-[#8b9aad]">Loading…</p>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <p className="py-16 text-center text-red-300">{error}</p>
      </AdminShell>
    );
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
          Unmatched reports
        </h1>
        <span className="rounded-full border border-[#2b79db]/30 bg-[#2b79db]/10 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#b8d4f5]">
          {reports.length}
        </span>
      </div>

      {reports.length === 0 ? (
        <p className="py-16 text-center text-[#8b9aad]">
          All reports are mapped to companies. Nothing to review.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const name = r.extractedJsonSnapshot?.metadata?.companyName || "Unknown";
            return (
              <li
                key={r.id}
                className="border border-[#2a3544] bg-[#0c1018]/90 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#f4f6f9]">{name}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] text-[#8b9aad]">
                      <span>FY {r.fiscalYear}</span>
                      <span>{r.reportType}</span>
                      <span>{r.language?.toUpperCase()}</span>
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(openDropdown === r.id ? null : r.id)
                      }
                      className="w-full border border-[#2a3544] bg-[#080b10] px-4 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8ecf2] transition hover:border-[#2b79db]/40 sm:w-auto"
                    >
                      Map ▾
                    </button>
                    {openDropdown === r.id && (
                      <div className="absolute right-0 z-10 mt-1 max-h-60 w-full min-w-[220px] overflow-y-auto border border-[#2a3544] bg-[#0c1018] shadow-lg sm:w-56">
                        {companies.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => mapReport(r.id, c.id)}
                            className="block w-full px-3 py-2 text-left text-sm text-[#c5d0de] transition hover:bg-[#2b79db]/10"
                          >
                            {c.name} ({c.exchange.replace("Nasdaq ", "")})
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => startCreate(r.id, name)}
                          className="flex w-full items-center gap-2 border-t border-[#2a3544] bg-[#080b10] px-3 py-2 text-left text-sm font-medium text-[#2b79db]"
                        >
                          <Plus className="size-3.5" />
                          Create new company
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {createForm === r.id && (
                  <div className="mt-4 grid gap-3 border-t border-[#2a3544] pt-4 sm:grid-cols-2">
                    <label className="block text-[11px] text-[#6b7d92]">
                      Name
                      <input
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value);
                          setNewSlug(slugify(e.target.value));
                        }}
                        className="mt-1 w-full border border-[#2a3544] bg-[#080b10] px-3 py-2 text-sm text-[#e8ecf2]"
                      />
                    </label>
                    <label className="block text-[11px] text-[#6b7d92]">
                      Ticker
                      <input
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value)}
                        className="mt-1 w-full border border-[#2a3544] bg-[#080b10] px-3 py-2 text-sm text-[#e8ecf2]"
                      />
                    </label>
                    <label className="block text-[11px] text-[#6b7d92]">
                      Exchange
                      <select
                        value={newExchange}
                        onChange={(e) => setNewExchange(e.target.value)}
                        className="mt-1 w-full border border-[#2a3544] bg-[#080b10] px-3 py-2 text-sm text-[#e8ecf2]"
                      >
                        {EXCHANGES.map((ex) => (
                          <option key={ex} value={ex}>
                            {ex}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] text-[#6b7d92]">
                      Slug
                      <input
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value)}
                        className="mt-1 w-full border border-[#2a3544] bg-[#080b10] px-3 py-2 text-sm text-[#e8ecf2]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => createAndMap(r.id)}
                        className="inline-flex items-center gap-2 bg-[#2b79db] px-4 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-white"
                      >
                        <Check className="size-3.5" />
                        Create &amp; map
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm(null)}
                        className="border border-[#2a3544] px-4 py-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#8b9aad]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080b10] font-[family-name:var(--font-body)] text-[#e8ecf2]">
      <AppSiteHeader maxWidthClass="max-w-5xl" />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
