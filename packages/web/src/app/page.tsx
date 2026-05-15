"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  FileDown,
  FileText,
  Languages,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

type LeadStatus = "idle" | "loading" | "success" | "error";

interface LeadFormState {
  email: string;
}

interface AttributionState {
  source: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

const EMPTY_FORM: LeadFormState = {
  email: "",
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LandingPage() {
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [attribution, setAttribution] = useState<AttributionState>({
    source: "landing_b2b",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAttribution({
      source: params.get("source")?.trim() || "landing_b2b",
      utmSource: params.get("utm_source")?.trim() || "",
      utmMedium: params.get("utm_medium")?.trim() || "",
      utmCampaign: params.get("utm_campaign")?.trim() || "",
    });
  }, []);

  const canSubmit = useMemo(() => status !== "loading", [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const email = form.email.trim().toLowerCase();

    if (!isEmail(email)) {
      setStatus("error");
      setMessage("Enter a valid email.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: attribution.source,
          utmSource: attribution.utmSource || null,
          utmMedium: attribution.utmMedium || null,
          utmCampaign: attribution.utmCampaign || null,
          pageReferrer: document.referrer || null,
        }),
      });
      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error || "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage("You're on the list - we'll be in touch.");
      setForm(EMPTY_FORM);
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
        padding: "24px 20px 56px",
        background: "radial-gradient(ellipse at top, rgba(86, 114, 255, 0.14) 0%, rgba(247, 251, 255, 0) 60%), #f7fbff",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
        color: "#21324a",
      }}
    >
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            paddingBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 11, height: 11, borderRadius: 999, background: "#6b89ff" }} />
            <strong style={{ fontSize: 19, color: "#0f2e52", letterSpacing: 0 }}>DealSpacer</strong>
          </div>
          <a
            href="#access"
            style={{
              textDecoration: "none",
              border: "1px solid #cdd9eb",
              borderRadius: 999,
              padding: "9px 14px",
              color: "#365d9c",
              fontWeight: 600,
              background: "#ffffff",
            }}
          >
            Request access
          </a>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 40,
            alignItems: "center",
            paddingTop: 22,
            paddingBottom: 88,
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <span
              style={{
                display: "inline-flex",
                width: "fit-content",
                border: "1px solid #d7e2f2",
                borderRadius: 999,
                padding: "6px 11px",
                fontSize: 12,
                fontWeight: 700,
                color: "#3b5f93",
                background: "#ffffff",
              }}
            >
              Nasdaq Tallinn · Riga · Vilnius
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, color: "#0f2e52" }}>
              Baltic earnings reports,{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #8ba9ff 0%, #66d1ff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                decoded in minutes
              </span>
              .
            </h1>
            <p style={{ margin: "6px 0 0", maxWidth: 640, fontSize: 20, lineHeight: 1.5, color: "#4d627f" }}>
              Drop in a 150-page filing in Estonian, Latvian or Lithuanian. Get a clean, chart-rich, investor-ready summary in your language - automatically.
            </p>
            <p style={{ margin: 0, maxWidth: 640, fontSize: 15, lineHeight: 1.45, color: "#365d9c", fontWeight: 700 }}>
              Built for analysts, IR teams and Baltic-focused funds.
            </p>
            <div style={{ marginTop: 10, display: "flex", alignItems: "stretch", gap: 14, flexWrap: "wrap" }}>
              {[
                { value: "~40", label: "listed companies" },
                { value: "4", label: "languages" },
                { value: "< 5 min", label: "per report" },
              ].map((item) => (
                <div key={item.label} style={{ minWidth: 110 }}>
                  <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 700, color: "#173b68" }}>{item.value}</div>
                  <div style={{ marginTop: 3, fontSize: 13, color: "#6882a5" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="access"
            style={{
              alignSelf: "center",
              border: "1px solid #d7e2f2",
              borderRadius: 24,
              padding: 24,
              background: "#ffffff",
              boxShadow: "0 20px 42px rgba(46, 77, 114, 0.14)",
            }}
          >
            <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 12,
                background: "#edf2ff",
                color: "#5877c8",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
                <h2 style={{ margin: 0, fontSize: 19, color: "#0f2e52" }}>Get early access</h2>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#607287", lineHeight: 1.45 }}>
                  Join the private preview. No spam, ever.
                </p>
              </div>
            </div>

            {status === "success" ? (
              <div
                style={{
                  border: "1px solid #bde8d3",
                  borderRadius: 18,
                  padding: 18,
                  background: "#effaf4",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    margin: "0 auto",
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    display: "grid",
                    placeItems: "center",
                    background: "#dcf5e8",
                    color: "#2a8f5d",
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ margin: "12px 0 0", fontSize: 22, color: "#17633f" }}>You're on the list</h3>
                <p style={{ margin: "8px auto 0", maxWidth: 280, fontSize: 14, color: "#2f7b56", lineHeight: 1.45 }}>
                  We'll reach out as soon as early access opens. Watch your inbox.
                </p>
              </div>
            ) : (
            <form noValidate onSubmit={(event) => void onSubmit(event)} style={{ marginTop: 0, display: "grid", gap: 10 }}>
              <div>
                <label htmlFor="lead-email" style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#607287", fontWeight: 600 }}>
                  Email *
                </label>
              <input
                id="lead-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="jane@acmecapital.com"
                aria-label="Email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #d0d9e5",
                  borderRadius: 12,
                  padding: "11px 12px",
                  fontSize: 15,
                  outline: "none",
                  color: "#24364f",
                  background: "#fdfefe",
                }}
              />
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  background: "linear-gradient(90deg, #5d7dff, #63d2ff)",
                  color: "#fff",
                  opacity: canSubmit ? 1 : 0.7,
                }}
              >
                {status === "loading" ? (
                  "Submitting..."
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    Request early access
                    <ArrowRight size={16} />
                  </span>
                )}
              </button>
              <a
                href="/sample-report.pdf"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  border: "1px solid #cdd9eb",
                  borderRadius: 12,
                  padding: "11px 14px",
                  color: "#365d9c",
                  textDecoration: "none",
                  fontWeight: 700,
                  background: "#ffffff",
                }}
              >
                View a sample report
                <FileText size={16} />
              </a>
            </form>
            )}

            {message && status === "error" && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 13,
                  color: "#ff5f6d",
                }}
              >
                {message}
              </p>
            )}
            <p style={{ margin: "14px 0 0", fontSize: 12, color: "#7a8898", textAlign: "center", display: "flex", gap: 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <LockKeyhole size={13} />
              Enterprise-grade encryption. Uploaded filings are not used to train public models.
            </p>
          </div>
        </section>

        <section
          aria-label="Output preview"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            alignItems: "stretch",
            padding: "0 0 54px",
          }}
        >
          <article
            style={{
              border: "1px solid #d7e2f2",
              borderRadius: 18,
              background: "#ffffff",
              boxShadow: "0 18px 36px rgba(46, 77, 114, 0.12)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f2e52" }}>Native-language filing</strong>
              <span style={{ fontSize: 12, color: "#6882a5" }}>Before</span>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {[
                "2025 m. pajamos sieke 507,3 mln. EUR, EBITDA augo 12,8 proc.",
                "Vadovybe pabrezia 5G ir sviesolaidzio tinklo investicijas.",
                "Rizikos: konkurencinis spaudimas, duomenu sauga, tiekimo grandine.",
              ].map((line) => (
                <div key={line} style={{ borderRadius: 10, background: "#f3f7fc", padding: "10px 12px", color: "#607287", fontSize: 13, lineHeight: 1.45 }}>
                  {line}
                </div>
              ))}
              <div style={{ marginTop: 4, display: "grid", gap: 7 }}>
                {[92, 78, 86, 64].map((width) => (
                  <div key={width} style={{ height: 8, width: `${width}%`, borderRadius: 999, background: "#d8e3f0" }} />
                ))}
              </div>
            </div>
          </article>

          <article
            style={{
              border: "1px solid #c9dcf7",
              borderRadius: 18,
              background: "linear-gradient(180deg, #ffffff 0%, #f6faff 100%)",
              boxShadow: "0 18px 36px rgba(46, 77, 114, 0.16)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f2e52" }}>Parsed investor summary</strong>
              <span style={{ fontSize: 12, color: "#365d9c", fontWeight: 800 }}>After</span>
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["Revenue", "EUR 507.3m"],
                ["EBITDA", "+12.8%"],
                ["Net profit", "EUR 90.4m"],
              ].map(([label, value]) => (
                <div key={label} style={{ border: "1px solid #d7e2f2", borderRadius: 12, padding: 10, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, color: "#6882a5" }}>{label}</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: "#173b68" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#365d9c" }}>Outlook</span>
                <div style={{ height: 10, borderRadius: 999, background: "linear-gradient(90deg, #5d7dff 0%, #63d2ff 74%, #e2eaf5 74%)" }} />
              </div>
              <p style={{ margin: 0, color: "#4d627f", fontSize: 13, lineHeight: 1.45 }}>
                Growth supported by 5G and fiber upgrades; watch competition, privacy controls, and supply-chain governance.
              </p>
            </div>
          </article>
        </section>

        <section style={{ display: "grid", gap: 14, paddingBottom: 46 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: "#0f2e52", textAlign: "center" }}>How it works</h2>
            <p style={{ margin: "8px auto 0", maxWidth: 620, fontSize: 15, color: "#5f6f83", textAlign: "center", lineHeight: 1.45 }}>
              From raw filing to board-ready summary in three steps.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { icon: Upload, title: "1. Upload Filing", body: "Add a PDF, CSV, HTML, or XHTML company filing." },
              { icon: BrainCircuit, title: "2. AI Decodes & Translates", body: "Extract metrics, management tone, risk factors, and language variants." },
              { icon: FileDown, title: "3. Export PDF / Excel-ready Summary", body: "Share the final investor-ready report with your team." },
            ].map((step) => (
              <article key={step.title} style={{ border: "1px solid #d7e2f2", borderRadius: 14, padding: 16, background: "#ffffff" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", color: "#365d9c", background: "#edf2ff" }}>
                  <step.icon size={20} />
                </div>
                <h3 style={{ margin: "12px 0 0", color: "#0f2e52", fontSize: 17 }}>{step.title}</h3>
                <p style={{ margin: "6px 0 0", color: "#5f6f83", fontSize: 14, lineHeight: 1.45 }}>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 14, paddingTop: 46, borderTop: "1px solid #d7e2f2" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 32, color: "#0f2e52", textAlign: "center" }}>
              Built for analysts, IR teams and Baltic-focused funds
            </h2>
            <p style={{ margin: "10px auto 0", maxWidth: 720, fontSize: 15, color: "#5f6f83", lineHeight: 1.45, textAlign: "center" }}>
              One consistent template across every company in your coverage universe.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            {[
              {
                n: "01",
                icon: FileText,
                title: "Any format, any length",
                points: ["PDF, CSV, HTML, XHTML", "Parse, OCR and structure automatically", "Built for long filings"],
              },
              {
                n: "02",
                icon: BarChart3,
                title: "Metrics that matter",
                points: ["Revenue, EBITDA, net profit", "Segments and YoY trends", "Extracted and deduplicated"],
              },
              {
                n: "03",
                icon: Languages,
                title: "EN, ET, LV, LT",
                points: ["English and Baltic languages", "Consistent terminology", "One source, multi-language output"],
              },
              {
                n: "04",
                icon: ShieldCheck,
                title: "Investor-ready output",
                points: ["Executive summary", "Sentiment and outlook", "Polished shareable report"],
              },
            ].map((feature) => (
              <article
                key={feature.title}
                style={{
                  background: "#ffffff",
                  border: "1px solid #d7e2f2",
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: "0 10px 24px rgba(46, 77, 114, 0.12)",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 36, height: 24, borderRadius: 999, background: "#e7f1fc", color: "#25597d", fontSize: 12, fontWeight: 800 }}>
                  {feature.n}
                </div>
                <div style={{ marginTop: 12, width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", color: "#365d9c", background: "#edf2ff" }}>
                  <feature.icon size={20} />
                </div>
                <h3 style={{ margin: "10px 0 0", fontSize: 18, color: "#0f2e52" }}>{feature.title}</h3>
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#5f6f83", fontSize: 14, lineHeight: 1.45 }}>
                  {feature.points.map((point) => (
                    <li key={point} style={{ marginBottom: 6 }}>
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 14, paddingTop: 46 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: "#0f2e52", textAlign: "center" }}>Frequently asked questions</h2>
            <p style={{ margin: "8px auto 0", maxWidth: 760, textAlign: "center", color: "#5f6f83", fontSize: 15, lineHeight: 1.45 }}>
              Answers for analysts, IR teams, funds, and accountants evaluating DealSpacer for Baltic reporting workflows.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, maxWidth: 860, width: "100%", margin: "0 auto" }}>
            {[
              {
                q: "Who is DealSpacer built for?",
                a: (
                  <>DealSpacer is built for analysts, IR teams, Baltic-focused funds, and accountants who need to review Baltic filings faster with a consistent report format.</>
                ),
              },
              {
                q: "What file types can I upload?",
                a: <>DealSpacer supports PDF, CSV, HTML, and XHTML filings.</>,
              },
              {
                q: "Which languages are supported?",
                a: <>DealSpacer supports report outputs in English, Estonian, Latvian, and Lithuanian.</>,
              },
              {
                q: "What does DealSpacer generate?",
                a: (
                  <>DealSpacer generates a browser-viewable and downloadable PDF report with key metrics, management commentary, sentiment, outlook, risks, and chart-rich summaries where source data supports it.</>
                ),
              },
              {
                q: "How long does a report take?",
                a: <>Most reports complete in minutes. Very large filings, scanned PDFs, OCR-heavy documents, or rate-limited extraction can take longer.</>,
              },
              {
                q: "How accurate is the output?",
                a: (
                  <>DealSpacer is an AI-assisted workflow tool designed to speed up review. Important figures should still be verified against the original filing before investment, accounting, or disclosure decisions.</>
                ),
              },
              {
                q: "Is my data used to train public models?",
                a: (
                  <>No. Uploaded filings are processed to generate your requested report and are not used to train public models. Operational access is limited to what is needed to provide and support the service.</>
                ),
              },
              {
                q: "Does DealSpacer only work for Baltic companies?",
                a: (
                  <>DealSpacer is tuned for Nasdaq Tallinn, Riga, and Vilnius filings, but the parser supports PDF, CSV, HTML, and XHTML financial documents more broadly.</>
                ),
              },
              {
                q: "How do I get access?",
                a: <>DealSpacer is currently in private preview. Submit your email on this page and we will follow up.</>,
              },
              {
                q: "Can I see an example output?",
                a: (
                  <>
                    Yes. Review a sample generated report here:{" "}
                    <a href="/sample-report.pdf" target="_blank" rel="noreferrer" style={{ color: "#365d9c", fontWeight: 700 }}>
                      View the sample report
                    </a>
                    .
                  </>
                ),
              },
            ].map((item) => (
              <details
                key={item.q}
                style={{
                  border: "1px solid #d7e2f2",
                  borderRadius: 14,
                  background: "#ffffff",
                  boxShadow: "0 10px 24px rgba(46, 77, 114, 0.08)",
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    margin: 0,
                    listStyle: "none",
                    cursor: "pointer",
                    color: "#0f2e52",
                    fontSize: 17,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    padding: 16,
                    borderBottom: "1px solid #e6edf7",
                  }}
                >
                  {item.q}
                </summary>
                <div style={{ padding: 16 }}>
                  <p style={{ margin: 0, color: "#5f6f83", fontSize: 14, lineHeight: 1.5 }}>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section style={{ borderTop: "1px solid #d7e2f2", paddingTop: 18, marginTop: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#687991" }}>© {new Date().getFullYear()} DealSpacer</span>
            <nav aria-label="Footer" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[
                { href: "mailto:hello@dealspacer.com", label: "Contact Us" },
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms of Service" },
              ].map((link) => (
                <a key={link.href} href={link.href} style={{ color: "#365d9c", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  {link.label}
                </a>
              ))}
            </nav>
            <span style={{ fontSize: 13, color: "#687991" }}>Currently in private preview.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
