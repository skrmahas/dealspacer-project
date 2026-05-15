"use client";

import React, { FormEvent, useMemo, useState } from "react";

type LeadStatus = "idle" | "loading" | "success" | "error";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const canSubmit = useMemo(() => status !== "loading", [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!isEmail(normalized)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          source: "landing_hero",
        }),
      });
      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error || "Could not submit your request.");
        return;
      }

      setStatus("success");
      setMessage("You are on the early-access list.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "28px 20px 56px",
        background: "radial-gradient(circle at 18% 0%, #fff2e2 0%, #f7fbff 44%, #eef4fb 100%)",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
        color: "var(--color-text)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 44 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 11, height: 11, borderRadius: 999, background: "var(--color-accent)" }} />
            <strong style={{ fontSize: 19, color: "var(--color-heading)" }}>DealSpacer</strong>
          </div>
          <a
            href="/access?next=%2Fapp"
            style={{
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              borderRadius: 999,
              padding: "9px 14px",
              color: "var(--color-heading)",
              fontWeight: 600,
              background: "rgba(255,255,255,0.72)",
            }}
          >
            Enter App
          </a>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-accent-dark)", fontWeight: 700, textTransform: "uppercase" }}>
              Baltic Earnings Intelligence
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 54px)", lineHeight: 1.06, color: "var(--color-heading)" }}>
              Turn Baltic company reports into fast, shareable investment summaries.
            </h1>
            <p style={{ margin: "6px 0 0", maxWidth: 700, fontSize: 18, lineHeight: 1.45, color: "#4f5f73" }}>
              DealSpacer extracts key financial metrics, generates concise narratives, translates output to EN/ET/LV/LT, and delivers a clean PDF report your team can review in minutes.
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["PDF", "CSV", "HTML", "XHTML"].map((type) => (
                <span
                  key={type}
                  style={{
                    border: "1px solid #c7d3e2",
                    borderRadius: 999,
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#2c4f6f",
                    background: "#f6f9fd",
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 14,
              padding: 18,
              background: "rgba(255,255,255,0.94)",
              boxShadow: "0 20px 40px rgba(36, 71, 98, 0.10)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--color-heading)" }}>Request Early Access</h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#607287", lineHeight: 1.45 }}>
              Join the list and get access as we open the next cohort.
            </p>
            <form noValidate onSubmit={(event) => void onSubmit(event)} style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                aria-label="Email"
                style={{
                  width: "100%",
                  border: "1px solid #cfd8e3",
                  borderRadius: 10,
                  padding: "12px 12px",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-dark))",
                  color: "#fff",
                  opacity: canSubmit ? 1 : 0.7,
                }}
              >
                {status === "loading" ? "Submitting..." : "Get Early Access"}
              </button>
            </form>
            {message && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 13,
                  color: status === "success" ? "#17633f" : "var(--color-error-text)",
                }}
              >
                {message}
              </p>
            )}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#7a8898" }}>
              By submitting, you agree to receive product updates.
            </p>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <article style={{ background: "rgba(255,255,255,0.88)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--color-heading)" }}>Extraction</h3>
            <p style={{ margin: "7px 0 0", fontSize: 14, color: "#5f6f83", lineHeight: 1.45 }}>
              Pulls revenue, EBITDA, profit, assets, and other core metrics into structured output.
            </p>
          </article>
          <article style={{ background: "rgba(255,255,255,0.88)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--color-heading)" }}>Translation</h3>
            <p style={{ margin: "7px 0 0", fontSize: 14, color: "#5f6f83", lineHeight: 1.45 }}>
              Produces localized executive summary output in English, Estonian, Latvian, and Lithuanian.
            </p>
          </article>
          <article style={{ background: "rgba(255,255,255,0.88)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--color-heading)" }}>Delivery</h3>
            <p style={{ margin: "7px 0 0", fontSize: 14, color: "#5f6f83", lineHeight: 1.45 }}>
              Creates shareable PDF reports with KPI tables, sentiment, risk factors, and trend visuals.
            </p>
          </article>
        </section>

        <section style={{ borderTop: "1px solid #d4e0ec", paddingTop: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#687991", lineHeight: 1.5 }}>
            AI-generated summaries may contain errors or omissions. Verify critical figures against original source filings before investment decisions.
          </p>
        </section>
      </div>
    </main>
  );
}
