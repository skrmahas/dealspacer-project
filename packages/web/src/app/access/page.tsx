"use client";

import React from "react";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ACCESS_REQUEST_TIMEOUT_MS } from "@/lib/access-timeout";

function AccessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const nextValue = params.get("next");
    if (!nextValue || !nextValue.startsWith("/")) return "/";
    return nextValue;
  }, [params]);

  async function submit() {
    if (!code.trim()) {
      setError("Enter an access code.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ACCESS_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, next: nextPath }),
        signal: controller.signal,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Access denied.");
        return;
      }

      router.push(payload.next || "/");
      router.refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Could not verify access code.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  return (
    <section style={{ width: "100%", maxWidth: 440, background: "#ffffff", border: "1px solid #d8e2ec", borderRadius: 16, padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: "#0f2e52" }}>Baltic Earnings Intelligence</h1>
        <p style={{ margin: "8px 0 0", color: "#556579", fontSize: 14 }}>
          Automated financial analysis for Baltic company reports
        </p>
        <div style={{ margin: "14px auto 0", width: 40, height: 3, borderRadius: 2, background: "#0b7ea4" }} />
      </div>
      <p style={{ margin: "0 0 16px", color: "#556579", fontSize: 15 }}>
        Enter the report access code to continue.
      </p>
      <input
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
        placeholder="Access code"
        style={{ width: "100%", border: "1px solid #cfd8e3", borderRadius: 10, padding: "12px 14px", fontSize: 15, boxSizing: "border-box" }}
      />
      {error && <p style={{ margin: "10px 0 0", color: "#8f2f23", fontSize: 14 }}>{error}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        style={{
          marginTop: 14,
          width: "100%",
          border: "none",
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 15,
          fontWeight: 700,
          background: submitting ? "#9cb2c9" : "linear-gradient(90deg, #0b7ea4, #145f82)",
          color: "#ffffff",
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Checking..." : "Unlock Access"}
      </button>
    </section>
  );
}

function AccessFallback() {
  return (
    <section style={{ width: "100%", maxWidth: 440, background: "#ffffff", border: "1px solid #d8e2ec", borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0, color: "#556579" }}>Loading access form...</p>
    </section>
  );
}

export default function AccessPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "36px 20px 48px",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at 14% 0%, #e8f2ff 0%, #f7f9fc 46%, #edf2f8 100%)",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
      }}
    >
      <Suspense fallback={<AccessFallback />}>
        <AccessForm />
      </Suspense>
    </main>
  );
}
