"use client";

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

export function ReportSummary({ extractedJson }: { extractedJson: string }) {
  let data: ExtractedPayload;
  try {
    data = JSON.parse(extractedJson) as ExtractedPayload;
  } catch {
    return (
      <div style={{ padding: 16, borderRadius: 10, background: "#fff3f2", border: "1px solid #ffd7d2", color: "#8f2f23" }}>
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
      <section style={{ background: "#ffffff", border: "1px solid #d7dfe7", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, color: "#0f2e52" }}>
          {data.metadata?.companyName || "Company Not Identified"}
        </h3>
        <p style={{ margin: "6px 0 0", color: "#596879", fontSize: 14 }}>
          {data.metadata?.reportPeriod || "Report period unavailable"}
        </p>
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #d7dfe7", borderRadius: 12, padding: 16 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f2e52" }}>Key Metrics</h4>
        {metrics.length === 0 && <p style={{ margin: 0, color: "#697586", fontSize: 14 }}>No metrics were extracted.</p>}
        {metrics.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {metrics.map((metric) => (
              <div key={`${metric.label}-${metric.unit ?? "u"}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span style={{ color: "#1f2a37" }}>{metric.label}</span>
                <span style={{ fontFamily: "Menlo, Monaco, Consolas, monospace", color: "#0a4c63" }}>
                  {metric.value == null ? "—" : `${metric.value.toLocaleString()} ${metric.unit ?? ""}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #d7dfe7", borderRadius: 12, padding: 16 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f2e52" }}>Narrative Sections</h4>
        <div style={{ display: "grid", gap: 10 }}>
          {sections.map((section) => {
            const text = sectionNarrative(narratives, section);
            return (
              <div key={section} style={{ borderTop: "1px solid #edf1f6", paddingTop: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#37506d", fontWeight: 600 }}>{narrativeTitle(section)}</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: text ? "#1f2a37" : "#697586" }}>
                  {text || "No content extracted for this section."}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #d7dfe7", borderRadius: 12, padding: 16 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f2e52" }}>Sentiment</h4>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1f2a37" }}>
          <strong>Management Tone:</strong> {sentiment.managementTone || "Not available"}
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: sentiment.outlook ? "#1f2a37" : "#697586" }}>
          <strong>Outlook:</strong> {sentiment.outlook || "No outlook extracted."}
        </p>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#1f2a37" }}>
          <strong>Risk Factors:</strong>
        </p>
        {sentiment.riskFactors.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "#697586" }}>No risk factors extracted.</p>}
        {sentiment.riskFactors.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 20, color: "#1f2a37" }}>
            {sentiment.riskFactors.map((risk) => (
              <li key={risk} style={{ marginBottom: 4, fontSize: 14 }}>{risk}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
