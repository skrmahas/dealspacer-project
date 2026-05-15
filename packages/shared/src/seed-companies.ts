import type { SeedCompany } from "./index";

/**
 * Baltic listed companies seed data.
 * Run idempotently — uses ON CONFLICT (slug) DO UPDATE.
 */
export const BALTIC_COMPANIES: SeedCompany[] = [
  // Nasdaq Tallinn
  { name: "Arco Vara", ticker: "ARC1T", exchange: "Nasdaq Tallinn", slug: "arco-vara", country: "EE", sector: "Real Estate" },
  { name: "AS Baltika", ticker: "BLT1T", exchange: "Nasdaq Tallinn", slug: "baltika", country: "EE", sector: "Consumer Discretionary" },
  { name: "AS Ekspress Grupp", ticker: "EEG1T", exchange: "Nasdaq Tallinn", slug: "ekspress-grupp", country: "EE", sector: "Communication Services" },
  { name: "AS Harju Elekter", ticker: "HAE1T", exchange: "Nasdaq Tallinn", slug: "harju-elekter", country: "EE", sector: "Industrials" },
  { name: "AS LHV Group", ticker: "LHV1T", exchange: "Nasdaq Tallinn", slug: "lhv-group", country: "EE", sector: "Financials" },
  { name: "AS Merko Ehitus", ticker: "MRK1T", exchange: "Nasdaq Tallinn", slug: "merko-ehitus", country: "EE", sector: "Industrials" },
  { name: "AS Nordic Fibreboard", ticker: "SKN1T", exchange: "Nasdaq Tallinn", slug: "nordic-fibreboard", country: "EE", sector: "Materials" },
  { name: "AS Pro Kapital Grupp", ticker: "PKG1T", exchange: "Nasdaq Tallinn", slug: "pro-kapital", country: "EE", sector: "Real Estate" },
  { name: "AS Silvano Fashion Group", ticker: "SFG1T", exchange: "Nasdaq Tallinn", slug: "silvano-fashion", country: "EE", sector: "Consumer Discretionary" },
  { name: "AS Tallink Grupp", ticker: "TAL1T", exchange: "Nasdaq Tallinn", slug: "tallink-grupp", country: "EE", sector: "Industrials" },
  { name: "AS Tallinna Kaubamaja Grupp", ticker: "TKM1T", exchange: "Nasdaq Tallinn", slug: "tallinna-kaubamaja", country: "EE", sector: "Consumer Staples" },
  { name: "AS Tallinna Sadam", ticker: "TSM1T", exchange: "Nasdaq Tallinn", slug: "tallinna-sadam", country: "EE", sector: "Industrials" },
  { name: "AS Tallinna Vesi", ticker: "TVEAT", exchange: "Nasdaq Tallinn", slug: "tallinna-vesi", country: "EE", sector: "Utilities" },
  { name: "Bigbank", ticker: "BIG1T", exchange: "Nasdaq Tallinn", slug: "bigbank", country: "EE", sector: "Financials" },
  { name: "Coop Pank", ticker: "CPA1T", exchange: "Nasdaq Tallinn", slug: "coop-pank", country: "EE", sector: "Financials" },
  { name: "Enefit Green", ticker: "EGR1T", exchange: "Nasdaq Tallinn", slug: "enefit-green", country: "EE", sector: "Utilities" },
  { name: "Hepsor", ticker: "HPR1T", exchange: "Nasdaq Tallinn", slug: "hepsor", country: "EE", sector: "Real Estate" },

  // Nasdaq Riga
  { name: "AS Amber Latvijas Balzams", ticker: "BAL1R", exchange: "Nasdaq Riga", slug: "amber-latvijas-balzams", country: "LV", sector: "Consumer Staples" },
  { name: "AS DelfinGroup", ticker: "DGR1R", exchange: "Nasdaq Riga", slug: "delfingroup", country: "LV", sector: "Financials" },
  { name: "AS Grindeks", ticker: "GRD1R", exchange: "Nasdaq Riga", slug: "grindeks", country: "LV", sector: "Health Care" },
  { name: "AS Latvijas Gāze", ticker: "GZE1R", exchange: "Nasdaq Riga", slug: "latvijas-gaze", country: "LV", sector: "Utilities" },
  { name: "AS Latvijas Jūras medicīnas centrs", ticker: "LJM1R", exchange: "Nasdaq Riga", slug: "lj-medicinas-centrs", country: "LV", sector: "Health Care" },
  { name: "AS Olainfarm", ticker: "OLF1R", exchange: "Nasdaq Riga", slug: "olainfarm", country: "LV", sector: "Health Care" },
  { name: "AS SAF Tehnika", ticker: "SAF1R", exchange: "Nasdaq Riga", slug: "saf-tehnika", country: "LV", sector: "Information Technology" },
  { name: "AS Siguldas CMAS", ticker: "SCM1R", exchange: "Nasdaq Riga", slug: "siguldas-cmas", country: "LV", sector: "Consumer Staples" },
  { name: "AS Valmieras stikla škiedra", ticker: "VSS1R", exchange: "Nasdaq Riga", slug: "valmieras-stikla-skiedra", country: "LV", sector: "Materials" },
  { name: "IPAS Indexo", ticker: "IDX1R", exchange: "Nasdaq Riga", slug: "indexo", country: "LV", sector: "Financials" },
  { name: "Latvenergo", ticker: "LAT1R", exchange: "Nasdaq Riga", slug: "latvenergo", country: "LV", sector: "Utilities" },
  { name: "MADARA Cosmetics", ticker: "MDA1R", exchange: "Nasdaq Riga", slug: "madara-cosmetics", country: "LV", sector: "Consumer Staples" },

  // Nasdaq Vilnius
  { name: "AB Akola Group", ticker: "AKO1L", exchange: "Nasdaq Vilnius", slug: "akola-group", country: "LT", sector: "Consumer Staples" },
  { name: "AB Apranga", ticker: "APG1L", exchange: "Nasdaq Vilnius", slug: "apranga", country: "LT", sector: "Consumer Discretionary" },
  { name: "AB Grigeo", ticker: "GRG1L", exchange: "Nasdaq Vilnius", slug: "grigeo", country: "LT", sector: "Materials" },
  { name: "AB Ignitis Grupė", ticker: "IGN1L", exchange: "Nasdaq Vilnius", slug: "ignitis-grupe", country: "LT", sector: "Utilities" },
  { name: "AB Klaipėdos Nafta", ticker: "KNF1L", exchange: "Nasdaq Vilnius", slug: "klaipedos-nafta", country: "LT", sector: "Energy" },
  { name: "AB LITGRID", ticker: "LGD1L", exchange: "Nasdaq Vilnius", slug: "litgrid", country: "LT", sector: "Utilities" },
  { name: "AB Novaturas", ticker: "NTU1L", exchange: "Nasdaq Vilnius", slug: "novaturas", country: "LT", sector: "Consumer Discretionary" },
  { name: "AB Panevėžio Statybos Trestas", ticker: "PTR1L", exchange: "Nasdaq Vilnius", slug: "panevezio-statybos-trestas", country: "LT", sector: "Industrials" },
  { name: "AB Pieno Žvaigždės", ticker: "PZV1L", exchange: "Nasdaq Vilnius", slug: "pieno-zvaigzdes", country: "LT", sector: "Consumer Staples" },
  { name: "AB Rokiškio Sūris", ticker: "RSU1L", exchange: "Nasdaq Vilnius", slug: "rokiskio-suris", country: "LT", sector: "Consumer Staples" },
  { name: "AB Šiaulių Bankas", ticker: "SAB1L", exchange: "Nasdaq Vilnius", slug: "siauliu-bankas", country: "LT", sector: "Financials" },
  { name: "AB Snaigė", ticker: "SNG1L", exchange: "Nasdaq Vilnius", slug: "snaige", country: "LT", sector: "Consumer Discretionary" },
  { name: "AB Telia Lietuva", ticker: "TEL1L", exchange: "Nasdaq Vilnius", slug: "telia-lietuva", country: "LT", sector: "Communication Services" },
  { name: "AB Vilkyškių Pieninė", ticker: "VLP1L", exchange: "Nasdaq Vilnius", slug: "vilkyškiu-pienine", country: "LT", sector: "Consumer Staples" },
  { name: "AB Žemaitijos Pienas", ticker: "ZMP1L", exchange: "Nasdaq Vilnius", slug: "zemaitijos-pienas", country: "LT", sector: "Consumer Staples" },
];
