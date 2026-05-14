import OpenAI from "openai";
import type { ExtractedData } from "@bei/shared";

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
- Output ONLY the JSON object, no markdown fences, no explanation.`;

export type OpenAIClient = Pick<OpenAI, "chat">;

let client: OpenAIClient | null = null;

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

export async function extractFromText(
  text: string,
  apiClient?: OpenAIClient,
): Promise<ExtractedData> {
  const openai = apiClient ?? getClient();

  // Truncate text to avoid context limit issues. GPT-4o has 128k context,
  // but we keep it manageable. 60k chars ≈ 15k tokens, leaves room for output.
  const truncated = text.length > 60000 ? text.slice(0, 60000) : text;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Extract financial data from this document:\n\n${truncated}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("GPT-4o returned empty response");

  console.log(`[extractor] GPT-4o response: ${content.slice(0, 300)}...`);

  try {
    const parsed = JSON.parse(content) as ExtractedData;
    console.log(`[extractor] Parsed: ${parsed.metrics.length} metrics, ${parsed.narratives.length} narratives, company: ${parsed.metadata.companyName}`);
    return parsed;
  } catch {
    throw new Error(`Failed to parse GPT-4o response as JSON: ${content.slice(0, 200)}`);
  }
}
