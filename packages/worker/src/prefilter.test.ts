import { describe, it, expect } from "vitest";
import { prefilterDocumentText } from "./prefilter.js";

describe("prefilterDocumentText", () => {
  it("preserves financial content", () => {
    const text = "Revenue reached EUR 210.4 million in Q1 2024.\nEBITDA was EUR 48.7 million.\nNet profit: EUR 12.3 million.";
    const result = prefilterDocumentText(text);
    expect(result).toContain("Revenue");
    expect(result).toContain("EBITDA");
    expect(result).toContain("Net profit");
  });

  it("removes table of contents patterns", () => {
    const text = "Table of Contents\n1. Introduction ....... 3\n2. Financial Review ... 5\n\nActual financial data: Revenue EUR 100M";
    const result = prefilterDocumentText(text);
    expect(result).not.toContain("Table of Contents");
    expect(result).not.toMatch(/\.{2,}\s*\d+/);
    expect(result).toContain("Actual financial data");
  });

  it("removes audit report boilerplate", () => {
    const text = "Independent Auditor's Report\nWe have audited the financial statements\nin our opinion\n\nRevenue: EUR 100M\nEBITDA: EUR 30M";
    const result = prefilterDocumentText(text);
    expect(result).not.toContain("Independent Auditor's Report");
    expect(result).not.toContain("We have audited");
    expect(result).toContain("Revenue");
    expect(result).toContain("EBITDA");
  });

  it("removes repeated headers appearing 3+ times", () => {
    const lines = ["AS Tallink Grupp", "Annual Report 2024", "Financial Data"];
    const text = [...lines, ...lines.map(() => "AS Tallink Grupp"), ...lines.map(() => "AS Tallink Grupp")].join("\n");
    // "AS Tallink Grupp" appears 3 times → removed
    const result = prefilterDocumentText(text);
    // The repeated header should be filtered
    expect(result.split("\n").filter((l) => l.trim() === "AS Tallink Grupp").length).toBeLessThan(3);
  });

  it("removes accounting policy boilerplate", () => {
    const text = "Summary of Significant Accounting Policies\nBasis of Preparation\nThe financial statements have been prepared under IFRS\n\nRevenue: EUR 100M";
    const result = prefilterDocumentText(text);
    expect(result).not.toContain("Summary of Significant Accounting Policies");
    expect(result).not.toContain("Basis of Preparation");
    expect(result).toContain("Revenue");
  });

  it("removes translation disclaimers", () => {
    const text = "This document is a translation of the original\nIn the event of any discrepancy the Estonian version prevails\n\nRevenue EUR 100M";
    const result = prefilterDocumentText(text);
    expect(result).not.toContain("This document is a translation");
    expect(result).not.toContain("In the event of any discrepancy");
    expect(result).toContain("Revenue");
  });

  it("does not modify text with no boilerplate", () => {
    const text = "Management Commentary\n\nThe company performed well this quarter.\nRevenue grew 15% year-on-year.\nEBITDA margins improved to 23%.";
    const result = prefilterDocumentText(text);
    expect(result).toContain("Management Commentary");
    expect(result).toContain("Revenue grew");
    expect(result).toContain("EBITDA margins");
  });
});
