"use client";

import type { ExtractedMetric } from "@bei/shared";

type BriefPayload = {
  metadata?: { companyName?: string; reportPeriod?: string };
  metrics?: ExtractedMetric[];
  sentiment?: { managementTone?: string; outlook?: string; riskFactors?: string[] };
};

const KEY_METRIC_LABELS = [
  "revenue", "ebitda", "net profit", "net income",
  "operating profit", "total assets", "equity", "eps",
];

function toneBadgeStyle(tone: string): Record<string, string> {
  const lower = tone.toLowerCase();
  if (lower.includes("very positive")) return { background: "#c8e6c9", color: "#1b5e20" };
  if (lower.includes("positive")) return { background: "#e8f5e9", color: "#2e7d32" };
  if (lower.includes("neutral")) return { background: "#e3f2fd", color: "#1565c0" };
  if (lower.includes("cautious")) return { background: "#fff3e0", color: "#e65100" };
  if (lower.includes("negative")) return { background: "#ffebee", color: "#c62828" };
  return { background: "#f5f5f5", color: "#666" };
}

export function BriefSummary({ extractedJson }: { extractedJson: string }) {
  let data: BriefPayload;
  try {
    data = JSON.parse(extractedJson) as BriefPayload;
  } catch {
    return null;
  }

  const metrics = data.metrics ?? [];
  const sentiment = data.sentiment ?? {};
  const keyMetrics = metrics
    .filter((m) => KEY_METRIC_LABELS.some((k) => m.label.toLowerCase().includes(k)))
    .slice(0, 6);

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {keyMetrics.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
        }}>
          {keyMetrics.map((m) => (
            <div
              key={m.label}
              style={{
                background: "var(--color-bg-tint)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{m.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "var(--color-text)", fontFamily: "Menlo, Monaco, monospace" }}>
                {m.value != null ? `${m.value.toLocaleString()} ${m.unit ?? ""}` : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {sentiment.managementTone && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            ...toneBadgeStyle(sentiment.managementTone),
          }}>
            {sentiment.managementTone}
          </span>
          {sentiment.outlook && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {sentiment.outlook.slice(0, 120)}{sentiment.outlook.length > 120 ? "…" : ""}
            </span>
          )}
        </div>
      )}

      {sentiment.riskFactors && sentiment.riskFactors.length > 0 && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>
          Risks: {sentiment.riskFactors.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );
}
