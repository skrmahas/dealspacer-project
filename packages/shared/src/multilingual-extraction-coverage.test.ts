import { describe, expect, it } from "vitest";
import type { ExtractedData, ExtractedMetric, OutputLanguage } from "./contracts";
import { canonicalizeExtractedData } from "./canonical-metrics.js";
import { normalizeMetricValueToEur } from "./metric-units.js";

type LanguageFixture = {
  sourceLanguage: OutputLanguage;
  companyName: string;
  reportPeriod: string;
  metrics: ExtractedMetric[];
};

const evidence = (snippet: string, confidence = 0.9) => ({ snippet, confidence });

const fixtures: LanguageFixture[] = [
  {
    sourceLanguage: "en",
    companyName: "AS Example Baltic",
    reportPeriod: "FY 2025",
    metrics: [
      { label: "Revenue", value: 125_000_000, unit: "EUR", evidence: evidence("Revenue for FY 2025 was EUR 125,000,000") },
      { label: "EBITDA", value: 18.4, unit: "EUR m", evidence: evidence("EBITDA was EUR 18.4 million") },
      { label: "Net profit", value: 6_200, unit: "thousand EUR", evidence: evidence("Net profit was 6,200 thousand EUR") },
      { label: "Free cash flow", value: 4.1, unit: "EUR m", evidence: evidence("Free cash flow was EUR 4.1 million") },
      { label: "Total assets", value: 210_000_000, unit: "EUR", evidence: evidence("Total assets amounted to EUR 210,000,000") },
      { label: "Equity", value: 88_000, unit: "thousand EUR", evidence: evidence("Equity was 88,000 thousand EUR") },
      { label: "Liabilities", value: 122.0, unit: "EUR m", evidence: evidence("Liabilities were EUR 122.0 million") },
    ],
  },
  {
    sourceLanguage: "et",
    companyName: "AS Naidis Baltic",
    reportPeriod: "2025 majandusaasta",
    metrics: [
      { label: "Müügitulu", value: 125_000_000, unit: "EUR", evidence: evidence("Müügitulu oli 125 000 000 eurot") },
      { label: "EBITDA", value: 18.4, unit: "mln EUR", evidence: evidence("EBITDA oli 18,4 mln EUR") },
      { label: "Puhaskasum", value: 6_200, unit: "tuhat EUR", evidence: evidence("Puhaskasum oli 6 200 tuhat EUR") },
      { label: "Äritegevuse rahavoog", value: 4.1, unit: "mln EUR", evidence: evidence("Äritegevuse rahavoog oli 4,1 mln EUR") },
      { label: "Varad kokku", value: 210_000_000, unit: "EUR", evidence: evidence("Varad kokku olid 210 000 000 eurot") },
      { label: "Omakapital", value: 88_000, unit: "tuhat EUR", evidence: evidence("Omakapital oli 88 000 tuhat EUR") },
      { label: "Kohustised", value: 122.0, unit: "mln EUR", evidence: evidence("Kohustised olid 122,0 mln EUR") },
    ],
  },
  {
    sourceLanguage: "lv",
    companyName: "AS Piemers Baltic",
    reportPeriod: "2025. gads",
    metrics: [
      { label: "Ieņēmumi", value: 125_000_000, unit: "EUR", evidence: evidence("Ieņēmumi 2025. gadā bija 125 000 000 EUR") },
      { label: "EBITDA", value: 18.4, unit: "milj. EUR", evidence: evidence("EBITDA bija 18,4 milj. EUR") },
      { label: "Neto peļņa", value: 6_200, unit: "tūkst. EUR", evidence: evidence("Neto peļņa bija 6 200 tūkst. EUR") },
      { label: "Pamatdarbības naudas plūsma", value: 4.1, unit: "milj. EUR", evidence: evidence("Pamatdarbības naudas plūsma bija 4,1 milj. EUR") },
      { label: "Kopējie aktīvi", value: 210_000_000, unit: "EUR", evidence: evidence("Kopējie aktīvi bija 210 000 000 EUR") },
      { label: "Pašu kapitāls", value: 88_000, unit: "tūkst. EUR", evidence: evidence("Pašu kapitāls bija 88 000 tūkst. EUR") },
      { label: "Saistības", value: 122.0, unit: "milj. EUR", evidence: evidence("Saistības bija 122,0 milj. EUR") },
    ],
  },
  {
    sourceLanguage: "lt",
    companyName: "AB Pavyzdys Baltic",
    reportPeriod: "2025 m.",
    metrics: [
      { label: "Pajamos", value: 125_000_000, unit: "EUR", evidence: evidence("Pajamos 2025 m. sudarė 125 000 000 EUR") },
      { label: "EBITDA", value: 18.4, unit: "mln. EUR", evidence: evidence("EBITDA sudarė 18,4 mln. EUR") },
      { label: "Grynasis pelnas", value: 6_200, unit: "tūkst. EUR", evidence: evidence("Grynasis pelnas buvo 6 200 tūkst. EUR") },
      { label: "Laisvasis pinigų srautas", value: 4.1, unit: "mln. EUR", evidence: evidence("Laisvasis pinigų srautas buvo 4,1 mln. EUR") },
      { label: "Turtas", value: 210_000_000, unit: "EUR", evidence: evidence("Turtas sudarė 210 000 000 EUR") },
      { label: "Nuosavas kapitalas", value: 88_000, unit: "tūkst. EUR", evidence: evidence("Nuosavas kapitalas sudarė 88 000 tūkst. EUR") },
      { label: "Įsipareigojimai", value: 122.0, unit: "mln. EUR", evidence: evidence("Įsipareigojimai sudarė 122,0 mln. EUR") },
    ],
  },
];

