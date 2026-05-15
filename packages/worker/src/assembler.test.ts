import { describe, it, expect } from "vitest";
import { buildHtml } from "./assembler";
import type { ExtractedData } from "@bei/shared";

const emptyCharts = {
  sparklines: new Map<string, string>(),
  yoyChanges: new Map<string, number | null>(),
  revenueBarChart: "",
  revenueDonutChart: "",
  profitabilityChart: "",
};

const minimalData: ExtractedData = {
  metadata: {
    companyName: "AS Tallink Grupp",
    reportPeriod: "Q1 2024",
    sourceLanguage: "en",
  },
  metrics: [
    { label: "Revenue", value: 210400000, unit: "EUR" },
    { label: "EBITDA", value: 48700000, unit: "EUR" },
  ],
  narratives: [
    { section: "executive_summary", text: "Strong quarter with revenue growth." },
  ],
  sentiment: {
    managementTone: "positive",
    outlook: "Continued recovery expected.",
    riskFactors: ["Fuel price volatility"],
  },
};

describe("buildHtml", () => {
  it("includes company name and report period", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("AS Tallink Grupp");
    expect(html).toContain("Q1 2024");
  });

  it("includes key metrics in a table", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("Revenue");
    expect(html).toContain("210,400,000");
    expect(html).toContain("EUR");
    expect(html).toContain("EBITDA");
  });

  it("includes executive summary narrative", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("Strong quarter with revenue growth");
  });

  it("compacts long executive summary text", () => {
    const longNarrative = [
      "Revenue increased materially due to higher passenger volumes and better cargo operations.",
      "EBITDA improved because operating costs were managed more tightly across core routes.",
      "Net profit returned to positive territory after the prior period was affected by weak demand.",
      "Management also described multiple operational details, route-level updates, service changes, and internal initiatives that are useful background but should not dominate the generated summary.",
      "The company provided further commentary on booking flows, vessel schedules, staffing, and maintenance windows that would make the output feel like a copy of the source report.",
    ].join(" ");
    const html = buildHtml({
      ...minimalData,
      narratives: [{ section: "executive_summary", text: longNarrative }],
    }, emptyCharts);

    expect(html).toContain("Revenue increased materially");
    expect(html).toContain("Net profit returned");
    expect(html).not.toContain("The company provided further commentary");
  });

  it("includes sentiment analysis", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("positive");
    expect(html).toContain("Continued recovery expected");
    expect(html).toContain("Fuel price volatility");
  });

  it("omits revenue breakdown section when no charts", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).not.toContain("Revenue Breakdown");
  });

  it("includes revenue breakdown when chart present", () => {
    const charts = { ...emptyCharts, revenueBarChart: "file:///tmp/chart.jpg" };
    const html = buildHtml(minimalData, charts);
    expect(html).toContain("Revenue Breakdown");
    expect(html).toContain('src="file:///tmp/chart.jpg"');
  });

  it("uses localized labels for non-English output", () => {
    const data: ExtractedData = {
      ...minimalData,
      metadata: { ...minimalData.metadata, outputLanguage: "et" },
    };
    const html = buildHtml(data, emptyCharts);
    expect(html).toContain("Kokkuvõte"); // Estonian for "Executive Summary"
  });

  it("includes AI disclaimer", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("AI-Generated Disclaimer");
    expect(html).toContain("GPT-4o");
  });

  it("handles empty data gracefully", () => {
    const emptyData: ExtractedData = {
      metadata: { companyName: "", reportPeriod: "", sourceLanguage: "en" },
      metrics: [],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };
    const html = buildHtml(emptyData, emptyCharts);
    // Should still produce valid HTML
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("Company Report"); // fallback name
  });
});
