import path from "node:path";
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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
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
const DEFAULT_OCR_PAGE_TIMEOUT_MS = 30000;

function getBatchSize(): number {
  const env = process.env.WORKER_PDF_BATCH_SIZE;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_BATCH_SIZE;
}

function getOcrPageTimeoutMs(): number {
  const env = process.env.OCR_PAGE_TIMEOUT_MS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_OCR_PAGE_TIMEOUT_MS;
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
          const textItems = content.items
            .filter((item): item is typeof item & { str: string } => "str" in item && item.str.trim().length > 0);
          const pageText = textItems
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          const structuredTables = extractStructuredTablesFromPdfItems(textItems, pageNum);
          texts[pageNum - 1] = [pageText, structuredTables].filter(Boolean).join("\n\n");
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

type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
};

interface PositionedCell {
  text: string;
  x: number;
  y: number;
}

const FINANCIAL_TABLE_KEYWORDS = [
  "revenue",
  "sales",
  "ebitda",
  "profit",
  "loss",
  "assets",
  "equity",
  "liabilities",
  "cash",
  "capex",
  "income",
  "expenses",
  "tulu",
  "kasum",
  "varad",
  "omakapital",
  "ieņēmumi",
  "peļņa",
  "aktīvi",
  "pajamos",
  "pelnas",
  "turtas",
];

function hasFinancialTableSignal(rowText: string): boolean {
  const lower = rowText.toLowerCase();
  return FINANCIAL_TABLE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function numericCellCount(cells: string[]): number {
  return cells.filter((cell) => /(?:\d[\d\s.,]*)(?:%|x)?/.test(cell)).length;
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

function formatStructuredTable(rows: string[][], source: string): string {
  const body = rows
    .map((row) => `| ${row.map(escapeTableCell).join(" | ")} |`)
    .join("\n");
  return `[STRUCTURED FINANCIAL TABLE source="${source}"]\n${body}\n[/STRUCTURED FINANCIAL TABLE]`;
}

export function extractStructuredTablesFromPdfItems(items: PdfTextItem[], pageNum: number): string {
  const cells = items
    .map((item): PositionedCell | null => {
      const text = normalizeText(item.str);
      const transform = item.transform;
      if (!text || !Array.isArray(transform) || transform.length < 6) return null;
      return { text, x: Number(transform[4]) || 0, y: Number(transform[5]) || 0 };
    })
    .filter((cell): cell is PositionedCell => cell !== null);

  if (cells.length < 8) return "";

  const rows = new Map<number, PositionedCell[]>();
  for (const cell of cells) {
    const bucket = Math.round(cell.y / 3) * 3;
    rows.set(bucket, [...(rows.get(bucket) ?? []), cell]);
  }

  const tableRows = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, rowCells]) => rowCells
      .sort((a, b) => a.x - b.x)
      .map((cell) => cell.text))
    .filter((row) => row.length >= 3);

  if (tableRows.length < 2) return "";

  const usefulRows = tableRows.filter((row) =>
    hasFinancialTableSignal(row.join(" ")) || numericCellCount(row) >= 2,
  );
  const hasFinancialSignal = tableRows.some((row) => hasFinancialTableSignal(row.join(" ")));
  if (!hasFinancialSignal || usefulRows.length < 2) return "";

  return formatStructuredTable(tableRows.slice(0, 80), `pdf-page-${pageNum}`);
}

