/**
 * Fetches https://nasdaqbaltic.com/statistics/en/shares and regenerates
 * packages/shared/src/seed-companies.ts (70 equity issuers: Main + Secondary + First North).
 *
 * Usage: node packages/shared/scripts/sync-nasdaq-baltic-seed.mjs
 */
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "bei-catalog/1" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

const HOME_TO_EXCHANGE = {
  TLN: "Nasdaq Tallinn",
  RIG: "Nasdaq Riga",
  VLN: "Nasdaq Vilnius",
};

const HOME_TO_COUNTRY = {
  TLN: "EE",
  RIG: "LV",
  VLN: "LT",
};

/** Nasdaq HTML sometimes omits industry tooltips; keep sectors sensible after sync. */
const SECTOR_OVERRIDES = {
  PRIMO: "Consumer Discretionary",
  ROE1L: "Financials",
};

function parseRows(html) {
  const rows = [];
  const trBlocks = html.split("<tr").slice(1).map((s) => s.split("</tr>")[0]);
  for (const block of trBlocks) {
    const tickerMatch = block.match(/class="text16 compname">([A-Z0-9]{2,10})<\/a>/);
    if (!tickerMatch) continue;
    const ticker = tickerMatch[1];
    const titleMatch = block.match(/compname-flex[^>]*\s+title="([^"]+)"/);
    const sortMatch = block.match(/<td data-sort-by="([^"]+)"/);
    const name = (titleMatch?.[1] ?? sortMatch?.[1])?.trim();
    if (!name) continue;
    const homeMatch = block.match(
      /d-none">(TLN|RIG|VLN)<\/td>\s*\n\s*<td><a href="\/\/lt\.morningstar/,
    );
    if (!homeMatch) continue;
    const home = homeMatch[1];
    const sectorTitles = [
      ...block.matchAll(/tablesaw-toggle-cellhidden d-none text12"><span title="([^"]+)"/g),
    ].map((m) => m[1]);
    let sector = sectorTitles[0]?.trim() ?? "Unknown";
    if (sector === "Unknown" && sectorTitles[1]) sector = sectorTitles[1].trim();
    if (SECTOR_OVERRIDES[ticker]) sector = SECTOR_OVERRIDES[ticker];
    rows.push({
      name,
      ticker,
      homeMarket: home,
      exchange: HOME_TO_EXCHANGE[home],
      country: HOME_TO_COUNTRY[home],
      sector,
    });
  }
  return rows;
}

/** Preserve stable /companies/:slug URLs for tickers that existed before full-exchange sync. */
const LEGACY_SLUG = {
  AKO1L: "akola-group",
  APG1L: "apranga",
  ARC1T: "arco-vara",
  CPA1T: "coop-pank",
  DGR1R: "delfingroup",
  EEG1T: "ekspress-grupp",
  HAE1T: "harju-elekter",
  LHV1T: "lhv-group",
  MRK1T: "merko-ehitus",
  SKN1T: "nordic-fibreboard",
  PKG1T: "pro-kapital",
  SFG1T: "silvano-fashion",
  TAL1T: "tallink-grupp",
  TKM1T: "tallinna-kaubamaja",
  TSM1T: "tallinna-sadam",
  TVE1T: "tallinna-vesi",
  HPR1T: "hepsor",
  BAL1R: "amber-latvijas-balzams",
  SAF1R: "saf-tehnika",
  SCM1R: "siguldas-cmas",
  IDX1R: "indexo",
  IGN1L: "ignitis-grupe",
  GRG1L: "grigeo",
  LGD1L: "litgrid",
  NTU1L: "novaturas",
  PZV1L: "pieno-zvaigzdes",
  RSU1L: "rokiskio-suris",
  TEL1L: "telia-lietuva",
  VLP1L: "vilkyškiu-pienine",
  ZMP1L: "zemaitijos-pienas",
  MDARA: "madara-cosmetics",
};

const EXCHANGE_ORDER = { "Nasdaq Tallinn": 0, "Nasdaq Riga": 1, "Nasdaq Vilnius": 2 };

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugFor(row) {
  const leg = LEGACY_SLUG[row.ticker];
  if (leg) return leg;
  const base = slugify(row.name);
  if (!base) return row.ticker.toLowerCase();
  return base;
}

function displayName(row) {
  const n = row.name;
  if (row.ticker === "HAE1T" && n === "Harju Elekter Group") return "AS Harju Elekter";
  if (row.ticker === "GRG1L" && n === "Grigeo Group") return "AB Grigeo";
  return n;
}

const html = await get("https://nasdaqbaltic.com/statistics/en/shares");
const rows = parseRows(html);
rows.sort(
  (a, b) =>
    EXCHANGE_ORDER[a.exchange] - EXCHANGE_ORDER[b.exchange] || a.name.localeCompare(b.name),
);

const syncDate = new Date().toISOString().slice(0, 10);
const lines = rows.map((r) => {
  const slug = slugFor(r);
  const name = displayName(r);
  return `  { name: ${JSON.stringify(name)}, ticker: ${JSON.stringify(r.ticker)}, exchange: ${JSON.stringify(r.exchange)}, slug: ${JSON.stringify(slug)}, country: ${JSON.stringify(r.country)}, sector: ${JSON.stringify(r.sector)} },`;
});

const banner = `/**
 * Baltic listed companies — Nasdaq Baltic share lists (Main, Secondary, First North Baltic, FN foreign).
 * Synced from https://nasdaqbaltic.com/statistics/en/shares (${syncDate}).
 * Regenerate: node packages/shared/scripts/sync-nasdaq-baltic-seed.mjs
 * Run idempotently — uses ON CONFLICT (slug) DO UPDATE.
 */`;

const out = `${banner}
import type { SeedCompany } from "./index";

export const BALTIC_COMPANIES: SeedCompany[] = [
${lines.join("\n")}
];
`;

const dest = path.join(__dirname, "..", "src", "seed-companies.ts");
fs.writeFileSync(dest, out, "utf8");
console.error("wrote", dest, "companies", rows.length);
