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
  revenueBreakdown: {
    bySegment: [
      { name: "Power Generation", value: 120000000 },
      { name: "Distribution", value: 85000000 },
    ],
  },
  profitabilityTrends: {
    periods: ["2026", "2027"],
    revenue: [950000000, 1020000000],
    ebitda: [320000000, 346000000],
    netProfit: [140000000, 155000000],
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

  it("includes sentiment analysis", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("positive");
    expect(html).toContain("Continued recovery expected");
    expect(html).toContain("Fuel price volatility");
  });

  it("renders revenue breakdown table even when charts are missing", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("Revenue by Segment");
    expect(html).toContain("Power Generation");
    expect(html).toContain("120,000,000");
    expect(html).toContain("Distribution");
  });

  it("includes revenue breakdown when chart present", () => {
    const charts = { ...emptyCharts, revenueBarChart: "file:///tmp/chart.jpg" };
    const html = buildHtml(minimalData, charts);
    expect(html).toContain("Revenue by Segment");
    expect(html).toContain('src="file:///tmp/chart.jpg"');
  });

  it("renders profitability trends table even when chart is missing", () => {
    const html = buildHtml(minimalData, emptyCharts);
    expect(html).toContain("Profitability Trends");
    expect(html).toContain("<th>Period</th>");
    expect(html).toContain("2026");
    expect(html).toContain("950,000,000");
    expect(html).toContain("320,000,000");
    expect(html).toContain("140,000,000");
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
