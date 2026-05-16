import { Suspense } from "react";

import CompareClient from "./page-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function CompareLoadingFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#080b10] px-6">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[#6b7d92]">
        Loading comparison...
      </p>
    </div>
  );
}

export default function ComparePage({ searchParams }: { searchParams?: SearchParams }) {
  const reportAParam = searchParams?.reportA;
  const reportBParam = searchParams?.reportB;
  const reportA = Array.isArray(reportAParam) ? reportAParam[0] : reportAParam ?? null;
  const reportB = Array.isArray(reportBParam) ? reportBParam[0] : reportBParam ?? null;

  return (
    <Suspense fallback={<CompareLoadingFallback />}>
      <CompareClient initialReportA={reportA} initialReportB={reportB} />
    </Suspense>
  );
}
