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

We conducted our audit in accordance with International Standards on Auditing. The financial statements present fairly all material aspects position results operations according to applicable requirements...`;

      const result = classifyDocument(text);
      expect(result.docClass).toBe("auditor_report");
      expect(result.shouldReject).toBe(true);
      expect(result.rejectionMessage).toContain("auditor's report");
    });

    it("rejects an auditor report containing 'we have audited'", () => {
      const text = "We have audited the financial statements of the company consolidated financial statements present fairly the position results operations according to international standards auditing requirements procedures";
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
    it("rejects empty text as low_quality_text", () => {
      const result = classifyDocument("");
      expect(result.shouldReject).toBe(true);
      expect(result.docClass).toBe("low_quality_text");
    });

    it("rejects text with fewer than 10 unique 4+ letter words", () => {
      const text = "a b c d e f g h i j".repeat(10); // only 1-2 letter words
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(true);
      expect(result.docClass).toBe("low_quality_text");
    });
  });

  describe("text quality gate", () => {
    it("rejects garbled OCR output", () => {
      const text = "asdf qwer zxcv poi lkj mnb hgf dsa rew qaz wsx edc rfv tgb yhn ujm ik ol p".repeat(5);
      // These are 3-letter or random — no 4+ letter words
      const result = classifyDocument(text);
      expect(result.docClass).toBe("low_quality_text");
      expect(result.shouldReject).toBe(true);
      expect(result.rejectionMessage).toContain("scanned or image-only");
    });

    it("rejects borderline text with 8 unique 4+ letter words", () => {
      // 8 unique 4+ letter words — below the 10 threshold for the quality gate
      const text = "this that then them they here some more";
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(true);
      expect(result.docClass).toBe("low_quality_text");
    });

    it("passes text with 10+ unique 4+ letter words", () => {
      const text = "Annual Report 2024: Revenue increased significantly compared to previous fiscal periods. The management board presents this report to shareholders.";
      // "Annual Report Revenue increased significantly compared previous fiscal periods management board presents this report shareholders"
      // = many unique 4+ letter words
      const result = classifyDocument(text);
      expect(result.shouldReject).toBe(false);
    });

    it("quality gate runs before pattern matching (garbled text with auditor keyword)", () => {
      // Contains "audited" but doesn't have enough unique 4+ letter words
      const text = "audited financial report reviewed by committee audited reviewed by audited financial.";
      // unique 4+: audited, financial, report, reviewed, committee = 5 unique — below 10
      const result = classifyDocument(text);
      expect(result.docClass).toBe("low_quality_text");
      expect(result.shouldReject).toBe(true);
    });
  });
});
