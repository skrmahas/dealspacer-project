import { describe, it, expect } from "vitest";
import { parseReportPeriod, pickBestMatch, normalizeCompanyName } from "./company-matcher.js";

const CATALOG = [
  { id: "telia",     name: "AB Telia Lietuva",          ticker: "TEL1L" },
  { id: "tallink",   name: "AS Tallink Grupp",          ticker: "TAL1T" },
  { id: "lhv",       name: "AS LHV Group",              ticker: "LHV1T" },
  { id: "bigbank",   name: "Bigbank",                   ticker: "BIG1T" },
  { id: "coop",      name: "Coop Pank",                 ticker: "CPA1T" },
  { id: "indexo",    name: "IPAS Indexo",               ticker: "IDX1R" },
  { id: "latgaze",   name: "AS Latvijas Gāze",          ticker: "GZE1R" },
  { id: "prokap",    name: "AS Pro Kapital Grupp",      ticker: "PKG1T" },
  { id: "ignitis",   name: "AB Ignitis Grupė",          ticker: "IGN1L" },
  { id: "madara",    name: "MADARA Cosmetics",          ticker: "MDARA" },
];

describe("normalizeCompanyName", () => {
  it("strips trailing legal form", () => {
    expect(normalizeCompanyName("Telia Lietuva, AB")).toEqual(["telia", "lietuva"]);
  });

  it("strips leading legal form", () => {
    expect(normalizeCompanyName("AB Telia Lietuva")).toEqual(["telia", "lietuva"]);
  });

  it("strips multiple punctuation styles", () => {
    expect(normalizeCompanyName("AB \"Telia\" Lietuva.")).toEqual(["telia", "lietuva"]);
  });

  it("handles A/S (Nordic legal form)", () => {
    expect(normalizeCompanyName("Bigbank A/S")).toEqual(["bigbank"]);
  });

  it("preserves words that happen to contain legal-form substrings", () => {
    // "Asset" must NOT be stripped to "set" just because it contains "as"
    expect(normalizeCompanyName("Asset Management OÜ")).toEqual(["asset", "management"]);
  });
});

describe("pickBestMatch", () => {
  it("matches exact catalog name", () => {
    const r = pickBestMatch("AB Telia Lietuva", CATALOG);
    expect(r?.companyId).toBe("telia");
    expect(r?.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it("matches with reversed legal-form order (regression for unmatched Telia)", () => {
    const r = pickBestMatch("Telia Lietuva, AB", CATALOG);
    expect(r?.companyId).toBe("telia");
    expect(r?.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it("matches with legal form dropped entirely", () => {
    const r = pickBestMatch("Telia Lietuva", CATALOG);
    expect(r?.companyId).toBe("telia");
    expect(r?.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it("matches with single-word name (Bigbank)", () => {
    const r = pickBestMatch("Bigbank", CATALOG);
    expect(r?.companyId).toBe("bigbank");
  });

  it("matches with Nordic A/S suffix", () => {
    const r = pickBestMatch("Bigbank A/S", CATALOG);
    expect(r?.companyId).toBe("bigbank");
  });

  it("matches when the extracted name reverses the words", () => {
    const r = pickBestMatch("Grupp Tallink, AS", CATALOG);
    expect(r?.companyId).toBe("tallink");
  });

  it("matches on ticker alone", () => {
    const r = pickBestMatch("TEL1L", CATALOG);
    expect(r?.companyId).toBe("telia");
  });

  it("matches when ticker appears in parens after the name", () => {
    const r = pickBestMatch("AB Telia Lietuva (TEL1L)", CATALOG);
    expect(r?.companyId).toBe("telia");
  });

  it("tolerates a single typo in the core name", () => {
    const r = pickBestMatch("Tallnik Grupp AS", CATALOG);
    expect(r?.companyId).toBe("tallink");
    expect(r?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("matches across diacritics consistently", () => {
    const r = pickBestMatch("Latvijas Gāze AS", CATALOG);
    expect(r?.companyId).toBe("latgaze");
  });

  it("returns null for an unrelated single token", () => {
    const r = pickBestMatch("Telia", CATALOG);
    expect(r).toBeNull();
  });

  it("returns null when the extracted name only contains legal forms", () => {
    expect(pickBestMatch("AB", CATALOG)).toBeNull();
    expect(pickBestMatch("AS, AB", CATALOG)).toBeNull();
  });

  it("returns null for a completely unknown company", () => {
    expect(pickBestMatch("Acme Widgets Corp", CATALOG)).toBeNull();
  });

  it("does not confuse Grupp companies sharing a generic word", () => {
    // "Grupp" alone could match Tallink Grupp, Pro Kapital Grupp, ... — must reject.
    expect(pickBestMatch("Grupp", CATALOG)).toBeNull();
  });

  it("prefers the higher-confidence candidate when two could fuzzy-match", () => {
    // "AS LHV Group" is a closer match than "AS Tallink Grupp" for "LHV Group".
    const r = pickBestMatch("LHV Group", CATALOG);
    expect(r?.companyId).toBe("lhv");
  });

  it("matches IPAS prefix Latvian companies", () => {
    const r = pickBestMatch("Indexo IPAS", CATALOG);
    expect(r?.companyId).toBe("indexo");
  });

  it("matches AB-prefixed Lithuanian companies with Lithuanian diacritics", () => {
    const r = pickBestMatch("Ignitis Grupė", CATALOG);
    expect(r?.companyId).toBe("ignitis");
  });
});

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