async function ocrPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const screenshots = await parser.getScreenshot({ scale: 2, imageBuffer: true, imageDataUrl: false });
    const pages = screenshots?.pages ?? [];
    const pageTexts: (string | null)[] = new Array(pages.length).fill(null);
    const batchSize = getBatchSize();
    const ocrTimeoutMs = getOcrPageTimeoutMs();
    let processedCount = 0;

    for (let start = 0; start < pages.length; start += batchSize) {
      const end = Math.min(start + batchSize, pages.length);
      const batch: Promise<void>[] = [];

      for (let i = start; i < end; i++) {
        const page = pages[i];
        if (!page.data) continue;
        batch.push(
          (async (idx: number) => {
            try {
              const result = await Promise.race([
                recognize(Buffer.from(page.data!), "eng+est+lav+lit"),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("OCR_TIMEOUT")), ocrTimeoutMs),
                ),
              ]);
              if (hasUsableText(result.data.text)) {
                pageTexts[idx] = result.data.text;
              }
            } catch (err) {
              if (err instanceof Error && err.message === "OCR_TIMEOUT") {
                console.warn(`[parser] OCR page ${idx + 1} timed out after ${ocrTimeoutMs}ms, skipping`);
                return;
              }
              throw err;
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
  // Use regex-based tag stripping instead of cheerio DOM parsing.
  // cheerio builds a full DOM tree in memory, which for large XHTML
  // files (65MB+) causes 5-10x memory expansion and OOM crashes.
  // A regex strip uses O(n) memory proportional to string size.
  const html = buffer.toString("utf8");
  const structuredTables = extractStructuredTablesFromHtml(html);

  // Remove script, style, noscript, svg blocks (including their contents)
  const cleaned = html
    .replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style[\s>][\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript[\s>][\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<svg[\s>][\s\S]*?<\/svg\s*>/gi, " ");

  // Strip all remaining HTML/XML tags
  const textOnly = cleaned.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities
  const decoded = decodeHtmlEntities(textOnly);

  const text = normalizeText(decoded);

  // If tag-stripping produced usable text, return it.
  // Otherwise fall back to OCR on any embedded base64 images (e.g. pdf2htmlEX output
  // where every page is a data-URI PNG — no text spans exist at all).
  if (hasUsableText(text)) return [text, structuredTables].filter(Boolean).join("\n\n");
  return ocrHtmlImages(html);
}

export function extractStructuredTablesFromHtml(html: string): string {
  const tables: string[] = [];
  const tableRegex = /<table[\s\S]*?<\/table\s*>/gi;
  let match: RegExpExecArray | null;
  let tableIndex = 0;

  while ((match = tableRegex.exec(html)) !== null) {
    tableIndex++;
    const tableHtml = match[0];
    const rows: string[][] = [];
    const rowRegex = /<tr[\s\S]*?<\/tr\s*>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[0];
      const cells: string[] = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]\s*>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const cellText = normalizeText(decodeHtmlEntities(cellMatch[1].replace(/<[^>]*>/g, " ")));
        if (cellText) cells.push(cellText);
      }
      if (cells.length >= 2) rows.push(cells);
    }

    const hasFinancialSignal = rows.some((row) => hasFinancialTableSignal(row.join(" ")));
    const usefulRows = rows.filter((row) => hasFinancialTableSignal(row.join(" ")) || numericCellCount(row) >= 2);
    if (rows.length >= 2 && hasFinancialSignal && usefulRows.length >= 2) {
      tables.push(formatStructuredTable(rows.slice(0, 80), `html-table-${tableIndex}`));
    }
  }

  return tables.join("\n\n");
}

/**
 * Extract base64-encoded images from HTML src="data:image/…" attributes and
 * run Tesseract OCR on each one.  Mirrors the batched approach used by ocrPdf.
 */
async function ocrHtmlImages(html: string): Promise<string> {
  // Match src="data:image/(png|jpeg);base64,<payload>" — base64 never contains "
  const imageRegex = /src="data:image\/(?:png|jpe?g);base64,([^"]+)"/gi;
  const images: Buffer[] = [];
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(html)) !== null) {
    images.push(Buffer.from(match[1], "base64"));
  }

  if (images.length === 0) {
    throw new Error(NO_FINANCIAL_DATA_MESSAGE);
  }

  console.log(`[parser] HTML has no selectable text; OCR-ing ${images.length} embedded image(s)`);

  const pageTexts: (string | null)[] = new Array(images.length).fill(null);
  const batchSize = getBatchSize();
  const ocrTimeoutMs = getOcrPageTimeoutMs();

  for (let start = 0; start < images.length; start += batchSize) {
    const end = Math.min(start + batchSize, images.length);
    const batch: Promise<void>[] = [];

    for (let i = start; i < end; i++) {
      batch.push(
        (async (idx: number) => {
          try {
            const result = await Promise.race([
              recognize(images[idx], "eng+est+lav+lit"),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("OCR_TIMEOUT")), ocrTimeoutMs),
              ),
            ]);
            if (hasUsableText(result.data.text)) {
              pageTexts[idx] = result.data.text;
            }
          } catch (err) {
            if (err instanceof Error && err.message === "OCR_TIMEOUT") {
              console.warn(`[parser] HTML image OCR page ${idx + 1} timed out after ${ocrTimeoutMs}ms, skipping`);
              return;
            }
            throw err;
          }
        })(i),
      );
    }

    await Promise.all(batch);
    if (images.length > batchSize) {
      const pct = Math.round((end / images.length) * 100);
      console.log(`[parser] HTML image OCR processed ${end}/${images.length} pages (${pct}%)`);
    }
  }

  const text = pageTexts.filter((t): t is string => t !== null).join("\n\n");
  if (!hasUsableText(text)) throw new Error(NO_FINANCIAL_DATA_MESSAGE);
  return text;
}
