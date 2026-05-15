import OpenAI from "openai";
import type { ExtractedData, OutputLanguage, TranslationCacheEntry } from "@bei/shared";

export type OpenAIClient = Pick<OpenAI, "chat">;
export type TranslationCache = {
  getCachedTranslations(sourceTexts: string[]): Promise<Map<string, TranslationCacheEntry>>;
  saveCachedTranslations(entries: TranslationCacheEntry[]): Promise<void>;
};

type TranslationItem = {
  id: string;
  source: string;
  cacheableLabel?: boolean;
};

const LANGUAGE_NAMES: Record<Exclude<OutputLanguage, "en">, string> = {
  et: "Estonian",
  lv: "Latvian",
  lt: "Lithuanian",
};

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

export function setTranslationClient(c: OpenAIClient): void {
  client = c;
}

export function collectTranslationItems(data: ExtractedData): TranslationItem[] {
  const items: TranslationItem[] = [];

  data.metrics.forEach((metric, index) => {
    if (metric.label.trim()) {
      items.push({ id: `metric:${index}:label`, source: metric.label, cacheableLabel: true });
    }
  });

  data.narratives.forEach((narrative, index) => {
    if (narrative.text.trim()) {
      items.push({ id: `narrative:${index}:text`, source: narrative.text });
    }
  });

  if (data.sentiment.managementTone.trim()) {
    items.push({ id: "sentiment:managementTone", source: data.sentiment.managementTone });
  }
  if (data.sentiment.outlook.trim()) {
    items.push({ id: "sentiment:outlook", source: data.sentiment.outlook });
  }
  data.sentiment.riskFactors.forEach((risk, index) => {
    if (risk.trim()) items.push({ id: `sentiment:risk:${index}`, source: risk });
  });

  return items;
}

export async function translateExtractedData(
  data: ExtractedData,
  targetLanguage: OutputLanguage,
  cache: TranslationCache,
  apiClient?: OpenAIClient,
): Promise<ExtractedData> {
  if (targetLanguage === "en") {
    return {
      ...data,
      metadata: { ...data.metadata, outputLanguage: "en" },
    };
  }

  const items = collectTranslationItems(data);
  const labelItems = items.filter((item) => item.cacheableLabel);
  const cached = await cache.getCachedTranslations([...new Set(labelItems.map((item) => item.source))]);
  const translations = new Map<string, string>();
  const missing: TranslationItem[] = [];

  for (const item of items) {
    const cachedText = item.cacheableLabel ? cached.get(item.source)?.[targetLanguage] : undefined;
    if (cachedText) {
      translations.set(item.id, cachedText);
    } else {
      missing.push(item);
    }
  }

  if (missing.length > 0) {
    const translated = await batchTranslate(missing, targetLanguage, apiClient);
    for (const item of missing) {
      const translatedText = translated.get(item.id);
      if (!translatedText) throw new Error(`Missing translation for item ${item.id}`);
      translations.set(item.id, translatedText);
    }

    const cacheWrites = missing
      .filter((item) => item.cacheableLabel)
      .map((item) => ({
        sourceText: item.source,
        [targetLanguage]: translations.get(item.id) ?? null,
      })) as TranslationCacheEntry[];
    await cache.saveCachedTranslations(cacheWrites);
  }

  return applyTranslations(data, targetLanguage, translations);
}

async function batchTranslate(
  items: TranslationItem[],
  targetLanguage: Exclude<OutputLanguage, "en">,
  apiClient?: OpenAIClient,
): Promise<Map<string, string>> {
  const openai = apiClient ?? getClient();
  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: `Translate financial report labels and narrative text to ${LANGUAGE_NAMES[targetLanguage]}. Preserve numbers, company names, periods, and financial abbreviations such as EBITDA unless there is a standard local equivalent. Return only JSON.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLanguage,
          items: items.map(({ id, source }) => ({ id, source })),
          expectedCount: items.length,
          responseShape: { translations: [{ id: "same id", text: "translated text" }] },
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("GPT-4o returned empty translation response");

  const parsed = JSON.parse(content) as { translations?: { id: string; text: string }[] };
  const translations = parsed.translations ?? [];
  if (translations.length !== items.length) {
    throw new Error(`Translation count mismatch: expected ${items.length}, received ${translations.length}`);
  }

  return new Map(translations.map((translation) => [translation.id, translation.text]));
}

function applyTranslations(
  data: ExtractedData,
  targetLanguage: OutputLanguage,
  translations: Map<string, string>,
): ExtractedData {
  return {
    ...data,
    metadata: {
      ...data.metadata,
      outputLanguage: targetLanguage,
    },
    metrics: data.metrics.map((metric, index) => ({
      ...metric,
      label: translations.get(`metric:${index}:label`) ?? metric.label,
    })),
    narratives: data.narratives.map((narrative, index) => ({
      ...narrative,
      text: translations.get(`narrative:${index}:text`) ?? narrative.text,
    })),
    sentiment: {
      managementTone: translations.get("sentiment:managementTone") ?? data.sentiment.managementTone,
      outlook: translations.get("sentiment:outlook") ?? data.sentiment.outlook,
      riskFactors: data.sentiment.riskFactors.map((risk, index) => translations.get(`sentiment:risk:${index}`) ?? risk),
    },
  };
}
