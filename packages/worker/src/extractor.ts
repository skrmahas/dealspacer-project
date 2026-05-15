import OpenAI from "openai";
import type { ExtractedData, ExtractedMetric, ExtractedNarrative, RevenueBreakdown, ProfitabilityTrends } from "@bei/shared";
import { deduplicateMetrics, normalizeLabel } from "./deduplicator.js";

const SYSTEM_PROMPT = `You are a financial document extraction specialist focused on Baltic company financial and business documents.

Extract the following from the provided document text into a JSON object. Follow these rules strictly:

1. metadata: { companyName, reportPeriod, sourceLanguage }
   - companyName: the legal entity name as it appears in the document
   - reportPeriod: e.g. "Q1 2024", "FY 2023", "2026-2029" for a multi-year plan, or "2024-03-31"
   - sourceLanguage: one of "et", "lv", "lt", or "en"

2. metrics: an array of { label, value, unit?, period? }
   - Extract ALL financial figures: revenue, EBITDA, net profit, operating profit, investment (CAPEX), assets, equity, liabilities, cash flow, EPS, dividends, financial targets, projections, budget figures, etc.
   - Include both historical results AND forward-looking targets/projections. Mark targets with period like "2026 target", "2029 plan".
   - value must be a number (use null if value is mentioned but unclear)
   - unit should be the stated unit (e.g. "EUR", "EUR m", "EUR bn", "thousand EUR")
   - period can be omitted if the metric applies to the full report period

3. narratives: an array of { section, text }
   - section: "executive_summary", "management_commentary", "business_overview", "segment_performance", "strategic_priorities", or "outlook"
   - text: 2-4 paragraphs per section, summarized and translated to English if the source is not English
   - Include sections even for strategy documents, annual reports, and investor presentations
   - Only include sections that have meaningful content in the document

4. sentiment: { managementTone, outlook, riskFactors }
   - managementTone: one of "very positive", "positive", "neutral", "cautious", "negative"
   - outlook: a 1-2 sentence summary of forward-looking statements, translated to English
   - riskFactors: array of strings, each a concise risk factor mentioned

5. revenueBreakdown: { bySegment?, byGeography? }
   - bySegment: array of { name, value } — revenue broken down by business segment
   - byGeography: array of { name, value } — revenue broken down by geography
   - values should sum approximately to total revenue
   - Omit this section entirely if no breakdown is found

6. profitabilityTrends: { periods, revenue?, ebitda?, netProfit? }
   - periods: array of period labels
   - revenue/ebitda/netProfit: arrays of numbers (or null if not reported for a period), same length as periods
   - Extract multi-period data from comparative tables, prior-year comparisons, OR multi-year plan projections
   - For strategic plans, extract target years as periods (e.g. "2026", "2027", "2028", "2029")
   - Omit fields whose data is not available; omit section entirely if less than 2 periods found

IMPORTANT:
- Translate all text to English
- DO NOT fabricate numbers. If a figure is not clearly present, do not include it.
- This document may be an annual report, quarterly filing, strategic plan, investor presentation, or other business financial document. Extract whatever financial data IS present.
- If genuine financial or strategic content is found, populate the appropriate sections. Only return completely empty arrays/sections if the document truly contains no business or financial content (e.g., a legal contract, a press release about a non-financial topic).

BALTIC CONTEXT:
- Baltic company names often include legal forms: AS, OU, OÜ, SIA, UAB, AB. The companyName should include the legal form as presented.
- Baltic annual reports may contain local-language section headers such as "Tegevusaruanne" (ET: management report), "Vadibas zinojums" (LV: management report), "Vadovybes ataskaita" (LT: management report), "Finantsaruanded" (ET: financial statements), "Pelno (nuostoliu) ataskaita" (LT: income statement).
- Currency is typically EUR (euros). Historical documents may reference EEK (Estonian kroon, pre-2011), LVL (Latvian lats, pre-2014), or LTL (Lithuanian litas, pre-2015). Convert or note historical currencies as appropriate.
- Nasdaq Baltic (Nasdaq Tallinn, Nasdaq Riga, Nasdaq Vilnius) listed companies file in a specific format following exchange disclosure requirements.
- Baltic strategic plans and investor presentations often contain multi-year projections (typically 3-5 year horizons) with specific target metrics.
- Output ONLY the JSON object, no markdown fences, no explanation.`;

