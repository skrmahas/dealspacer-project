"use client";

import React, { useState } from "react";

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)", padding: "14px 0" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--color-text)",
          textAlign: "left",
          padding: 0,
        }}
      >
        {question}
        <span style={{ fontSize: 18, color: "var(--color-text-muted)", transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>
          +
        </span>
      </button>
      {open && (
        <p style={{ margin: "10px 0 0", color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          {answer}
        </p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);

    if (!email.includes("@") || !email.includes(".")) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
        background: "var(--color-gradient-end)",
        color: "var(--color-text)",
      }}
    >
      {/* Hero */}
      <section
        style={{
          padding: "60px 20px 40px",
          textAlign: "center",
          background: "linear-gradient(180deg, var(--color-gradient-start) 0%, var(--color-gradient-mid) 60%, var(--color-gradient-end) 100%)",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: 36, color: "var(--color-heading)", margin: "0 0 8px", fontWeight: 800 }}>
            DealSpacer
          </h1>
          <p style={{ fontSize: 16, color: "var(--color-accent)", margin: "0 0 16px", fontWeight: 600 }}>
            Request Early Access
          </p>
          <p style={{ fontSize: 18, color: "var(--color-text-muted)", margin: "0 0 28px", lineHeight: 1.5 }}>
            AI-powered financial analysis for Baltic company reports. Upload any earnings report and get a professional PDF summary with key metrics, charts, and sentiment analysis — in English, Estonian, Latvian, or Lithuanian.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <input
                type="email"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 15,
                  width: 280,
                  maxWidth: "100%",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: submitting ? "#a7b6c8" : "linear-gradient(90deg, var(--color-accent), var(--color-accent-dark))",
                  color: "#fff",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Sending..." : "Get Early Access"}
              </button>
              {emailError && <p style={{ width: "100%", margin: "8px 0 0", color: "var(--color-error-text)", fontSize: 13 }}>{emailError}</p>}
            </form>
          ) : (
            <div style={{ background: "#e8f5e9", borderRadius: 10, padding: 16, color: "#2e7d32", fontWeight: 600 }}>
              Thanks! You are on the early-access list.
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "48px 20px", maxWidth: 880, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, color: "var(--color-heading)", marginBottom: 32 }}>
          How It Works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {[
            { step: "1", title: "Upload", desc: "Drop any PDF, CSV, or HTML earnings report — up to 100MB." },
            { step: "2", title: "Analyze", desc: "GPT-4o extracts revenue, EBITDA, net profit, segment breakdowns, and management sentiment." },
            { step: "3", title: "Download", desc: "Get a polished PDF report with charts, translated to your preferred Baltic language." },
          ].map((s) => (
            <div
              key={s.step}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: "var(--color-accent)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", fontWeight: 800, fontSize: 18,
              }}>
                {s.step}
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--color-heading)" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof / Preview */}
      <section style={{ padding: "48px 20px", maxWidth: 880, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, color: "var(--color-heading)", marginBottom: 12 }}>
          What You Get
        </h2>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 24 }}>
          A professional, investor-ready PDF report in under 5 minutes.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            "Key metrics dashboard with sparklines",
            "Revenue breakdown charts by segment",
            "Profitability trends over multiple periods",
            "Management tone and sentiment analysis",
            "Risk factor identification",
            "Localized to English, Estonian, Latvian, or Lithuanian",
          ].map((f) => (
            <div
              key={f}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 13,
                color: "var(--color-text)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>✓</span>
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "48px 20px", maxWidth: 680, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, color: "var(--color-heading)", marginBottom: 24 }}>
          Frequently Asked Questions
        </h2>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "0 20px" }}>
          <FaqItem
            question="What types of documents can I upload?"
            answer="PDF, CSV, and HTML earnings reports, annual reports, investor presentations, and strategic plans from Baltic-listed companies. The system handles both digital PDFs (with selectable text) and scanned/image-based PDFs (via OCR)."
          />
          <FaqItem
            question="Which languages are supported?"
            answer="The source document can be in English, Estonian, Latvian, or Lithuanian. The output PDF report can be generated in any of these four languages."
          />
          <FaqItem
            question="How long does processing take?"
            answer="A typical 50-page annual report takes 2-4 minutes from upload to completed PDF. Large documents (200+ pages) may take 4-8 minutes depending on complexity."
          />
          <FaqItem
            question="Is my data secure?"
            answer="Uploaded files are stored encrypted at rest. We use S3-compatible object storage with access controls. Reports are accessible only via unique share links. We do not use your documents to train AI models."
          />
          <FaqItem
            question="How accurate is the AI extraction?"
            answer="GPT-4o achieves high accuracy on structured financial data. Every report includes an AI disclaimer. We recommend verifying key figures against the source document for critical decisions."
          />
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px 20px",
          textAlign: "center",
          borderTop: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 8 }}>
          <a href="/app" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Open App</a>
          <a href="/privacy" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Privacy</a>
          <a href="/terms" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Terms</a>
        </div>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} DealSpacer. AI-powered financial analysis for Baltic markets.</p>
      </footer>
    </main>
  );
}
