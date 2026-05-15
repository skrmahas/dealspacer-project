"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  KeyRound,
  Menu,
  Search,
  Upload,
  X,
} from "lucide-react";
import { DealSpacerLogoLink } from "@/components/deal-spacer-logo";
import { Button } from "@/components/ui/button";
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

type ExchangeFilter = "All" | "Nasdaq Tallinn" | "Nasdaq Riga" | "Nasdaq Vilnius";

const EXCHANGE_TABS: { value: ExchangeFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Nasdaq Tallinn", label: "Tallinn" },
  { value: "Nasdaq Riga", label: "Riga" },
  { value: "Nasdaq Vilnius", label: "Vilnius" },
];

const EXCHANGE_ORDER: Record<string, number> = {
  "Nasdaq Tallinn": 0,
  "Nasdaq Riga": 1,
  "Nasdaq Vilnius": 2,
};

const EXCHANGE_SHORT: Record<string, string> = {
  "Nasdaq Tallinn": "Tallinn",
  "Nasdaq Riga": "Riga",
  "Nasdaq Vilnius": "Vilnius",
};

const EXCHANGE_ACCENT: Record<string, string> = {
  "Nasdaq Tallinn": "#4a7ab8",
  "Nasdaq Riga": "#9e4a5a",
  "Nasdaq Vilnius": "#8a9e4a",
};

export default function CompanyCatalogPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          setError(data.error || "Failed to load companies");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = companies;
    if (exchangeFilter !== "All") {
      list = list.filter((c) => c.exchange === exchangeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ticker ? c.ticker.toLowerCase().includes(q) : false),
      );
    }
    return list;
  }, [companies, exchangeFilter, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Company[]>();
    for (const c of filtered) {
      const list = groups.get(c.exchange) ?? [];
      list.push(c);
      groups.set(c.exchange, list);
    }
    return Array.from(groups.entries()).sort(
      ([a], [b]) => (EXCHANGE_ORDER[a] ?? 99) - (EXCHANGE_ORDER[b] ?? 99),
    );
  }, [filtered]);

  const totalReports = useMemo(
    () => companies.reduce((sum, c) => sum + c.reportCount, 0),
    [companies],
  );

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "catalog-page relative min-h-screen",
        "bg-[#080b10] text-[#e8ecf2]",
        "font-[family-name:var(--font-body)]",
      )}
    >
      <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="landing-aurora pointer-events-none fixed inset-0 z-0 opacity-70" aria-hidden />

      <MobileTopBar onOpenMenu={openSidebar} filteredCount={filtered.length} />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          search={search}
          onSearch={setSearch}
          exchangeFilter={exchangeFilter}
          onExchangeChange={setExchangeFilter}
          loading={loading}
          error={error}
          grouped={grouped}
          totalCount={filtered.length}
        />

        <main className="flex min-h-[calc(100vh-53px)] flex-1 flex-col md:ml-[300px] md:min-h-screen">
          <WelcomeState
            companyCount={companies.length}
            filteredCount={filtered.length}
            totalReports={totalReports}
            exchangeFilter={exchangeFilter}
            grouped={grouped}
          />
        </main>
      </div>
    </motion.div>
  );
}

function MobileTopBar({
  onOpenMenu,
  filteredCount,
}: {
  onOpenMenu: () => void;
  filteredCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#2b79db]/12 bg-[#080b10]/90 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="size-9 rounded-none text-[#e8ecf2] hover:bg-[#2b79db]/10"
        >
          <Menu className="size-5" />
        </Button>
        <DealSpacerLogoLink />
      </div>
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b7d92]">
        {filteredCount} listed
      </span>
    </header>
  );
}

