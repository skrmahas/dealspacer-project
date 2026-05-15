"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Menu,
  Search,
  Upload,
  KeyRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileTopBar onOpenMenu={openSidebar} />

      <div className="flex min-h-screen md:min-h-[calc(100vh)]">
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

        <main className="flex-1 md:ml-[280px]">
          <WelcomeState companyCount={companies.length} />
        </main>
      </div>
    </div>
  );
}

function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200/80 bg-background/95 px-4 py-3 backdrop-blur md:hidden dark:border-white/10">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={onOpenMenu}
      >
        <Menu className="size-5" />
      </Button>
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Building2 className="size-4 text-primary" />
        <span>DealSpacer</span>
      </Link>
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
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-3 border-r border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 shadow-zinc-950/5 transition-transform duration-200 dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-900/10",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Building2 className="size-4 text-primary" />
            <span>DealSpacer</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={onClose}
            className="md:hidden"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-background pl-8 pr-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXCHANGE_TABS.map((tab) => {
            const active = exchangeFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onExchangeChange(tab.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/20"
                    : "border-zinc-200 bg-background text-muted-foreground hover:bg-muted dark:border-white/10",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Loading companies...
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && totalCount === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No companies found
            </div>
          )}
          {!loading && !error && grouped.map(([exchange, list]) => (
            <div key={exchange} className="mb-4">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {EXCHANGE_SHORT[exchange] ?? exchange} ({list.length})
              </div>
              <ul className="grid gap-0.5">
                {list.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/companies/${c.slug}`}
                      onClick={onClose}
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </div>
                        {c.ticker && (
                          <div className="truncate text-xs text-muted-foreground">
                            {c.ticker}
                          </div>
                        )}
                      </div>
                      {c.reportCount > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          {c.reportCount}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-3 text-sm dark:border-white/10">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
          >
            <Upload className="size-3.5" />
            Upload
          </Link>
          <Link
            href="/access"
            className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <KeyRound className="size-3.5" />
            Access
          </Link>
        </div>
      </aside>
    </>
  );
}

function WelcomeState({ companyCount }: { companyCount: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="grid size-16 place-items-center rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 text-primary shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-900/10">
        <Building2 className="size-7" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {companyCount > 0
          ? `${companyCount} Baltic companies tracked`
          : "Baltic Company Directory"}
      </h1>
      <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground sm:text-base">
        Select a company from the sidebar to view its reports, metrics, and trend
        analysis.
      </p>

      <Card className="mt-8 w-full max-w-md rounded-2xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/40 dark:to-zinc-900/10">
        <CardHeader>
          <CardTitle className="text-base">Need to add a report?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button asChild className="rounded-xl">
            <Link href="/upload">
              <Upload className="size-3.5" />
              Upload a Report
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/access">
              <KeyRound className="size-3.5" />
              Access
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.section>
  );
}
