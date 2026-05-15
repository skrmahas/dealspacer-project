"use client";

import { useState } from "react";
import type { ExtractedData, ExtractedMetric, ExtractedNarrative, ExtractedSentiment } from "@bei/shared";

type ExtractedPayload = Partial<ExtractedData> & {
  metadata?: Partial<ExtractedData["metadata"]>;
  metrics?: ExtractedMetric[];
  narratives?: ExtractedNarrative[];
  sentiment?: ExtractedSentiment;
};

function narrativeTitle(section: string): string {
  switch (section) {
    case "executive_summary":
      return "Executive Summary";
    case "management_commentary":
      return "Management Commentary";
    case "business_overview":
      return "Business Overview";
    case "segment_performance":
      return "Segment Performance";
    case "outlook":
      return "Outlook";
    default:
      return section.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function sectionNarrative(narratives: ExtractedNarrative[], section: string): string | null {
  const item = narratives.find((narrative) => narrative.section === section);
  return item?.text?.trim() ? item.text.trim() : null;
}

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <h4 style={{ margin: 0, fontSize: 15, color: 'var(--color-heading)' }}>{title}</h4>
        <span style={{ color: '#8899aa', fontSize: 14, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
      </div>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
  );
}

export function ReportSummary({ extractedJson }: { extractedJson: string }) {
  let data: ExtractedPayload;
  try {
    data = JSON.parse(extractedJson) as ExtractedPayload;
  } catch {
    return (
      <div style={{ padding: 16, borderRadius: 10, background: "var(--color-error-bg)", border: "1px solid var(--color-error-border)", color: "var(--color-error-text)" }}>
        Could not parse extracted report data.
      </div>
    );
  }

  const metrics = data.metrics ?? [];
  const narratives = data.narratives ?? [];
  const sentiment = data.sentiment ?? { managementTone: "", outlook: "", riskFactors: [] };
  const sections = ["executive_summary", "management_commentary", "business_overview", "segment_performance", "outlook"];

  return (
    <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
      <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, color: "var(--color-heading)" }}>
          {data.metadata?.companyName || "Company Not Identified"}
        </h3>
        <p style={{ margin: "6px 0 0", color: "var(--color-text-muted)", fontSize: 14 }}>
          {data.metadata?.reportPeriod || "Report period unavailable"}
        </p>
      </section>

      <CollapsibleSection title="Key Metrics">
        {metrics.length === 0 && <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>No metrics were extracted.</p>}
        {metrics.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {metrics.map((metric) => (
              <div key={`${metric.label}-${metric.unit ?? "u"}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span style={{ color: "var(--color-text)" }}>{metric.label}</span>
                <span style={{ fontFamily: "Menlo, Monaco, Consolas, monospace", color: "var(--color-accent-dark)" }}>
                  {metric.value == null ? "—" : `${metric.value.toLocaleString()} ${metric.unit ?? ""}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Narrative Sections">
        <div style={{ display: "grid", gap: 10 }}>
          {sections.map((section) => {
            const text = sectionNarrative(narratives, section);
            return (
              <div key={section} style={{ borderTop: "1px solid #edf1f6", paddingTop: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-heading)", fontWeight: 600 }}>{narrativeTitle(section)}</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: text ? "var(--color-text)" : "var(--color-text-muted)" }}>
                  {text || "No content extracted for this section."}
                </p>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Sentiment">
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--color-text)" }}>
          <strong>Management Tone:</strong> {sentiment.managementTone || "Not available"}
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: sentiment.outlook ? "var(--color-text)" : "var(--color-text-muted)" }}>
          <strong>Outlook:</strong> {sentiment.outlook || "No outlook extracted."}
        </p>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--color-text)" }}>
          <strong>Risk Factors:</strong>
        </p>
        {sentiment.riskFactors.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>No risk factors extracted.</p>}
        {sentiment.riskFactors.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-text)" }}>
            {sentiment.riskFactors.map((risk) => (
              <li key={risk} style={{ marginBottom: 4, fontSize: 14 }}>{risk}</li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </div>
  );
}