const DEFAULT_CHUNK_THRESHOLD = 60000;
const DEFAULT_CHUNK_SIZE = 80000;  // ~20k tokens at 4 chars/token, well within GPT-4o 128k context
const DEFAULT_CHUNK_OVERLAP = 3000;
const DEFAULT_MAX_CONCURRENCY = 1;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30000;
const DEFAULT_CHUNK_TOKENS = 15000;

export type OpenAIClient = Pick<OpenAI, "chat">;

let client: OpenAIClient | null = null;

function getModel(): string {
  return (process.env.OPENAI_MODEL?.trim() || "gpt-4o");
}

function getClient(): OpenAIClient {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is required");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function setClient(c: OpenAIClient): void {
  client = c;
}

// ── Chunking ────────────────────────────────────────────────────────────────

interface ChunkConfig {
  threshold: number;
  chunkSize: number;
  overlap: number;
  maxConcurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  chunkTokens: number;
}

function getChunkConfig(): ChunkConfig {
  const threshold = readPositiveEnv("EXTRACTION_CHUNK_THRESHOLD", DEFAULT_CHUNK_THRESHOLD);
  const chunkSize = readPositiveEnv("EXTRACTION_CHUNK_SIZE", DEFAULT_CHUNK_SIZE);
  const overlap = readPositiveEnv("EXTRACTION_CHUNK_OVERLAP", DEFAULT_CHUNK_OVERLAP);
  const maxConcurrency = readPositiveEnv("EXTRACTION_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY);
  const maxRetries = readNonNegativeEnv("EXTRACTION_MAX_RETRIES", DEFAULT_MAX_RETRIES);
  const retryBaseDelayMs = readPositiveEnv("RETRY_BASE_DELAY_MS", DEFAULT_RETRY_BASE_DELAY_MS);
  const retryMaxDelayMs = readPositiveEnv("RETRY_MAX_DELAY_MS", DEFAULT_RETRY_MAX_DELAY_MS);
  const chunkTokens = readPositiveEnv("EXTRACTION_CHUNK_TOKENS", DEFAULT_CHUNK_TOKENS);

  // Token-aware sizing: ~4 chars per token for English financial text.
  // EXTRACTION_CHUNK_TOKENS sets a token budget; effective size is capped by EXTRACTION_CHUNK_SIZE.
  const charsPerToken = 4;
  const tokenBasedSize = chunkTokens * charsPerToken;
  const effectiveChunkSize = chunkTokens !== DEFAULT_CHUNK_TOKENS
    ? Math.min(tokenBasedSize, chunkSize)  // user set a token target — respect it, capped by chunkSize
    : chunkSize;  // default: use legacy chunkSize

  // Ensure overlap < chunkSize
  const effectiveOverlap = Math.min(overlap, Math.floor(chunkSize * 0.2));

  return { threshold, chunkSize: effectiveChunkSize, overlap: effectiveOverlap, maxConcurrency, maxRetries, retryBaseDelayMs, retryMaxDelayMs, chunkTokens };
}

function readPositiveEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** Like readPositiveEnv but accepts 0 (useful for "no retries" / "no limit" configs). */
function readNonNegativeEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}

// ── Single extraction call ───────────────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network/timeout errors
    if (msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("econnreset") ||
        msg.includes("enetunreach") || msg.includes("etimedout") || msg.includes("fetch failed")) {
      return true;
    }
  }

  // Check for OpenAI APIError with status code (the SDK attaches status to the error object)
  const err = error as Record<string, unknown>;
  if (typeof err.status === "number") {
    const status = err.status as number;
    // 429 Too Many Requests, 5xx Server Errors
    return status === 429 || (status >= 500 && status < 600);
  }

  return false;
}

function getRetryDelay(attempt: number, baseMs: number, maxMs: number): number {
  // Exponential backoff with jitter: base * 2^attempt, capped at max, ±25% jitter
  const base = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = base * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.round(base + jitter);
}

async function callExtract(text: string, openai: OpenAIClient): Promise<ExtractedData> {
  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Extract financial data from this document:\n\n${text}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("GPT-4o returned empty response");

  return JSON.parse(content) as ExtractedData;
}

