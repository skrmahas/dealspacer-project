import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pdfjsLib from "pdfjs-dist";
import puppeteer from "puppeteer";
import { assemblePdf, closeBrowser } from "./assembler.js";
import type { ExtractedData } from "@bei/shared";

const completeFixturePath = resolve(
  import.meta.dirname,
  "__fixtures__",
  "complete-extraction.json",
);
const minimalFixturePath = resolve(
  import.meta.dirname,
  "__fixtures__",
  "minimal-extraction.json",
);

function readFixture(path: string): ExtractedData {
  return JSON.parse(readFileSync(path, "utf-8")) as ExtractedData;
}

async function canLaunchBrowser(): Promise<boolean> {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

const browserAvailable = await canLaunchBrowser();
const browserIt = browserAvailable ? it : it.skip;

if (!browserAvailable) {
  console.warn("Skipping assembler integration tests: Puppeteer browser could not be launched in this environment.");
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;

  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    texts.push(pageText);
  }
  return texts.join("\n");
}

describe("assemblePdf", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  browserIt(
    "generates a PDF with cover page containing company name and report period",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("AS Tallink Grupp");
      expect(text).toContain("Q1 2024");
    },
    30000,
  );

  browserIt(
    "includes Executive Summary section with content",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Executive Summary");
      expect(text).toContain("Tallink Grupp reported strong");
      expect(text).toContain("EUR 210.4 million");
    },
    30000,
  );

  browserIt(
    "includes Key Metrics Dashboard with metrics table",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Key Metrics Dashboard");
      expect(text).toContain("Revenue");
      expect(text).toContain("210,400,000");
      expect(text).toContain("EBITDA");
      expect(text).toContain("48,700,000");
      expect(text).toContain("Net Profit");
      expect(text).toContain("12,300,000");
    },
    30000,
  );

  browserIt(
    "includes Sentiment Analysis section",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Sentiment Analysis");
      expect(text).toContain("Management Tone");
      expect(text).toContain("positive");
      expect(text).toContain("Fuel price volatility");
      expect(text).toContain("Geopolitical uncertainty");
    },
    30000,
  );

  browserIt(
    "includes AI disclaimer on every report",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("AI-Generated Disclaimer");
      expect(text).toContain("GPT-4o");
    },
    30000,
  );

  browserIt(
    "omits Executive Summary when no narratives present",
    async () => {
      const data = readFixture(minimalFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).not.toContain("Executive Summary");
    },
    30000,
  );

  browserIt(
    "omits Sentiment Analysis when sentiment is empty",
    async () => {
      const data = readFixture(minimalFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).not.toContain("Sentiment Analysis");
    },
    30000,
  );

  browserIt(
    "still includes metrics and disclaimer with minimal data",
    async () => {
      const data = readFixture(minimalFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Small Company");
      expect(text).toContain("Key Metrics Dashboard");
      expect(text).toContain("Revenue");
      expect(text).toContain("500,000");
      expect(text).toContain("AI-Generated Disclaimer");
    },
    30000,
  );

  browserIt(
    "includes Revenue Breakdown section with charts",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Revenue by Segment");
    },
    30000,
  );

  browserIt(
    "includes Profitability Trends section",
    async () => {
      const data = readFixture(completeFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).toContain("Profitability Trends");
    },
    30000,
  );

  browserIt(
    "omits Revenue Breakdown when revenueBreakdown data missing",
    async () => {
      const data = readFixture(minimalFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).not.toContain("Revenue by Segment");
      expect(text).not.toContain("Revenue by Geography");
    },
    30000,
  );

  browserIt(
    "omits Profitability Trends when trend data is insufficient",
    async () => {
      const data = readFixture(minimalFixturePath);
      const pdf = await assemblePdf(data);
      const text = await extractPdfText(pdf);

      expect(text).not.toContain("Profitability Trends");
    },
    30000,
  );
});
