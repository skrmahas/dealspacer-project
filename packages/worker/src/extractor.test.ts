import { describe, it, expect, vi } from "vitest";
import { extractFromText, setClient } from "./extractor.js";
import type { OpenAIClient } from "./extractor.js";

function mockClient(responseJson: unknown): OpenAIClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(responseJson) } }],
        }),
      },
    },
  } as unknown as OpenAIClient;
}

const validExtraction = {
  metadata: {
    companyName: "AS Tallink Grupp",
    reportPeriod: "Q1 2024",
    sourceLanguage: "en",
  },
  metrics: [
    { label: "Revenue", value: 210400000, unit: "EUR" },
    { label: "EBITDA", value: 48700000, unit: "EUR" },
    { label: "Net Profit", value: 12300000, unit: "EUR" },
    { label: "Total Assets", value: 1650000000, unit: "EUR" },
  ],
  narratives: [
    {
      section: "executive_summary",
      text: "Tallink Grupp reported strong Q1 2024 results with revenue growth of 8% year-on-year driven by increased passenger volumes on the Tallinn-Helsinki route.",
    },
    {
      section: "outlook",
      text: "Management expects continued recovery in passenger numbers through 2024, with potential headwinds from fuel price volatility.",
    },
  ],
  sentiment: {
    managementTone: "positive",
    outlook: "Management expects continued recovery in passenger numbers through 2024.",
    riskFactors: ["Fuel price volatility", "Geopolitical uncertainty in the Baltic Sea region"],
  },
};

const emptyExtraction = {
  metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
  metrics: [],
  narratives: [],
  sentiment: { managementTone: "", outlook: "", riskFactors: [] },
};

describe("extractFromText", () => {
  it("calls GPT-4o with the correct model, system prompt, and JSON response format", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    await extractFromText("Financial report text here");

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledTimes(1);

    const callArgs = createFn.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.response_format).toEqual({ type: "json_object" });
    expect(callArgs.temperature).toBe(0);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain("Baltic company earnings reports");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.messages[1].content).toContain("Financial report text here");
  });

  it("returns parsed JSON with correct structure", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    const result = await extractFromText("dummy text");

    expect(result.metadata.companyName).toBe("AS Tallink Grupp");
    expect(result.metadata.reportPeriod).toBe("Q1 2024");
    expect(result.metrics).toHaveLength(4);
    expect(result.metrics[0].label).toBe("Revenue");
    expect(result.metrics[0].value).toBe(210400000);
    expect(result.narratives).toHaveLength(2);
    expect(result.narratives[0].section).toBe("executive_summary");
    expect(result.sentiment.managementTone).toBe("positive");
    expect(result.sentiment.riskFactors).toHaveLength(2);
  });

  it("handles empty extraction (non-financial document)", async () => {
    const client = mockClient(emptyExtraction);
    setClient(client);

    const result = await extractFromText("not a financial doc");

    expect(result.metrics).toHaveLength(0);
    expect(result.narratives).toHaveLength(0);
  });

  it("truncates text to 60000 characters", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    const longText = "x".repeat(100000);
    await extractFromText(longText);

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const userContent = createFn.mock.calls[0][0].messages[1].content;
    // Should contain truncated text (60000 chars + prompt prefix)
    expect(userContent.length).toBeLessThan(61000);
  });

  it("throws when GPT-4o returns empty content", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      },
    } as unknown as OpenAIClient;
    setClient(client);

    await expect(extractFromText("text")).rejects.toThrow("empty response");
  });

  it("throws when GPT-4o returns invalid JSON", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not valid json at all!!" } }],
          }),
        },
      },
    } as unknown as OpenAIClient;
    setClient(client);

    await expect(extractFromText("text")).rejects.toThrow("Failed to parse GPT-4o response");
  });

  it("throws when OPENAI_API_KEY is not set and no client provided", async () => {
    setClient(null as unknown as OpenAIClient);
    const oldKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(extractFromText("text")).rejects.toThrow("OPENAI_API_KEY");
    } finally {
      if (oldKey) process.env.OPENAI_API_KEY = oldKey;
    }
  });
});
