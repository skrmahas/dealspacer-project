import { Suspense } from "react";

import HomeClient from "./page-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function UploadPage({ searchParams }: { searchParams?: SearchParams }) {
  const companySlug = searchParams?.company;
  const initialCompanySlug = Array.isArray(companySlug) ? companySlug[0] : companySlug ?? null;

  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", padding: "40px", textAlign: "center", color: "#94a3b8" }}>
          Loading upload workspace...
        </div>
      }
    >
      <HomeClient initialCompanySlug={initialCompanySlug} />
    </Suspense>
  );
}
