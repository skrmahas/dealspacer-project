import { Suspense } from "react";

import CompareClient from "./page-client";

export const dynamic = "force-dynamic";

export default function ComparePage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading comparison...</div>}
    >
      <CompareClient />
    </Suspense>
  );
}
