import { describe, it, expect } from "vitest";
import { classifyDocument } from "./classifier.js";

describe("classifyDocument", () => {
  describe("financial reports (should pass)", () => {
    it("classifies a typical earnings report as financial_report", () => {
      const text = "AS Tallink Grupp\nAnnual Report 2024\n\nRevenue EUR 210.4 million\nEBITDA EUR 48.7 million\nNet Profit EUR 12.3 million\n\nThe Group continued to improve operational efficiency...";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("financial_report");
      expect(result.shouldReject).toBe(false);
    });

    it("classifies a strategic plan as financial_report", () => {
      const text = "Baltic Horizon Strategy 2026-2029\n\nTarget Revenue: EUR 500M by 2029\nEBITDA target: EUR 120M\nInvestment plan: EUR 250M over the period\n\nThe company plans significant expansion...";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("financial_report");
      expect(result.shouldReject).toBe(false);
    });

    it("passes a document with financial terms even if ambiguous", () => {
      const text = "Quarterly earnings call transcript\nRevenue was up 15% year-on-year. Net profit exceeded expectations. Our EBITDA margin improved...";
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(false);
    });
  });

  describe("auditor reports (should reject)", () => {
    it("rejects a KPMG auditor report with specific message", () => {
      const text = `Independent Auditor's Report

To the Shareholders of AS Example Baltic

We have audited the consolidated financial statements of AS Example Baltic...

In our opinion, the accompanying consolidated financial statements present fairly, in all material respects...

We conducted our audit in accordance with International Standards on Auditing...`;

      const result = classifyDocument(text);
      expect(result.docClass).toBe("auditor_report");
      expect(result.shouldReject).toBe(true);
      expect(result.rejectionMessage).toContain("auditor's report");
    });

    it("rejects an auditor report containing 'we have audited'", () => {
      const text = "We have audited the financial statements of the company. In our opinion they present fairly...";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("auditor_report");
      expect(result.shouldReject).toBe(true);
    });

    it("rejects a document mentioning International Standards on Auditing", () => {
      const text = "This audit was performed in accordance with International Standards on Auditing. The financial statements present fairly...";
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(true);
    });
  });

  describe("prospectuses (should reject)", () => {
    it("rejects a prospectus document", () => {
      const text = "Prospectus\nOffering of Securities\n\nThis Prospectus has been prepared in connection with the offering of up to 5,000,000 ordinary shares of AS Baltic Company... The subscription period begins on...";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("prospectus");
      expect(result.shouldReject).toBe(true);
      expect(result.rejectionMessage).toContain("prospectus");
    });
  });

  describe("legal/regulatory filings (should reject)", () => {
    it("rejects a regulatory filing with multiple legal patterns", () => {
      const text = "Stock Exchange Release\n\nAS Baltic hereby notifies that pursuant to the Securities and Exchange Commission regulations, this inside information is disclosed... This is a translation of the original Estonian notice.";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("legal_filing");
      expect(result.shouldReject).toBe(true);
      expect(result.rejectionMessage).toContain("regulatory filing");
    });

    it("passes a document with only one legal pattern (not enough for rejection)", () => {
      const text = "Annual Report 2024\n\nRevenue EUR 100M. The company hereby announces its annual results for the fiscal year. EBITDA grew 20%...";
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(false);
    });
  });

  describe("press releases (should reject only when clearly PR and non-financial)", () => {
    it("rejects a non-financial press release with multiple PR indicators", () => {
      const text = "FOR IMMEDIATE RELEASE\nPress Release\n\nAS Baltic Company announces the appointment of a new Chief Marketing Officer... The new CMO brings 20 years of experience...";
      const result = classifyDocument(text);
      expect(result.docClass).toBe("press_release");
      expect(result.shouldReject).toBe(true);
    });

    it("passes a press release that contains financial data", () => {
      const text = "FOR IMMEDIATE RELEASE\nPress Release\n\nAS Baltic reports Q4 revenue of EUR 52M, up 8% year-on-year. EBITDA reached EUR 12M with net profit of EUR 5M...";
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(false);
    });
  });

  describe("only examines first ~2000 characters", () => {
    it("rejects an auditor report where audit text starts after 1000 chars of preamble", () => {
      const preamble = "AS Baltic Company\nRegistration code: 12345678\nAddress: Tallinn, Estonia\n".repeat(14); // ~1100 chars
      const body = "\n\nIndependent Auditor's Report\n\nWe have audited the financial statements...";
      const text = preamble + body;
      const result = classifyDocument(text);
      expect(result.docClass).toBe("auditor_report");
      expect(result.shouldReject).toBe(true);
    });
  });

  describe("empty or minimal documents", () => {
    it("passes empty text as financial_report (falls through to NO_FINANCIAL_DATA gate)", () => {
      const result = classifyDocument("");
      expect(result.shouldReject).toBe(false);
      expect(result.docClass).toBe("financial_report");
    });
  });
});
