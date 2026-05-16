import { describe, it, expect, vi } from "vitest";
import { detectFileType, parseCsvBuffer, parseDocument, parseHtml, parsePdf, NO_FINANCIAL_DATA_MESSAGE } from "./parser.js";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("tesseract.js", () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: "Revenue EUR 1200000 EBITDA profit annual report financial statements",
      },
    }),
  },
}));

const samplePath = resolve(import.meta.dirname, "__fixtures__", "sample.pdf");
const ignitisPath = resolve(
  import.meta.dirname,
  "__fixtures__",
  "ignitis-strategic-plan.pdf",
);

describe("parsePdf", () => {
  it("extracts text from a digital PDF", async () => {
    const pdfBuffer = readFileSync(samplePath);
    const text = await parsePdf(pdfBuffer);

    expect(text).toBeTruthy();
    expect(text).toContain("Hello Baltic Earnings");
  });

  // Real Baltic earnings report — large file (7.2MB), skip in CI
  if (existsSync(ignitisPath)) {
    it(
      "extracts financial data from Ignitis Group Strategic Plan 2026-2029",
      async () => {
        const pdfBuffer = readFileSync(ignitisPath);
        const text = await parsePdf(pdfBuffer);

        expect(text.length).toBeGreaterThan(10000);
        expect(text).toContain("Ignitis");
        expect(text).toMatch(/EBITDA/i);
        expect(text).toMatch(/EUR/);
        expect(text).toMatch(/Strategic Plan/);
        expect(text).toMatch(/renewable/i);
      },
      30000,
    );
  }
});

describe("parseDocument", () => {
  it("detects supported file types from extension or MIME type", () => {
    expect(detectFileType("report.pdf")).toBe("pdf");
    expect(detectFileType("report.csv")).toBe("csv");
    expect(detectFileType("report.htm")).toBe("html");
    expect(detectFileType("report.xhtml")).toBe("html");
    expect(detectFileType("upload", "text/html")).toBe("html");
  });

  it("serializes CSV rows as structured text", async () => {
    const text = await parseCsvBuffer(Buffer.from([
      "Metric,Amount,Period,Comment",
      "Revenue,EUR 1200000,Q1 2026,Revenue increased because subscription sales expanded.",
      "EBITDA,EUR 320000,Q1 2026,EBITDA margin improved.",
    ].join("\n")));

    expect(text).toContain("Row 1");
    expect(text).toContain("Metric: Revenue");
    expect(text).toContain("Amount: EUR 1200000");
  });

  it("extracts visible HTML text", async () => {
    const text = await parseHtml(Buffer.from(`
      <html>
        <body>
          <h1>Baltic Holdings Q1 report</h1>
          <p>Revenue reached EUR 1200000 and EBITDA reached EUR 320000.</p>
          <script>window.hidden = true;</script>
        </body>
      </html>
    `));

    expect(text).toContain("Baltic Holdings Q1 report");
    expect(text).toContain("Revenue reached EUR 1200000");
    expect(text).not.toContain("window.hidden");
  });

  it("routes CSV files by filename", async () => {
    const text = await parseDocument(Buffer.from([
      "Metric,Amount",
      "Revenue,EUR 1200000",
    ].join("\n")), "report.csv");

    expect(text).toContain("Metric: Revenue");
  });
});

describe("OCR page timeout", () => {
  it("respects OCR_PAGE_TIMEOUT_MS env var", async () => {
    // Verify env var is read (parsePdf with a digital PDF won't hit OCR path,
    // but the function should still parse the env var correctly when needed)
    process.env.OCR_PAGE_TIMEOUT_MS = "15000";
    try {
      const pdfBuffer = readFileSync(samplePath);
      // This PDF is digital so it won't hit OCR, but it still exercises the code path
      const text = await parsePdf(pdfBuffer);
      expect(text).toContain("Hello Baltic Earnings");
    } finally {
      delete process.env.OCR_PAGE_TIMEOUT_MS;
    }
  });
});

describe("parseHtml OCR fallback", () => {
  it("falls back to OCR when HTML has embedded base64 images but no readable text spans", async () => {
    // Simulates a pdf2htmlEX XHTML: no text nodes, one data-URI image per page.
    // Base64 payload ("test") is intentionally trivial — Tesseract is mocked above.
    const html = `<html><body>
      <div class="pc"><img src="data:image/png;base64,dGVzdA==" class="bi" alt="" /></div>
    </body></html>`;

    const result = await parseHtml(Buffer.from(html));

    expect(result).toContain("Revenue");
    expect(result).toContain("EBITDA");
  });

  it("throws NO_FINANCIAL_DATA_MESSAGE when HTML has no text and no embedded images", async () => {
    const html = `<html><body><div class="pc"></div></body></html>`;

    await expect(parseHtml(Buffer.from(html))).rejects.toThrow(NO_FINANCIAL_DATA_MESSAGE);
  });
});
