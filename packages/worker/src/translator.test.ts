import { describe, expect, it, vi } from "vitest";
import type { ExtractedData, TranslationCacheEntry } from "@bei/shared";
import { translateExtractedData, type OpenAIClient, type TranslationCache } from "./translator.js";

function mockExtraction(): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "Q1 2026", sourceLanguage: "en" },
    metrics: [
      { label: "Revenue", value: 1200000, unit: "EUR" },
      { label: "EBITDA", value: 320000, unit: "EUR" },
    ],
    narratives: [
      { section: "executive_summary", text: "Revenue increased because subscriptions expanded." },
    ],
    sentiment: { managementTone: "positive", outlook: "Management expects steady growth.", riskFactors: ["Energy price volatility"] },
  };
}

function mockClient(translations: { id: string; text: string }[]): OpenAIClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ translations }) } }],
        }),
      },
    },
  } as unknown as OpenAIClient;
}

function createCache(entries: TranslationCacheEntry[] = []): TranslationCache & {
  saved: TranslationCacheEntry[];
} {
  const map = new Map(entries.map((entry) => [entry.sourceText, entry]));
  return {
    saved: [],
    async getCachedTranslations(sourceTexts: string[]) {
      return new Map(sourceTexts.flatMap((sourceText) => {
        const entry = map.get(sourceText);
        return entry ? [[sourceText, entry] as const] : [];
      }));
    },
    async saveCachedTranslations(newEntries: TranslationCacheEntry[]) {
      this.saved.push(...newEntries);
      for (const entry of newEntries) {
        map.set(entry.sourceText, { ...map.get(entry.sourceText), ...entry });
      }
    },
  };
}

describe("translateExtractedData", () => {
  it("uses cached label translations and only sends misses to GPT-4o", async () => {
    const data = mockExtraction();
    const cache = createCache([{ sourceText: "Revenue", lt: "Pajamos" }]);
    const client = mockClient([
      { id: "metric:1:label", text: "EBITDA" },
      { id: "narrative:0:text", text: "Pajamos padidėjo dėl prenumeratų augimo." },
      { id: "sentiment:managementTone", text: "teigiamas" },
      { id: "sentiment:outlook", text: "Vadovybė tikisi stabilaus augimo." },
      { id: "sentiment:risk:0", text: "Energijos kainų svyravimai" },
    ]);

    const translated = await translateExtractedData(data, "lt", cache, client);

    expect(translated.metadata.outputLanguage).toBe("lt");
    expect(translated.metrics[0].label).toBe("Pajamos");
    expect(translated.metrics[1].label).toBe("EBITDA");
    expect(translated.narratives[0].text).toBe("Pajamos padidėjo dėl prenumeratų augimo.");
    expect(cache.saved).toEqual([{ sourceText: "EBITDA", lt: "EBITDA" }]);
    expect(client.chat.completions.create).toHaveBeenCalledOnce();
  });

  it("builds the label cache so the second call can hit", async () => {
    const data = mockExtraction();
    const cache = createCache();
    const firstClient = mockClient([
      { id: "metric:0:label", text: "Käive" },
      { id: "metric:1:label", text: "EBITDA" },
      { id: "narrative:0:text", text: "Käive kasvas." },
      { id: "sentiment:managementTone", text: "positiivne" },
      { id: "sentiment:outlook", text: "Juhtkond ootab kasvu." },
      { id: "sentiment:risk:0", text: "Energiahinna kõikumine" },
    ]);

    await translateExtractedData(data, "et", cache, firstClient);

    const secondClient = mockClient([
      { id: "narrative:0:text", text: "Käive kasvas." },
      { id: "sentiment:managementTone", text: "positiivne" },
      { id: "sentiment:outlook", text: "Juhtkond ootab kasvu." },
      { id: "sentiment:risk:0", text: "Energiahinna kõikumine" },
    ]);
    const translated = await translateExtractedData(data, "et", cache, secondClient);

    expect(translated.metrics[0].label).toBe("Käive");
    expect(translated.metrics[1].label).toBe("EBITDA");
    const request = JSON.parse((secondClient.chat.completions.create as any).mock.calls[0][0].messages[1].content);
    expect(request.items.map((item: { id: string }) => item.id)).not.toContain("metric:0:label");
    expect(request.items.map((item: { id: string }) => item.id)).not.toContain("metric:1:label");
  });

  it("fails when GPT-4o returns a different translation count", async () => {
    await expect(
      translateExtractedData(mockExtraction(), "lv", createCache(), mockClient([
        { id: "metric:0:label", text: "Ieņēmumi" },
      ])),
    ).rejects.toThrow("Translation count mismatch");
  });
});