async function callExtractWithRetry(
  text: string,
  openai: OpenAIClient,
  maxRetries: number,
  chunkLabel?: string,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
): Promise<ExtractedData> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callExtract(text, openai);
      if (attempt > 0 && chunkLabel) {
        console.log(`[extractor] ${chunkLabel}: succeeded on attempt ${attempt + 1}/${maxRetries + 1}`);
      }
      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = getRetryDelay(attempt, retryBaseDelayMs, retryMaxDelayMs);
        const label = chunkLabel || "extraction";
        const reason = error instanceof Error ? error.message.slice(0, 80) : String(error).slice(0, 80);
        console.log(`[extractor] ${label}: attempt ${attempt + 1}/${maxRetries + 1} failed (${reason}), retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable or out of attempts — throw
      break;
    }
  }

  throw lastError;
}

// ── Result merging ───────────────────────────────────────────────────────────

function mergeExtractions(results: ExtractedData[]): ExtractedData {
  if (results.length === 0) {
    return {
      metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
      metrics: [],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };
  }

  if (results.length === 1) return results[0];

  // Metadata: use first non-empty
  const metadata = results.reduce((best, r) => {
    if (!best.companyName && r.metadata.companyName) return r.metadata;
    return best;
  }, results[0].metadata);

  // Metrics: collect all, deduplicate by label
  const allMetrics: ExtractedMetric[] = [];
  for (const r of results) {
    allMetrics.push(...r.metrics);
  }
  const metrics = deduplicateMetrics(allMetrics);

  // Narratives: concatenate text per section
  const narrativeMap = new Map<string, string>();
  for (const r of results) {
    for (const n of r.narratives) {
      const existing = narrativeMap.get(n.section);
      if (existing) {
        // Append only if the new text adds unique content
        narrativeMap.set(n.section, existing + "\n" + n.text);
      } else {
        narrativeMap.set(n.section, n.text);
      }
    }
  }
  const narratives: ExtractedNarrative[] = Array.from(narrativeMap.entries()).map(
    ([section, text]) => ({ section, text }),
  );

  // Sentiment: use the most confident (non-empty tone)
  const sentiment = results.reduce((best, r) => {
    if (!best.managementTone && r.sentiment.managementTone) return r.sentiment;
    if (!best.outlook && r.sentiment.outlook) {
      return { ...best, outlook: r.sentiment.outlook };
    }
    return best;
  }, results[0].sentiment);

  // Merge risk factors, deduplicating
  const riskSet = new Set<string>();
  for (const r of results) {
    for (const rf of r.sentiment.riskFactors) {
      riskSet.add(rf);
    }
  }
  sentiment.riskFactors = Array.from(riskSet);

  // Revenue breakdown: merge segments/geography, deduplicating by name
  const revenueBreakdown: RevenueBreakdown = {};
  const segmentMap = new Map<string, number>();
  const geoMap = new Map<string, number>();

  for (const r of results) {
    for (const seg of r.revenueBreakdown?.bySegment ?? []) {
      const norm = normalizeLabel(seg.name);
      if (!segmentMap.has(norm)) {
        segmentMap.set(norm, seg.value);
      }
    }
    for (const geo of r.revenueBreakdown?.byGeography ?? []) {
      const norm = normalizeLabel(geo.name);
      if (!geoMap.has(norm)) {
        geoMap.set(norm, geo.value);
      }
    }
  }

  if (segmentMap.size > 0) {
    revenueBreakdown.bySegment = Array.from(segmentMap.entries()).map(([name, value]) => ({ name, value }));
  }
  if (geoMap.size > 0) {
    revenueBreakdown.byGeography = Array.from(geoMap.entries()).map(([name, value]) => ({ name, value }));
  }

  // Profitability trends: merge by period, deduplicating
  const periodSet = new Set<string>();
  const revenueByPeriod = new Map<string, number | null>();
  const ebitdaByPeriod = new Map<string, number | null>();
  const netProfitByPeriod = new Map<string, number | null>();

  for (const r of results) {
    const trends = r.profitabilityTrends;
    if (!trends || !trends.periods) continue;

    for (let i = 0; i < trends.periods.length; i++) {
      const period = trends.periods[i];
      if (periodSet.has(period)) continue;
      periodSet.add(period);

      if (trends.revenue && trends.revenue[i] != null) {
        revenueByPeriod.set(period, trends.revenue[i]);
      }
      if (trends.ebitda && trends.ebitda[i] != null) {
        ebitdaByPeriod.set(period, trends.ebitda[i]);
      }
      if (trends.netProfit && trends.netProfit[i] != null) {
        netProfitByPeriod.set(period, trends.netProfit[i]);
      }
    }
  }

  const periods = Array.from(periodSet);
  const profitabilityTrends: ProfitabilityTrends = { periods };

  if (revenueByPeriod.size > 0) {
    profitabilityTrends.revenue = periods.map((p) => revenueByPeriod.get(p) ?? null);
  }
  if (ebitdaByPeriod.size > 0) {
    profitabilityTrends.ebitda = periods.map((p) => ebitdaByPeriod.get(p) ?? null);
  }
  if (netProfitByPeriod.size > 0) {
    profitabilityTrends.netProfit = periods.map((p) => netProfitByPeriod.get(p) ?? null);
  }

  return { metadata, metrics, narratives, sentiment, revenueBreakdown, profitabilityTrends };
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function extractFromText(
  text: string,
  apiClient?: OpenAIClient,
  partialResults?: ExtractedData[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ExtractedData> {
  const openai = apiClient ?? getClient();
  const config = getChunkConfig();

  // For small documents, use the single-call path unchanged
  if (text.length <= config.threshold) {
    console.log(`[extractor] Single-call extraction (${text.length} chars)`);
    const response = await callExtractWithRetry(text, openai, config.maxRetries, undefined, config.retryBaseDelayMs, config.retryMaxDelayMs);
    console.log(`[extractor] GPT-4o response: ${JSON.stringify(response).slice(0, 300)}...`);
    logExtractionResult(response);
    return response;
  }

  // Large document: chunk and parallelize
  const chunks = chunkText(text, config.chunkSize, config.overlap);
  console.log(`[extractor] Chunked extraction: ${chunks.length} chunks (${text.length} chars total)`);
  console.log(`[extractor] Extraction config: threshold=${config.threshold}, chunkSize=${config.chunkSize}, overlap=${config.overlap}, concurrency=${config.maxConcurrency}, retries=${config.maxRetries}`);
  const extractionStart = Date.now();

  // Process chunks in parallel with concurrency limit
  // Use partial results for already-completed chunks (resume after failure)
  const results: ExtractedData[] = partialResults && partialResults.length === chunks.length
    ? [...partialResults]
    : new Array(chunks.length);
  let completedCount = results.filter((r) => r != null).length;

  if (completedCount > 0) {
    console.log(`[extractor] Resuming from ${completedCount}/${chunks.length} previously completed chunks`);
  }

  async function processChunk(index: number): Promise<void> {
    // Skip already-completed chunks (from partial resume)
    if (results[index] != null) return;

    const chunk = chunks[index];
    const label = `Chunk ${index + 1}/${chunks.length}`;
    try {
      const result = await callExtractWithRetry(chunk, openai, config.maxRetries, label, config.retryBaseDelayMs, config.retryMaxDelayMs);
      results[index] = result;
      completedCount++;
      console.log(
        `[extractor] ${label}: extracted ${result.metrics.length} metrics, ${result.narratives.length} narratives`,
      );
    } catch (error) {
      console.error(`[extractor] ${label} failed after retries:`, error instanceof Error ? error.message : error);
      // Use empty result for failed chunk so merging still works
      results[index] = {
        metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
        metrics: [],
        narratives: [],
        sentiment: { managementTone: "", outlook: "", riskFactors: [] },
      };
      completedCount++;
    }

    onProgress?.(completedCount, chunks.length);
  }

  // Process with concurrency limit using a simple semaphore
  const queue = chunks.map((_, i) => i);
  const workers: Promise<void>[] = [];

  for (let w = 0; w < Math.min(config.maxConcurrency, queue.length); w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const index = queue.shift()!;
          await processChunk(index);
        }
      })(),
    );
  }

  await Promise.all(workers);

  const extractionMs = Date.now() - extractionStart;
  console.log(`[extractor] All ${chunks.length} chunks completed in ${extractionMs}ms (${(text.length / extractionMs * 1000 / 1024).toFixed(1)} KB/s)`);
  console.log(`[extractor] Merging ${results.length} chunk results...`);
  const merged = mergeExtractions(results);
  logExtractionResult(merged);
  return merged;
}

function logExtractionResult(data: ExtractedData): void {
  console.log(
    `[extractor] Parsed: ${data.metrics.length} metrics, ${data.narratives.length} narratives, company: ${data.metadata.companyName}`,
  );
}
