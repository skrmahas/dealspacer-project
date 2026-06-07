import { describe, expect, it } from "vitest";
import type { Company, ReportWithPreview } from "./contracts";
import {
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
