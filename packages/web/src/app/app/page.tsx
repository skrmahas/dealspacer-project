import { Suspense } from "react";

import HomeClient from "./page-client";

export const dynamic = "force-dynamic";

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", padding: "40px", textAlign: "center", color: "#94a3b8" }}>
          Loading upload workspace...
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