const expectedCanonicalIds = [
  "revenue",
  "ebitda",
  "net_profit",
  expect.stringMatching(/^(free_cash_flow|operating_cash_flow)$/),
  "total_assets",
  "equity",
  "liabilities",
];

function snapshot(fixture: LanguageFixture): ExtractedData {
  return {
    metadata: {
      companyName: fixture.companyName,
      reportPeriod: fixture.reportPeriod,
      sourceLanguage: fixture.sourceLanguage,
      evidence: {
        companyName: evidence(fixture.companyName),
        reportPeriod: evidence(fixture.reportPeriod),
      },
    },
    metrics: fixture.metrics,
    narratives: [
      {
        section: "executive_summary",
        text: "The filing includes revenue, profitability, cash flow, and balance sheet data with source evidence.",
      },
    ],
    sentiment: { managementTone: "neutral", outlook: "Stable", riskFactors: [] },
  };
}

describe("multilingual extraction coverage", () => {
  it.each(fixtures)("preserves metadata for $sourceLanguage source filings", (fixture) => {
    const normalized = canonicalizeExtractedData(snapshot(fixture));

    expect(normalized.metadata).toMatchObject({
      companyName: fixture.companyName,
      reportPeriod: fixture.reportPeriod,
      sourceLanguage: fixture.sourceLanguage,
    });
    expect(normalized.metadata.evidence?.companyName?.snippet).toContain(fixture.companyName);
    expect(normalized.metadata.evidence?.reportPeriod?.snippet).toContain(fixture.reportPeriod);
  });

  it.each(fixtures)("maps common $sourceLanguage metric labels to canonical metrics", (fixture) => {
    const normalized = canonicalizeExtractedData(snapshot(fixture));

    expect(normalized.metrics.map((metric) => metric.canonicalId)).toEqual(expectedCanonicalIds);
  });

  it.each(fixtures)("normalizes whole, thousand, and million EUR evidence for $sourceLanguage", (fixture) => {
    const data = snapshot(fixture);
    const normalizedValues = data.metrics.map((metric) => Math.round(normalizeMetricValueToEur(metric, data) ?? 0));

    expect(normalizedValues).toEqual([
      125_000_000,
      18_400_000,
      6_200_000,
      4_100_000,
      210_000_000,
      88_000_000,
      122_000_000,
    ]);
  });
});
