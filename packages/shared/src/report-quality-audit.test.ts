import { describe, expect, it } from "vitest";
import type { Company, ReportWithPreview } from "./contracts";
import {
  auditReportQuality,
  auditReportCompanyMismatch,
  findSuggestedCompany,
  normalizeCompanyNameForAudit,
  scoreCompanyNameMatch,
} from "./report-quality-audit";

const COMPANIES: Pick<Company, "id" | "name" | "ticker">[] = [
  { id: "telia", name: "Telia Lietuva", ticker: "TEL1L" },
  { id: "orkela", name: "UAB Orkela", ticker: null },
  { id: "tallink", name: "AS Tallink Grupp", ticker: "TAL1T" },
];

function report(overrides: Partial<ReportWithPreview> = {}): ReportWithPreview {
  return {
    id: "report-1",
    companyId: "telia",
    companyName: "Telia Lietuva",
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: "job-1",
    s3Key: "reports/job-1.pdf",
    extractedJsonSnapshot: {
      metadata: { companyName: "Telia Lietuva, AB", reportPeriod: "FY 2024", sourceLanguage: "lt" },
      metrics: [],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("report quality audit company matching", () => {
  it("normalizes legal forms and diacritics", () => {
    expect(normalizeCompanyNameForAudit("AB „Telia“ Lietuva")).toEqual(["telia", "lietuva"]);
  });

  it("scores matching extracted and catalog companies above threshold", () => {
    expect(scoreCompanyNameMatch("Telia Lietuva, AB", COMPANIES[0]!)).toBeGreaterThanOrEqual(0.85);
  });

  it("suggests the correct company for a known extracted company", () => {
    const suggested = findSuggestedCompany('UAB "Orkela"', COMPANIES);

    expect(suggested.company?.id).toBe("orkela");
    expect(suggested.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("does not flag reports whose extracted company matches the catalog company", () => {
    expect(auditReportCompanyMismatch(report(), COMPANIES)).toBeNull();
  });

  it("flags reports whose extracted company conflicts with the catalog company", () => {
    const audit = auditReportCompanyMismatch(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: 'UAB "Orkela"', reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [],
          narratives: [],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit).toMatchObject({
      reportId: "report-1",
      catalogCompanyName: "Telia Lietuva",
      extractedCompanyName: 'UAB "Orkela"',
      suggestedCompanyId: "orkela",
      suggestedCompanyName: "UAB Orkela",
    });
  });

  it("ignores unmatched reports because they are already in the review bucket", () => {
    expect(auditReportCompanyMismatch(report({ companyId: null }), COMPANIES)).toBeNull();
  });
});

describe("report quality audit catalog checks", () => {
  it("returns null for a report with healthy core data", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: "Telia Lietuva, AB", reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [
            { label: "Revenue", value: 100, unit: "EUR", canonicalId: "revenue" },
            { label: "EBITDA", value: 40, unit: "EUR", canonicalId: "ebitda" },
            { label: "Net profit", value: 20, unit: "EUR", canonicalId: "net_profit" },
            { label: "Free cash flow", value: 10, unit: "EUR", canonicalId: "free_cash_flow" },
          ],
          narratives: [{ section: "executive_summary", text: "Revenue increased during the year." }],
          sentiment: { managementTone: "positive", outlook: "Stable", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit).toBeNull();
  });

  it("flags missing snapshot as high severity", () => {
    const audit = auditReportQuality(report({ extractedJsonSnapshot: null }), COMPANIES);

    expect(audit).toMatchObject({
      severity: "high",
      issueCodes: ["missing_snapshot"],
    });
  });

  it("flags missing metadata and zero metrics", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: "", reportPeriod: "", sourceLanguage: "lt" },
          metrics: [],
          narratives: [],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit?.severity).toBe("high");
    expect(audit?.issueCodes).toEqual(
      expect.arrayContaining([
        "missing_company_metadata",
        "missing_report_period_metadata",
        "zero_metrics",
      ]),
    );
  });

  it("flags mostly null metrics and missing core metrics", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: "Telia Lietuva, AB", reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [
            { label: "Revenue", value: 100, unit: "EUR", canonicalId: "revenue" },
            { label: "EBITDA", value: null, unit: "EUR", canonicalId: "ebitda" },
            { label: "Net profit", value: null, unit: "EUR", canonicalId: "net_profit" },
          ],
          narratives: [{ section: "executive_summary", text: "Revenue increased during the year." }],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit?.severity).toBe("medium");
    expect(audit?.issueCodes).toEqual(
      expect.arrayContaining(["mostly_null_metrics", "missing_core_metrics"]),
    );
  });

  it("flags malformed trend and duplicate breakdown data", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: "Telia Lietuva, AB", reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [
            { label: "Revenue", value: 100, unit: "EUR", canonicalId: "revenue" },
            { label: "EBITDA", value: 40, unit: "EUR", canonicalId: "ebitda" },
            { label: "Net profit", value: 20, unit: "EUR", canonicalId: "net_profit" },
            { label: "Free cash flow", value: 10, unit: "EUR", canonicalId: "free_cash_flow" },
          ],
          narratives: [{ section: "executive_summary", text: "Revenue increased during the year." }],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
          profitabilityTrends: {
            periods: ["2023", "2023"],
            revenue: [null, null],
            ebitda: [1],
          },
          revenueBreakdown: {
            bySegment: [
              { name: "Retail", value: 60 },
              { name: "retail", value: 40 },
            ],
          },
        },
      }),
      COMPANIES,
    );

    expect(audit?.issueCodes).toEqual(
      expect.arrayContaining([
        "duplicate_trend_periods",
        "trend_series_length_mismatch",
        "duplicate_revenue_breakdown_entries",
      ]),
    );
  });

  it("flags non-canonical narrative sections and missing executive summary", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: "Telia Lietuva, AB", reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [
            { label: "Revenue", value: 100, unit: "EUR", canonicalId: "revenue" },
            { label: "EBITDA", value: 40, unit: "EUR", canonicalId: "ebitda" },
            { label: "Net profit", value: 20, unit: "EUR", canonicalId: "net_profit" },
            { label: "Free cash flow", value: 10, unit: "EUR", canonicalId: "free_cash_flow" },
          ],
          narratives: [{ section: "financial_results", text: "Revenue increased during the year." }],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit?.issueCodes).toEqual(
      expect.arrayContaining([
        "non_canonical_narrative_sections",
        "missing_executive_summary",
      ]),
    );
  });

  it("includes company mismatch in the broader quality audit", () => {
    const audit = auditReportQuality(
      report({
        extractedJsonSnapshot: {
          metadata: { companyName: 'UAB "Orkela"', reportPeriod: "FY 2024", sourceLanguage: "lt" },
          metrics: [],
          narratives: [],
          sentiment: { managementTone: "", outlook: "", riskFactors: [] },
        },
      }),
      COMPANIES,
    );

    expect(audit?.severity).toBe("high");
    expect(audit?.issueCodes).toContain("company_mismatch");
    expect(audit?.suggestedCompanyId).toBe("orkela");
  });
});
