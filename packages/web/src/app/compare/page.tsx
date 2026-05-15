import { Suspense } from "react";

import CompareClient from "./page-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function ComparePage({ searchParams }: { searchParams?: SearchParams }) {
  const reportAParam = searchParams?.reportA;
  const reportBParam = searchParams?.reportB;
  const reportA = Array.isArray(reportAParam) ? reportAParam[0] : reportAParam ?? null;
  const reportB = Array.isArray(reportBParam) ? reportBParam[0] : reportBParam ?? null;

  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading comparison...</div>}
    >
      <CompareClient initialReportA={reportA} initialReportB={reportB} />
    </Suspense>
  );
}