function Sidebar({
  isOpen,
  onClose,
  search,
  onSearch,
  exchangeFilter,
  onExchangeChange,
  loading,
  error,
  grouped,
  totalCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearch: (v: string) => void;
  exchangeFilter: ExchangeFilter;
  onExchangeChange: (v: ExchangeFilter) => void;
  loading: boolean;
  error: string | null;
  grouped: [string, Company[]][];
  totalCount: number;
}) {
  return (
    <>
      {isOpen && (
        <button
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#040608]/70 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[300px] flex-col overflow-x-hidden border-r border-[#2b79db]/15 bg-[#0a0e14]/95 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="min-w-0 shrink-0 border-b border-[#1e2733] px-4 py-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <DealSpacerLogoLink onClick={onClose} />
              <span className="text-sm font-medium text-[#9aa8bc]">Catalog</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close menu"
              onClick={onClose}
              className="size-8 rounded-none text-[#8b9aad] hover:bg-[#2b79db]/10 md:hidden"
            >
              <X className="size-4" />
            </Button>
          </div>

          <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">
            Company directory
          </p>

          <div className="relative mt-4 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#5a8f8f]" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="box-border h-10 w-full min-w-0 max-w-full border border-[#2a3544] bg-[#080b10] pl-9 pr-3 text-sm text-[#e8ecf2] placeholder:text-[#6b7d92] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b79db]/50"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {EXCHANGE_TABS.map((tab) => {
              const active = exchangeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onExchangeChange(tab.value)}
                  className={cn(
                    "border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] transition",
                    active
                      ? "border-[#2b79db]/50 bg-[#2b79db]/12 text-[#b8d4f5]"
                      : "border-[#2a3544] text-[#6b7d92] hover:border-[#3d4d62] hover:text-[#9aa8bc]",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {loading && (
            <p className="px-3 py-8 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[#6b7d92]">
              Loading companies...
            </p>
          )}
          {error && (
            <p className="mx-2 border border-[#9e4a5a]/40 bg-[#9e4a5a]/10 px-3 py-2 text-sm text-[#e8a0a8]">
              {error}
            </p>
          )}
          {!loading && !error && totalCount === 0 && (
            <p className="px-3 py-8 text-center text-sm text-[#6b7d92]">
              No companies found
            </p>
          )}
          {!loading &&
            !error &&
            grouped.map(([exchange, list]) => (
              <div key={exchange} className="mb-5">
                <div
                  className="mb-1.5 flex items-center gap-2 px-2 py-1"
                  style={{ borderLeft: `2px solid ${EXCHANGE_ACCENT[exchange] ?? "#5a8f8f"}` }}
                >
                  <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.16em] text-[#6b7d92]">
                    {EXCHANGE_SHORT[exchange] ?? exchange} ({list.length})
                  </span>
                </div>
                <ul className="m-0 list-none p-0">
                  {list.map((c) => (
                    <li key={c.id} className="list-none">
                      <Link
                        href={`/companies/${c.slug}`}
                        onClick={onClose}
                        className="group flex items-center gap-3 border border-transparent px-2 py-2.5 transition hover:border-[#2a3544] hover:bg-[#0f141c]"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center border border-[#2a3544] bg-[#080b10] font-[family-name:var(--font-mono)] text-[9px] text-[#5a8f8f] transition group-hover:border-[#2b79db]/30 group-hover:text-[#2b79db]">
                          {(c.ticker ?? c.name.slice(0, 3)).slice(0, 4)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[#e8ecf2] transition group-hover:text-[#f4f6f9]">
                            {c.name}
                          </span>
                          {c.ticker && (
                            <span className="block truncate font-[family-name:var(--font-mono)] text-[10px] tracking-wide text-[#6b7d92]">
                              {c.ticker}
                              {c.sector ? ` · ${c.sector}` : ""}
                            </span>
                          )}
                        </span>
                        {c.reportCount > 0 && (
                          <span
                            aria-label={`${c.reportCount} reports`}
                            className="shrink-0 border border-[#2b79db]/25 bg-[#2b79db]/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-[#b8d4f5]"
                          >
                            {c.reportCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#1e2733] px-4 py-3">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8ecf2] transition hover:text-[#2b79db]"
          >
            <Upload className="size-3.5" />
            Upload
          </Link>
          <Link
            href="/access"
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#6b7d92] transition hover:text-[#e8ecf2]"
          >
            <KeyRound className="size-3.5" />
            Access
          </Link>
        </div>
      </aside>
    </>
  );
}

function WelcomeState({
  companyCount,
  filteredCount,
  totalReports,
  exchangeFilter,
  grouped,
}: {
  companyCount: number;
  filteredCount: number;
  totalReports: number;
  exchangeFilter: ExchangeFilter;
  grouped: [string, Company[]][];
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      className="flex flex-1 flex-col justify-center px-6 py-12 md:px-14 md:py-16 lg:px-20"
    >
      <div className="mx-auto w-full max-w-2xl md:max-w-none">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[#5a8f8f]">
          Baltic listed companies
        </p>

        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.05] tracking-tight text-[#f4f6f9]">
          {companyCount > 0
            ? `${companyCount} Baltic companies tracked`
            : "Baltic Company Directory"}
        </h1>

        <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-[#8b9aad]">
          Select a company from the sidebar to view its reports, metrics, and
          trend analysis.
        </p>

        {companyCount > 0 && (
          <dl className="mt-10 grid gap-px border border-[#2a3544] bg-[#2a3544] sm:grid-cols-3">
            <StatBlock label="In view" value={String(filteredCount)} />
            <StatBlock label="Reports in catalog" value={String(totalReports)} />
            <StatBlock label="Languages" value="4" />
          </dl>
        )}

        {exchangeFilter !== "All" && (
          <p className="mt-6 font-[family-name:var(--font-mono)] text-[11px] text-[#5a8f8f]">
            Filtered to{" "}
            <span className="text-[#2b79db]">
              {EXCHANGE_SHORT[exchangeFilter] ?? exchangeFilter}
            </span>
          </p>
        )}

        <div className="relative mt-12 max-w-md border border-[#2a3544] bg-[#0c1018]/80 p-6">
          <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l border-t border-[#2b79db]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[#f4f6f9]">
            Need to add a report?
          </h2>
          <p className="mt-2 text-sm text-[#8b9aad]">
            Upload a filing to run the extraction pipeline and expand the
            catalog.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              asChild
              className="h-10 rounded-none border-0 bg-[#2b79db] px-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#3d8de8]"
            >
              <Link href="/upload">
                <Upload className="size-3.5" />
                Upload a Report
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-none border-[#3d4d62] bg-transparent px-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#c5d0de] hover:border-[#5a8f8f]/50 hover:bg-[#5a8f8f]/8"
            >
              <Link href="/access">
                <KeyRound className="size-3.5" />
                Access
              </Link>
            </Button>
          </div>
        </div>

        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#6b7d92] transition hover:text-[#2b79db]"
        >
          Back to home
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </motion.section>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0c1018] px-5 py-4">
      <dt className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7d92]">
        {label}
      </dt>
      <dd className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tabular-nums text-[#f4f6f9]">
        {value}
      </dd>
    </div>
  );
}
