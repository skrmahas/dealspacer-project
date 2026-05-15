import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer, { Browser, Page, type LaunchOptions } from "puppeteer";
import type { ExtractedData, ExtractedMetric, OutputLanguage } from "@bei/shared";
import { renderAllCharts, type ChartImages } from "./chart-renderer.js";

// ── HTML Template ───────────────────────────────────────────────────────────

function formatMetricValue(m: ExtractedMetric): string {
  if (m.value == null) return "—";
  const formatted = m.value.toLocaleString("en-US");
  return m.unit ? `${formatted} ${m.unit}` : formatted;
}

function formatMetricRow(m: ExtractedMetric): string {
  return `
    <tr>
      <td class="label">${escapeHtml(m.label)}</td>
      <td class="value">${escapeHtml(formatMetricValue(m))}</td>
    </tr>`;
}

function formatNumericValue(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

const LABELS: Record<OutputLanguage, {
  earningsReport: string;
  generatedOn: string;
  automatedReport: string;
  executiveSummary: string;
  keyMetricsDashboard: string;
  metric: string;
  value: string;
  trend: string;
  yoyChange: string;
  name: string;
  period: string;
  revenue: string;
  ebitda: string;
  netProfit: string;
  revenueBySegment: string;
  revenueByGeography: string;
  revenueBreakdown: string;
  revenueBreakdownChart: string;
  revenueDonutChart: string;
  profitabilityTrends: string;
  profitabilityTrendsChart: string;
  businessHighlights: string;
  sentimentAnalysis: string;
  managementTone: string;
  outlook: string;
  riskFactors: string;
  aiDisclaimer: string;
  disclaimerText: string;
}> = {
  en: {
    earningsReport: "Earnings Report",
    generatedOn: "Generated on",
    automatedReport: "Automated Financial Analysis Report",
    executiveSummary: "Executive Summary",
    keyMetricsDashboard: "Key Metrics Dashboard",
    metric: "Metric",
    value: "Value",
    trend: "Trend",
    yoyChange: "YoY Change",
    name: "Name",
    period: "Period",
    revenue: "Revenue",
    ebitda: "EBITDA",
    netProfit: "Net Profit",
    revenueBySegment: "Revenue by Segment",
    revenueByGeography: "Revenue by Geography",
    revenueBreakdown: "Revenue Breakdown",
    revenueBreakdownChart: "Revenue Breakdown Chart",
    revenueDonutChart: "Revenue Donut Chart",
    profitabilityTrends: "Profitability Trends",
    profitabilityTrendsChart: "Profitability Trends Chart",
    businessHighlights: "Business & Segment Highlights",
    sentimentAnalysis: "Sentiment Analysis",
    managementTone: "Management Tone",
    outlook: "Outlook",
    riskFactors: "Risk Factors",
    aiDisclaimer: "AI-Generated Disclaimer",
    disclaimerText: "This report was automatically produced using artificial intelligence (GPT-4o) based on the uploaded document. While every effort has been made to ensure accuracy, the information may contain errors or omissions. This report does not constitute financial advice, investment recommendation, or an offer to buy or sell any security. Always verify figures against the original source document and consult a qualified financial professional before making investment decisions.",
  },
  et: {
    earningsReport: "Tulemuste aruanne",
    generatedOn: "Koostatud",
    automatedReport: "Automaatne finantsanalüüsi aruanne",
    executiveSummary: "Kokkuvõte",
    keyMetricsDashboard: "Peamised finantsnäitajad",
    metric: "Näitaja",
    value: "Väärtus",
    trend: "Trend",
    yoyChange: "Aastane muutus",
    name: "Nimi",
    period: "Periood",
    revenue: "Käive",
    ebitda: "EBITDA",
    netProfit: "Puhaskasum",
    revenueBySegment: "Käive segmentide lõikes",
    revenueByGeography: "Käive geograafia lõikes",
    revenueBreakdown: "Käibe jaotus",
    revenueBreakdownChart: "Käibe jaotuse graafik",
    revenueDonutChart: "Käibe sektordiagramm",
    profitabilityTrends: "Kasumlikkuse trendid",
    profitabilityTrendsChart: "Kasumlikkuse trendide graafik",
    businessHighlights: "Äri- ja segmentide ülevaade",
    sentimentAnalysis: "Hoiaku analüüs",
    managementTone: "Juhtkonna hoiak",
    outlook: "Väljavaade",
    riskFactors: "Riskitegurid",
    aiDisclaimer: "AI loodud lahtiütlus",
    disclaimerText: "See aruanne koostati automaatselt tehisintellekti (GPT-4o) abil üles laaditud dokumendi põhjal. Kuigi täpsuse tagamiseks on tehtud pingutusi, võib teave sisaldada vigu või puudusi. See aruanne ei ole finantsnõuanne, investeerimissoovitus ega pakkumine väärtpabereid osta või müüa. Kontrollige näitajad alati algdokumendist ja konsulteerige enne investeerimisotsuseid kvalifitseeritud spetsialistiga.",
  },
  lv: {
    earningsReport: "Peļņas pārskats",
    generatedOn: "Sagatavots",
    automatedReport: "Automatizēts finanšu analīzes pārskats",
    executiveSummary: "Kopsavilkums",
    keyMetricsDashboard: "Galvenie finanšu rādītāji",
    metric: "Rādītājs",
    value: "Vērtība",
    trend: "Tendence",
    yoyChange: "Izmaiņas pret iepriekšējo gadu",
    name: "Nosaukums",
    period: "Periods",
    revenue: "Ieņēmumi",
    ebitda: "EBITDA",
    netProfit: "Neto peļņa",
    revenueBySegment: "Ieņēmumi pa segmentiem",
    revenueByGeography: "Ieņēmumi pa ģeogrāfiju",
    revenueBreakdown: "Ieņēmumu sadalījums",
    revenueBreakdownChart: "Ieņēmumu sadalījuma diagramma",
    revenueDonutChart: "Ieņēmumu apļa diagramma",
    profitabilityTrends: "Rentabilitātes tendences",
    profitabilityTrendsChart: "Rentabilitātes tendenču diagramma",
    businessHighlights: "Uzņēmējdarbības un segmentu pārskats",
    sentimentAnalysis: "Noskaņojuma analīze",
    managementTone: "Vadības tonis",
    outlook: "Perspektīva",
    riskFactors: "Riska faktori",
    aiDisclaimer: "MI ģenerēta atruna",
    disclaimerText: "Šis pārskats tika automātiski sagatavots ar mākslīgā intelekta (GPT-4o) palīdzību, pamatojoties uz augšupielādēto dokumentu. Lai gan ir pieliktas pūles precizitātes nodrošināšanai, informācijā var būt kļūdas vai izlaidumi. Šis pārskats nav finanšu konsultācija, ieguldījumu ieteikums vai piedāvājums pirkt vai pārdot vērtspapīrus. Vienmēr pārbaudiet skaitļus sākotnējā dokumentā un pirms ieguldījumu lēmumiem konsultējieties ar kvalificētu speciālistu.",
  },
  lt: {
    earningsReport: "Rezultatų ataskaita",
    generatedOn: "Sugeneruota",
    automatedReport: "Automatinė finansinės analizės ataskaita",
    executiveSummary: "Santrauka",
    keyMetricsDashboard: "Pagrindiniai finansiniai rodikliai",
    metric: "Rodiklis",
    value: "Vertė",
    trend: "Tendencija",
    yoyChange: "Metinis pokytis",
    name: "Pavadinimas",
    period: "Laikotarpis",
    revenue: "Pajamos",
    ebitda: "EBITDA",
    netProfit: "Grynasis pelnas",
    revenueBySegment: "Pajamos pagal segmentą",
    revenueByGeography: "Pajamos pagal geografiją",
    revenueBreakdown: "Pajamų pasiskirstymas",
    revenueBreakdownChart: "Pajamų pasiskirstymo diagrama",
    revenueDonutChart: "Pajamų žiedinė diagrama",
    profitabilityTrends: "Pelningumo tendencijos",
    profitabilityTrendsChart: "Pelningumo tendencijų diagrama",
    businessHighlights: "Verslo ir segmentų apžvalga",
    sentimentAnalysis: "Tono analizė",
    managementTone: "Vadovybės tonas",
    outlook: "Perspektyva",
    riskFactors: "Rizikos veiksniai",
    aiDisclaimer: "DI sugeneruotas atsakomybės apribojimas",
    disclaimerText: "Ši ataskaita buvo automatiškai parengta naudojant dirbtinį intelektą (GPT-4o), remiantis įkeltu dokumentu. Nors buvo stengtasi užtikrinti tikslumą, informacijoje gali būti klaidų ar praleidimų. Ši ataskaita nėra finansinė konsultacija, investavimo rekomendacija ar pasiūlymas pirkti arba parduoti vertybinius popierius. Visada patikrinkite skaičius pradiniame dokumente ir prieš priimdami investicinius sprendimus pasitarkite su kvalifikuotu specialistu.",
  },
};

export function buildHtml(data: ExtractedData, charts: ChartImages): string {
  const labels = LABELS[data.metadata.outputLanguage ?? "en"];
  const companyName = data.metadata.companyName || "Company Report";
  const reportPeriod = data.metadata.reportPeriod || "";
  const title = [companyName, reportPeriod].filter(Boolean).join(" — ");

  const sections: string[] = [];

  // YoY change helper
  function yoyBadge(change: number | null | undefined): string {
    if (change == null) return "";
    const cls = change >= 0 ? "yoy-up" : "yoy-down";
    const arrow = change >= 0 ? "▲" : "▼";
    return `<span class="yoy-badge ${cls}">${arrow} ${Math.abs(change).toFixed(1)}% YoY</span>`;
  }

  // Executive Summary (from narratives)
  const execSummary = data.narratives.find(
    (n) => n.section === "executive_summary",
  );
  const mgmtCommentary = data.narratives.find(
    (n) => n.section === "management_commentary",
  );
  if (execSummary || mgmtCommentary) {
    const text = (execSummary?.text ?? "") + (mgmtCommentary?.text ?? "");
    sections.push(`
      <section id="executive-summary">
        <h2>${escapeHtml(labels.executiveSummary)}</h2>
        ${text
          .split("\n")
          .filter((p) => p.trim())
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("\n")}
      </section>`);
  }

  // Key Metrics Dashboard
  if (data.metrics.length > 0) {
    const sparklineAvailable = charts.sparklines.size > 0;
    const headerCols = sparklineAvailable
      ? `<th>${escapeHtml(labels.metric)}</th><th>${escapeHtml(labels.value)}</th><th>${escapeHtml(labels.trend)}</th><th>${escapeHtml(labels.yoyChange)}</th>`
      : `<th>${escapeHtml(labels.metric)}</th><th>${escapeHtml(labels.value)}</th>`;

    const metricRows = data.metrics
      .map((m) => {
        const sparkline = charts.sparklines.get(m.label);
        const yoy = charts.yoyChanges.get(m.label);
        if (sparklineAvailable) {
          return `
            <tr>
              <td class="label">${escapeHtml(m.label)}</td>
              <td class="value">${escapeHtml(formatMetricValue(m))}</td>
              <td class="sparkline-cell">${sparkline ? `<img src="${sparkline}" alt="sparkline" class="sparkline" />` : "—"}</td>
              <td class="yoy-cell">${yoyBadge(yoy)}</td>
            </tr>`;
        }
        return formatMetricRow(m);
      })
      .join("\n");

    sections.push(`
      <section id="metrics-dashboard">
        <h2>${escapeHtml(labels.keyMetricsDashboard)}</h2>
        <table>
          <thead>
            <tr>${headerCols}</tr>
          </thead>
          <tbody>
            ${metricRows}
          </tbody>
        </table>
      </section>`);
  }

  // Revenue Breakdown — charts + data table fallback
  const bySegment = data.revenueBreakdown?.bySegment ?? [];
  const byGeography = data.revenueBreakdown?.byGeography ?? [];
  const hasRevenueData = bySegment.length > 0 || byGeography.length > 0;
  const hasRevenueChart = charts.revenueBarChart || charts.revenueDonutChart;
  if (hasRevenueChart || hasRevenueData) {
    const chartTitle = bySegment.length > 0
        ? labels.revenueBySegment
        : byGeography.length > 0
          ? labels.revenueByGeography
          : labels.revenueBreakdown;
    const segmentRows = bySegment
      .map((item) => `
            <tr>
              <td class="label">${escapeHtml(item.name)}</td>
              <td class="value">${escapeHtml(formatNumericValue(item.value))}</td>
            </tr>`)
      .join("\n");
    const geographyRows = byGeography
      .map((item) => `
            <tr>
              <td class="label">${escapeHtml(item.name)}</td>
              <td class="value">${escapeHtml(formatNumericValue(item.value))}</td>
            </tr>`)
      .join("\n");
    sections.push(`
      <section id="revenue-breakdown">
        <h2>${escapeHtml(chartTitle)}</h2>
        ${hasRevenueChart ? `<div class="chart-row">
          ${charts.revenueBarChart ? `<div class="chart-container"><img src="${charts.revenueBarChart}" alt="${escapeHtml(labels.revenueBreakdownChart)}" /></div>` : ""}
          ${charts.revenueDonutChart ? `<div class="chart-container"><img src="${charts.revenueDonutChart}" alt="${escapeHtml(labels.revenueDonutChart)}" /></div>` : ""}
        </div>` : ""}
        ${segmentRows ? `
        <table>
          <thead>
            <tr><th>${escapeHtml(labels.name)}</th><th>${escapeHtml(labels.value)}</th></tr>
          </thead>
          <tbody>
            ${segmentRows}
          </tbody>
        </table>` : ""}
        ${geographyRows ? `
        <table>
          <thead>
            <tr><th>${escapeHtml(labels.name)}</th><th>${escapeHtml(labels.value)}</th></tr>
          </thead>
          <tbody>
            ${geographyRows}
          </tbody>
        </table>` : ""}
      </section>`);
  }

  // Profitability Trends — chart + data table fallback
  const trends = data.profitabilityTrends;
  const hasTrendData = !!trends && trends.periods.length > 0;
  if (charts.profitabilityChart || hasTrendData) {
    const trendRows = hasTrendData
      ? trends.periods
          .map((period, idx) => `
            <tr>
              <td class="label">${escapeHtml(period)}</td>
              <td class="value">${escapeHtml(formatNumericValue(trends.revenue?.[idx]))}</td>
              <td class="value">${escapeHtml(formatNumericValue(trends.ebitda?.[idx]))}</td>
              <td class="value">${escapeHtml(formatNumericValue(trends.netProfit?.[idx]))}</td>
            </tr>`)
          .join("\n")
      : "";
    sections.push(`
      <section id="profitability-trends">
        <h2>${escapeHtml(labels.profitabilityTrends)}</h2>
        ${charts.profitabilityChart ? `<div class="chart-container chart-full">
          <img src="${charts.profitabilityChart}" alt="${escapeHtml(labels.profitabilityTrendsChart)}" />
        </div>` : ""}
        ${trendRows ? `
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(labels.period)}</th>
              <th>${escapeHtml(labels.revenue)}</th>
              <th>${escapeHtml(labels.ebitda)}</th>
              <th>${escapeHtml(labels.netProfit)}</th>
            </tr>
          </thead>
          <tbody>
            ${trendRows}
          </tbody>
        </table>` : ""}
      </section>`);
  }

  // Balance Sheet Highlights (from narratives)
  const businessOverview = data.narratives.find(
    (n) => n.section === "business_overview",
  );
  const segmentPerf = data.narratives.find(
    (n) => n.section === "segment_performance",
  );
  if (businessOverview || segmentPerf) {
    const text = (businessOverview?.text ?? "") + (segmentPerf?.text ?? "");
    sections.push(`
      <section id="business-highlights">
        <h2>${escapeHtml(labels.businessHighlights)}</h2>
        ${text
          .split("\n")
          .filter((p) => p.trim())
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("\n")}
      </section>`);
  }

  // Sentiment Analysis
  const sentiment = data.sentiment;
  const hasSentiment =
    sentiment?.managementTone ||
    sentiment?.outlook ||
    (sentiment?.riskFactors && sentiment.riskFactors.length > 0);
  if (hasSentiment) {
    const riskItems =
      sentiment.riskFactors.length > 0
        ? `<ul>${sentiment.riskFactors.map((r) => `<li>${escapeHtml(r)}</li>`).join("\n")}</ul>`
        : "";
    sections.push(`
      <section id="sentiment-analysis">
        <h2>${escapeHtml(labels.sentimentAnalysis)}</h2>
        ${
          sentiment.managementTone
            ? `<p><strong>${escapeHtml(labels.managementTone)}:</strong> <span class="tone tone-${sentiment.managementTone.replace(/\s+/g, "-")}">${escapeHtml(sentiment.managementTone)}</span></p>`
            : ""
        }
        ${sentiment.outlook ? `<p><strong>${escapeHtml(labels.outlook)}:</strong> ${escapeHtml(sentiment.outlook)}</p>` : ""}
        ${
          sentiment.riskFactors.length > 0
            ? `<p><strong>${escapeHtml(labels.riskFactors)}:</strong></p>${riskItems}`
            : ""
        }
      </section>`);
  }

  // Outlook narrative
  const outlookNarrative = data.narratives.find(
    (n) => n.section === "outlook",
  );
  if (outlookNarrative) {
    sections.push(`
      <section id="outlook">
        <h2>${escapeHtml(labels.outlook)}</h2>
        ${outlookNarrative.text
          .split("\n")
          .filter((p) => p.trim())
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("\n")}
      </section>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm 2.2cm 2.5cm 2.2cm;

      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #999;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      }
    }

    /* Hide page number on cover */
    @page cover {
      @bottom-center {
        content: none;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.6;
      font-variant-ligatures: none;
      -webkit-font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "clig" 0;
    }

    /* Cover page */
    .cover {
      page: cover;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
    }
    .cover h1 {
      font-size: 28pt;
      color: #2b79db;
      margin-bottom: 12pt;
    }
    .cover .subtitle {
      font-size: 16pt;
      color: #666;
      margin-bottom: 24pt;
    }
    .cover .date {
      font-size: 10pt;
      color: #999;
    }
    .cover .generated-date {
      margin-top: 48pt;
      padding-top: 16pt;
      border-top: 1px solid #e0e0e0;
      font-size: 9pt;
      color: #aaa;
    }

    /* Sections */
    section {
      page-break-inside: avoid;
      margin-bottom: 24pt;
    }
    h2 {
      font-size: 16pt;
      color: #2b79db;
      border-bottom: 2px solid #2b79db;
      padding-bottom: 6pt;
      margin-bottom: 12pt;
    }
    p {
      margin-bottom: 8pt;
    }

    /* Metrics table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
    }
    th, td {
      text-align: left;
      padding: 8pt 10pt;
      border-bottom: 1px solid #e5e5e5;
    }
    th {
      font-weight: 700;
      color: #2b79db;
      background: #f5f7fa;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }
    td.label {
      font-weight: 500;
    }
    td.value {
      font-family: "Courier New", Courier, monospace;
      text-align: right;
      font-weight: 600;
    }

    /* Sentiment tones */
    .tone { text-transform: capitalize; font-weight: 600; }
    .tone-very-positive, .tone-positive { color: #1a7a2e; }
    .tone-neutral { color: #666; }
    .tone-cautious, .tone-negative { color: #c0392b; }

    ul {
      margin: 4pt 0 8pt 20pt;
    }
    li {
      margin-bottom: 4pt;
    }

    /* Disclaimer footer */
    .disclaimer {
      margin-top: 32pt;
      padding-top: 12pt;
      border-top: 1px solid #e0e0e0;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }
    .disclaimer p {
      margin-bottom: 2pt;
    }

    /* Charts */
    .chart-row {
      display: flex;
      gap: 16pt;
      justify-content: center;
    }
    .chart-container {
      text-align: center;
      margin-bottom: 12pt;
    }
    .chart-container img {
      max-width: 100%;
      height: auto;
    }
    .chart-full img {
      max-width: 100%;
      height: auto;
    }

    /* Sparklines */
    .sparkline-cell {
      text-align: center;
      vertical-align: middle;
    }
    img.sparkline {
      width: 120pt;
      height: 22pt;
      vertical-align: middle;
    }

    /* YoY badges */
    .yoy-cell {
      text-align: right;
      white-space: nowrap;
    }
    .yoy-badge {
      font-size: 9pt;
      font-weight: 600;
      padding: 2pt 6pt;
      border-radius: 3pt;
    }
    .yoy-up {
      color: #1a7a2e;
      background: #e8f5e9;
    }
    .yoy-down {
      color: #c0392b;
      background: #fdecea;
    }
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    ${process.env.BEI_BRAND_LOGO_URL ? `<img src="${escapeHtml(process.env.BEI_BRAND_LOGO_URL)}" alt="DealSpacer" style="max-width:120pt; max-height:40pt; margin-bottom:16pt; object-fit:contain;" />` : ""}
    <h1>${escapeHtml(companyName)}</h1>
    <div class="subtitle">${escapeHtml(labels.earningsReport)} — ${escapeHtml(reportPeriod)}</div>
    <div class="date">${escapeHtml(labels.generatedOn)} ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    <div class="generated-date">
      <p>DealSpacer</p>
      <p>${escapeHtml(labels.automatedReport)}</p>
    </div>
  </div>

  ${sections.join("\n")}

  <!-- Disclaimer -->
  <div class="disclaimer">
    <p><strong>${escapeHtml(labels.aiDisclaimer)}:</strong> ${escapeHtml(labels.disclaimerText)}</p>
    <p>Baltic Earnings Intelligence — ${new Date().toISOString().split("T")[0]}</p>
  </div>
</body>
</html>`;
}

// ── HTML escaping ───────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── PDF rendering ───────────────────────────────────────────────────────────

let browser: Browser | null = null;
let browserIsRemote = false;

async function connectToRemoteBrowserIfConfigured(): Promise<Browser | null> {
  const browserWSEndpoint = process.env.PUPPETEER_BROWSER_WS_ENDPOINT;
  const browserURL = process.env.PUPPETEER_BROWSER_URL;

  if (browserWSEndpoint) {
    browserIsRemote = true;
    return puppeteer.connect({ browserWSEndpoint });
  }

  if (browserURL) {
    browserIsRemote = true;
    return puppeteer.connect({ browserURL });
  }

  return null;
}

function buildLaunchOptions(): LaunchOptions[] {
  const baseArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  const debugLaunch = process.env.PUPPETEER_DEBUG === "1";
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  if (executablePath) {
    return [{
      executablePath,
      browser: "chrome",
      headless: true,
      args: baseArgs,
      dumpio: debugLaunch,
    }];
  }

  // On newer macOS versions, Chrome for Testing app startup may abort in
  // app-registration path. Prefer installed stable Chrome first there.
  if (process.platform === "darwin") {
    return [
      {
        browser: "chrome",
        channel: "chrome",
        headless: true,
        args: baseArgs,
        dumpio: debugLaunch,
      },
      {
        browser: "chrome",
        headless: true,
        args: baseArgs,
        dumpio: debugLaunch,
      },
      {
        browser: "chrome",
        headless: "shell",
        args: baseArgs,
        dumpio: debugLaunch,
      },
    ];
  }

  return [{
    browser: "chrome",
    headless: true,
    args: baseArgs,
    dumpio: debugLaunch,
  }];
}

async function launchBrowserWithFallback(): Promise<Browser> {
  const connected = await connectToRemoteBrowserIfConfigured();
  if (connected) {
    return connected;
  }

  const attempts = buildLaunchOptions();
  const failures: string[] = [];

  for (const options of attempts) {
    try {
      return await puppeteer.launch(options);
    } catch (error) {
      const launchMode = `channel=${options.channel ?? "bundled"}, headless=${String(options.headless ?? true)}`;
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${launchMode}: ${message}`);
    }
  }

  throw new Error(`Failed to launch browser after ${attempts.length} attempts:\n${failures.join("\n")}`);
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await launchBrowserWithFallback();
  }
  return browser;
}

export async function canLaunchPdfBrowser(): Promise<boolean> {
  let probe: Browser | null = null;
  let probeIsRemote = false;
  try {
    probe = await connectToRemoteBrowserIfConfigured();
    if (probe) {
      probeIsRemote = true;
      return true;
    }
    probe = await launchBrowserWithFallback();
    return true;
  } catch {
    return false;
  } finally {
    if (probe) {
      if (probeIsRemote) {
        await probe.disconnect();
      } else {
        await probe.close();
      }
    }
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    if (browserIsRemote) {
      await browser.disconnect();
    } else {
      await browser.close();
    }
    browser = null;
    browserIsRemote = false;
  }
}

export async function warmBrowser(): Promise<void> {
  if (!browser || !browser.isConnected()) {
    console.log("[assembler] Warming Puppeteer browser...");
    const start = Date.now();
    await getBrowser();
    console.log(`[assembler] Browser warm in ${Date.now() - start}ms`);
  }
}

export async function checkBrowserHealth(): Promise<boolean> {
  if (!browser || !browser.isConnected()) {
    return false;
  }
  try {
    const page = await browser.newPage();
    await page.close();
    return true;
  } catch {
    return false;
  }
}

async function maybeCompressPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const gsPath = process.env.GHOSTSCRIPT_PATH?.trim();
  if (!gsPath) return pdfBuffer;

  const inputPath = path.join(os.tmpdir(), `bei-pdf-in-${Date.now()}.pdf`);
  const outputPath = path.join(os.tmpdir(), `bei-pdf-out-${Date.now()}.pdf`);

  try {
    await fs.writeFile(inputPath, pdfBuffer);

    await new Promise<void>((resolve, reject) => {
      execFile(gsPath, [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const compressed = await fs.readFile(outputPath);
    if (compressed.length > 0 && compressed.length < pdfBuffer.length) {
      console.log(`[assembler] PDF compressed: ${(pdfBuffer.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (${((1 - compressed.length / pdfBuffer.length) * 100).toFixed(0)}% reduction)`);
      return compressed;
    }
    return pdfBuffer;
  } catch (err) {
    console.warn("[assembler] Ghostscript compression failed, using original PDF:", err instanceof Error ? err.message : err);
    return pdfBuffer;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

function getPdfScale(): number {
  const raw = process.env.PUPPETEER_PDF_SCALE;
  if (!raw) return 1.0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2) {
    console.warn(`PUPPETEER_PDF_SCALE must be between 0 and 2. Using default 1.0.`);
    return 1.0;
  }
  return parsed;
}

export async function assemblePdf(data: ExtractedData): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bei-charts-"));
  try {
    const charts = await renderAllCharts(
      data.metrics,
      tempDir,
      data.revenueBreakdown,
      data.profitabilityTrends,
    );
    const html = buildHtml(data, charts);
    const b = await getBrowser();
    const page: Page = await b.newPage();
    try {
      await page.setContent(html, {
        waitUntil: "load",
        timeout: 30000,
      });
      const scale = getPdfScale();
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        scale,
        margin: { top: "2cm", right: "2.2cm", bottom: "2cm", left: "2.2cm" },
      });
      const result = Buffer.from(pdf);
      return maybeCompressPdf(result);
    } finally {
      await page.close();
    }
  } finally {
    // Clean up temp chart files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
