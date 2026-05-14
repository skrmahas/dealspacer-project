import puppeteer, { Browser, Page } from "puppeteer";
import type { ExtractedData, ExtractedMetric } from "@bei/shared";

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

function buildHtml(data: ExtractedData): string {
  const companyName = data.metadata.companyName || "Company Report";
  const reportPeriod = data.metadata.reportPeriod || "";
  const title = [companyName, reportPeriod].filter(Boolean).join(" — ");

  const sections: string[] = [];

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
        <h2>Executive Summary</h2>
        ${text
          .split("\n")
          .filter((p) => p.trim())
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("\n")}
      </section>`);
  }

  // Key Metrics Dashboard
  if (data.metrics.length > 0) {
    sections.push(`
      <section id="metrics-dashboard">
        <h2>Key Metrics Dashboard</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.metrics.map(formatMetricRow).join("\n")}
          </tbody>
        </table>
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
        <h2>Business &amp; Segment Highlights</h2>
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
        <h2>Sentiment Analysis</h2>
        ${
          sentiment.managementTone
            ? `<p><strong>Management Tone:</strong> <span class="tone tone-${sentiment.managementTone.replace(/\s+/g, "-")}">${escapeHtml(sentiment.managementTone)}</span></p>`
            : ""
        }
        ${sentiment.outlook ? `<p><strong>Outlook:</strong> ${escapeHtml(sentiment.outlook)}</p>` : ""}
        ${
          sentiment.riskFactors.length > 0
            ? `<p><strong>Risk Factors:</strong></p>${riskItems}`
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
        <h2>Outlook</h2>
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
      margin: 2cm 2.2cm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.6;
    }

    /* Cover page */
    .cover {
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
      color: #003366;
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
      color: #003366;
      border-bottom: 2px solid #003366;
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
      color: #003366;
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
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    <h1>${escapeHtml(companyName)}</h1>
    <div class="subtitle">Earnings Report — ${escapeHtml(reportPeriod)}</div>
    <div class="date">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    <div class="generated-date">
      <p>Baltic Earnings Intelligence</p>
      <p>Automated Financial Analysis Report</p>
    </div>
  </div>

  ${sections.join("\n")}

  <!-- Disclaimer -->
  <div class="disclaimer">
    <p><strong>AI-Generated Disclaimer:</strong> This report was automatically produced using artificial intelligence (GPT-4o) based on the uploaded document. While every effort has been made to ensure accuracy, the information may contain errors or omissions. This report does not constitute financial advice, investment recommendation, or an offer to buy or sell any security. Always verify figures against the original source document and consult a qualified financial professional before making investment decisions.</p>
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

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function assemblePdf(data: ExtractedData): Promise<Buffer> {
  const html = buildHtml(data);
  const b = await getBrowser();
  const page: Page = await b.newPage();
  try {
    await page.setContent(html, {
      waitUntil: "load",
      timeout: 30000,
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2.2cm", bottom: "2cm", left: "2.2cm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
