"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Plus } from "lucide-react";
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
const fieldLabelClassName =
  "block font-[family-name:var(--font-mono)] text-base/6 uppercase tracking-[0.12em] text-[#6b7d92] sm:text-[11px]";
const fieldControlClassName =
  "mt-1.5 w-full border border-[#2a3544] bg-[#080b10] px-3 py-2.5 text-base/6 normal-case text-[#e8ecf2] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b79db]/50 sm:py-2 sm:text-sm";

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
        <ul className="m-0 list-none space-y-3 p-0">
          {reports.map((r) => {
            const name = r.extractedJsonSnapshot?.metadata?.companyName || "Unknown";
            return (
              <li
                key={r.id}
                className="list-none border border-[#2a3544] bg-[#0c1018]/90 p-4 sm:p-5"
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
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#2a3544] bg-[#080b10] px-3 py-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8ecf2] transition hover:border-[#2b79db]/40 sm:min-h-9 sm:w-auto sm:py-2"
                    >
                      Map
                      <ChevronDown className="size-3.5" aria-hidden />
                    </button>
                    {openDropdown === r.id && (
                      <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 w-full min-w-0 overflow-y-auto border border-[#2a3544] bg-[#0c1018] shadow-lg sm:left-auto sm:w-64 sm:min-w-[240px]">
                        {companies.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => mapReport(r.id, c.id)}
                            className="block w-full px-3 py-3 text-left text-base/6 text-[#c5d0de] transition hover:bg-[#2b79db]/10 sm:py-2.5 sm:text-sm"
                          >
                            {c.name} ({c.exchange.replace("Nasdaq ", "")})
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => startCreate(r.id, name)}
                          className="flex w-full items-center gap-2 border-t border-[#2a3544] bg-[#080b10] px-3 py-3 text-left text-base/6 font-medium text-[#2b79db] sm:py-2.5 sm:text-sm"
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
                    <label className={fieldLabelClassName}>
                      Name
                      <input
                        name="companyName"
                        type="text"
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value);
                          setNewSlug(slugify(e.target.value));
                        }}
                        className={fieldControlClassName}
                      />
                    </label>
                    <label className={fieldLabelClassName}>
                      Ticker
                      <input
                        name="ticker"
                        type="text"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value)}
                        className={fieldControlClassName}
                      />
                    </label>
                    <label className={fieldLabelClassName}>
                      Exchange
                      <span className="mt-1.5 grid grid-cols-[1fr_2rem]">
                        <select
                          name="exchange"
                          value={newExchange}
                          onChange={(e) => setNewExchange(e.target.value)}
                          className={`${fieldControlClassName} col-span-full row-start-1 mt-0 appearance-none pr-8`}
                        >
                          {EXCHANGES.map((ex) => (
                            <option key={ex} value={ex}>
                              {ex}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center text-[#6b7d92]"
                          aria-hidden
                        />
                      </span>
                    </label>
                    <label className={fieldLabelClassName}>
                      Slug
                      <input
                        name="slug"
                        type="text"
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value)}
                        className={fieldControlClassName}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => createAndMap(r.id)}
                        className="inline-flex min-h-11 items-center gap-2 bg-[#2b79db] py-2.5 pr-3 pl-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:min-h-9 sm:py-2"
                      >
                        <Check className="size-3.5" />
                        Create &amp; map
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm(null)}
                        className="min-h-11 border border-[#2a3544] px-3 py-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#8b9aad] transition hover:border-[#3d4d62] hover:text-[#c5d0de] sm:min-h-9 sm:py-2"
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
