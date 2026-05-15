import { describe, it, expect } from "vitest";
import { parseReportPeriod } from "./company-matcher.js";

describe("parseReportPeriod", () => {
  it("parses '2024' as annual", () => {
    const r = parseReportPeriod("2024");
    expect(r).not.toBeNull();
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("annual");
  });

  it("parses 'FY2024' as annual", () => {
    const r = parseReportPeriod("FY2024");
    expect(r).not.toBeNull();
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("annual");
  });

  it("parses 'FY 2024' as annual", () => {
    const r = parseReportPeriod("FY 2024");
    expect(r).not.toBeNull();
    expect(r!.fiscalYear).toBe(2024);
  });

  it("parses 'Q1 2024'", () => {
    const r = parseReportPeriod("Q1 2024");
    expect(r).not.toBeNull();
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("q1");
  });

  it("parses 'Q4 2023'", () => {
    const r = parseReportPeriod("Q4 2023");
    expect(r!.reportType).toBe("q4");
    expect(r!.fiscalYear).toBe(2023);
  });

  it("parses '2024 annual'", () => {
    const r = parseReportPeriod("2024 annual");
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("annual");
  });

  it("parses '2024 annual report'", () => {
    const r = parseReportPeriod("2024 annual report");
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("annual");
  });

  it("parses '2024-12-31' as annual", () => {
    const r = parseReportPeriod("2024-12-31");
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("annual");
  });

  it("parses '2024-03-31' as q1", () => {
    const r = parseReportPeriod("2024-03-31");
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("q1");
  });

  it("parses 'H1 2024' as semi-annual", () => {
    const r = parseReportPeriod("H1 2024");
    expect(r!.fiscalYear).toBe(2024);
    expect(r!.reportType).toBe("semi-annual");
  });

  it("returns null for unparseable strings", () => {
    expect(parseReportPeriod("")).toBeNull();
    expect(parseReportPeriod("not a date")).toBeNull();
    expect(parseReportPeriod("quarterly")).toBeNull();
  });
});
