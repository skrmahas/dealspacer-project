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
        <div className="flex min-h-screen items-center justify-center bg-[#080b10] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[#6b7d92]">
          Loading upload workspace...
        </div>
      }
    >
      <HomeClient initialCompanySlug={initialCompanySlug} />
    </Suspense>
  );
}
