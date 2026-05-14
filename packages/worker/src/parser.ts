import path from "node:path";
import * as cheerio from "cheerio";
import { parse as parseCsv } from "csv-parse/sync";
import { PDFParse } from "pdf-parse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";
const { recognize } = Tesseract;

const standardFontsDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "node_modules",
  "pdfjs-dist",
  "standard_fonts",
);
const standardFontDataUrl = `${standardFontsDir}${path.sep}`;

export const NO_FINANCIAL_DATA_MESSAGE = "No financial data found in this document";

export type SupportedFileType = "pdf" | "csv" | "html";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hasUsableText(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length < 20) return false;

  const letters = normalized.match(/[A-Za-zÀ-ž]/g)?.length ?? 0;
  const alphaRatio = letters / normalized.length;
  const words = normalized.match(/[A-Za-zÀ-ž]{3,}/g)?.length ?? 0;

  return alphaRatio >= 0.45 && words >= 3;
}

export function detectFileType(filename: string, mimeType?: string): SupportedFileType {
  const extension = path.extname(filename).toLowerCase();
  const mime = mimeType?.toLowerCase() ?? "";

  if (extension === ".pdf" || mime === "application/pdf") return "pdf";
  if (extension === ".csv" || mime === "text/csv" || mime === "application/csv") return "csv";
  if ([".html", ".htm", ".xhtml"].includes(extension) || ["text/html", "application/xhtml+xml"].includes(mime)) return "html";

  throw new Error("Unsupported file type. Upload a PDF, CSV, HTML, or XHTML document.");
}

export async function parseDocument(buffer: Buffer, filename: string, mimeType?: string): Promise<string> {
  const type = detectFileType(filename, mimeType);
  if (type === "pdf") return parsePdf(buffer);
  if (type === "csv") return parseCsvBuffer(buffer);
  return parseHtml(buffer);
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const text = await extractPdfText(buffer);
  if (hasUsableText(text)) return text;

  return ocrPdf(buffer);
}

const DEFAULT_BATCH_SIZE = 8;

function getBatchSize(): number {
  const env = process.env.WORKER_PDF_BATCH_SIZE;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_BATCH_SIZE;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl,
  }).promise;

  const batchSize = getBatchSize();
  const numPages = doc.numPages;
  const texts: string[] = new Array(numPages);
  let processedCount = 0;

  // Process pages in parallel batches
  for (let start = 1; start <= numPages; start += batchSize) {
    const end = Math.min(start + batchSize, numPages + 1);
    const batch: Promise<void>[] = [];

    for (let i = start; i < end; i++) {
      batch.push(
        (async (pageNum: number) => {
          const page = await doc.getPage(pageNum);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          texts[pageNum - 1] = pageText;
          // Release page resources
          page.cleanup();
        })(i),
      );
    }

    await Promise.all(batch);
    processedCount = end - 1;
    if (numPages > batchSize) {
      const pct = Math.round((processedCount / numPages) * 100);
      console.log(`[parser] Processed ${processedCount}/${numPages} pages (${pct}%)`);
    }
  }

  await doc.destroy();
  return texts.join("\n");
}

async function ocrPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const screenshots = await parser.getScreenshot({ scale: 2, imageBuffer: true, imageDataUrl: false });
    const pages = screenshots?.pages ?? [];
    const pageTexts: (string | null)[] = new Array(pages.length).fill(null);
    const batchSize = getBatchSize();
    let processedCount = 0;

    for (let start = 0; start < pages.length; start += batchSize) {
      const end = Math.min(start + batchSize, pages.length);
      const batch: Promise<void>[] = [];

      for (let i = start; i < end; i++) {
        const page = pages[i];
        if (!page.data) continue;
        batch.push(
          (async (idx: number) => {
            const result = await recognize(Buffer.from(page.data!), "eng+est+lav+lit");
            if (hasUsableText(result.data.text)) {
              pageTexts[idx] = result.data.text;
            }
          })(i),
        );
      }

      await Promise.all(batch);
      processedCount = end;
      if (pages.length > batchSize) {
        const pct = Math.round((processedCount / pages.length) * 100);
        console.log(`[parser] OCR processed ${processedCount}/${pages.length} pages (${pct}%)`);
      }
    }

    const text = pageTexts.filter((t): t is string => t !== null).join("\n\n");
    if (!hasUsableText(text)) throw new Error(NO_FINANCIAL_DATA_MESSAGE);
    return text;
  } finally {
    parser.destroy();
  }
}

export async function parseCsvBuffer(buffer: Buffer): Promise<string> {
  const rows = parseCsv(buffer.toString("utf8"), {
    bom: true,
    columns: false,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];

  if (rows.length === 0) return "";

  const [header, ...records] = rows;
  return records.map((record, index) => {
    const fields = record.map((value, columnIndex) => {
      const label = header[columnIndex]?.trim() || `Column ${columnIndex + 1}`;
      return `${label}: ${value}`;
    });
    return `Row ${index + 1}\n${fields.join("\n")}`;
  }).join("\n\n");
}

export async function parseHtml(buffer: Buffer): Promise<string> {
  const $ = cheerio.load(buffer.toString("utf8"));
  $("script, style, noscript, svg").remove();
  return normalizeText($("body").text() || $.root().text());
}
