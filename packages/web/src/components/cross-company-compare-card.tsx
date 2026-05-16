"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Scale, Search } from "lucide-react";
import type { ReportWithPreview } from "@bei/shared";
import { Button } from "@/components/ui/button";
import { REPORT_TYPE_LABEL } from "@/lib/compare-utils";
import { cn } from "@/lib/utils";

function reportOptionLabel(report: ReportWithPreview): string {
  const company =
    report.companyName?.trim() ||
    report.extractedJsonSnapshot?.metadata?.companyName?.trim() ||
    "Unmatched filing";
  const type = REPORT_TYPE_LABEL[report.reportType] ?? report.reportType;
  return `${company} · FY ${report.fiscalYear} · ${type} · ${report.language.toUpperCase()}`;
}

const selectClassName = cn(
  "col-span-full row-start-1 box-border h-11 w-full appearance-none border border-[#2a3544] bg-[#080b10] py-2.5 pl-3 pr-8 sm:h-10 sm:py-2",
  "text-base/6 text-[#e8ecf2] sm:text-sm/6",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b79db]/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function ReportSelect({
  id,
  name,
  value,
  onChange,
  reports,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  reports: ReportWithPreview[];
}) {
  return (
    <span className="mt-1.5 inline-grid w-full grid-cols-[1fr_2rem]">
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        <option value="">Select a filing...</option>
        {reports.map((r) => (
          <option key={r.id} value={r.id}>
            {reportOptionLabel(r)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center text-[#5a8f8f] sm:size-3.5"
        aria-hidden
      />
    </span>
  );
}

export function CrossCompanyCompareCard() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [reportA, setReportA] = useState("");
  const [reportB, setReportB] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports?forCompare=1&limit=200")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setReports(data);
        } else {
          setLoadError(data.error || "Failed to load reports");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => reportOptionLabel(r).toLowerCase().includes(q));
  }, [reports, filter]);

  const canCompare =
    reportA.length > 0 && reportB.length > 0 && reportA !== reportB && !loading;

  function handleCompare() {
    if (!canCompare) return;
    router.push(
      `/compare?reportA=${encodeURIComponent(reportA)}&reportB=${encodeURIComponent(reportB)}`,
    );
  }

  return (
    <div className="relative border border-[#2a3544] bg-[#0c1018]/80 p-6">
      <span className="pointer-events-none absolute -right-px -top-px block size-2 border-r border-t border-[#5a8f8f]" />
      <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[#f4f6f9]">
        Compare across companies
      </h2>
      <p className="mt-2 text-sm text-[#8b9aad]">
        Pick any two filings from the catalog — not limited to a single issuer.
      </p>

      {loading ? (
        <p className="mt-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b7d92]">
          Loading catalog reports...
        </p>
      ) : loadError ? (
        <p className="mt-5 text-sm text-[#e8a0a8]">{loadError}</p>
      ) : reports.length === 0 ? (
        <p className="mt-5 text-sm text-[#6b7d92]">
          No reports in the catalog yet. Upload a filing to enable comparisons.
        </p>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            className="relative mt-5"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5a8f8f] sm:size-3.5" />
            <input
              name="reportFilter"
              aria-label="Filter reports"
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by company, year..."
              className="box-border h-11 w-full border border-[#2a3544] bg-[#080b10] pl-9 pr-3 text-base/6 text-[#e8ecf2] placeholder:text-[#6b7d92] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b79db]/50 sm:h-10 sm:text-sm/6"
            />
          </motion.div>

          <div className="mt-4 grid gap-3">
            <label className="block" htmlFor="compare-report-a">
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#4f9bff]">
                Report A
              </span>
              <ReportSelect
                id="compare-report-a"
                name="reportA"
                value={reportA}
                onChange={setReportA}
                reports={filtered}
              />
            </label>
            <label className="block" htmlFor="compare-report-b">
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#5a8f8f]">
                Report B
              </span>
              <ReportSelect
                id="compare-report-b"
                name="reportB"
                value={reportB}
                onChange={setReportB}
                reports={filtered}
              />
            </label>
          </div>

          <Button
            type="button"
            disabled={!canCompare}
            onClick={handleCompare}
            aria-label="Compare reports"
            className="mt-5 h-11 w-full rounded-none border-0 bg-[#2b79db] py-2.5 pl-3 pr-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#3d8de8] disabled:opacity-40 sm:h-9 sm:py-2 sm:pl-2 sm:pr-3"
          >
            <Scale className="size-4 sm:size-3.5" />
            Compare reports
          </Button>
        </>
      )}
    </div>
  );
}
