import OpenAI from "openai";
import type { ExtractedData } from "@bei/shared";

const SYSTEM_PROMPT = `You are a financial document extraction specialist focused on Baltic company earnings reports.

Extract the following from the provided document text into a JSON object. Follow these rules strictly:

1. metadata: { companyName, reportPeriod, sourceLanguage }
   - companyName: the legal entity name as it appears in the document
   - reportPeriod: e.g. "Q1 2024", "FY 2023", "2024-03-31"
   - sourceLanguage: one of "et", "lv", "lt", or "en"

2. metrics: an array of { label, value, unit?, period? }
   - Extract ALL financial metrics present: revenue, EBITDA, net profit, operating profit, assets, equity, liabilities, cash flow, EPS, dividends, etc.
   - value must be a number (use null if value is mentioned but unclear)
   - unit should be the stated unit (e.g. "EUR", "EUR m", "EUR k", "thousand EUR")
   - period can be omitted if the metric applies to the full report period

3. narratives: an array of { section, text }
   - section: "executive_summary", "management_commentary", "business_overview", "segment_performance", or "outlook"
   - text: 2-4 paragraphs per section, summarized and translated to English if the source is not English
   - Only include sections that have meaningful content in the document

4. sentiment: { managementTone, outlook, riskFactors }
   - managementTone: one of "very positive", "positive", "neutral", "cautious", "negative"
   - outlook: a 1-2 sentence summary of forward-looking statements, translated to English
   - riskFactors: array of strings, each a concise risk factor mentioned

IMPORTANT:
- Translate all text to English
- DO NOT fabricate numbers. If a metric is not clearly present, do not include it.
- If the document does not appear to be a financial report at all, return a JSON object with all fields set to empty/null values: metadata has empty strings, metrics is [], narratives is [], sentiment has empty strings and [].
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

  try {
    const parsed = JSON.parse(content) as ExtractedData;
    return parsed;
  } catch {
    throw new Error(`Failed to parse GPT-4o response as JSON: ${content.slice(0, 200)}`);
  }
}
