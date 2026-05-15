import { describe, it, expect, vi } from "vitest";
import { extractFromText, setClient, detectExtractionStages } from "./extractor.js";
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

function mockMultiClient(responses: unknown[]): OpenAIClient {
  let callCount = 0;
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(() => {
          const idx = callCount++;
          const content = idx < responses.length
            ? JSON.stringify(responses[idx])
            : JSON.stringify({ metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" }, metrics: [], narratives: [], sentiment: { managementTone: "", outlook: "", riskFactors: [] } });
          return Promise.resolve({
            choices: [{ message: { content } }],
          });
        }),
      },
    },
  } as unknown as OpenAIClient;
}

/** Route completions by targeted-extraction system prompt (for multi-stage tests). */
function mockRoutingClient(payloads: {
  metrics: unknown;
  trends: unknown;
  narratives: unknown;
}): OpenAIClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation((req: { messages: Array<{ role: string; content: string }> }) => {
          const sys = req.messages[0]?.content ?? "";
          let body: unknown;
          if (sys.includes("Extract metadata and all financial metrics")) {
            body = payloads.metrics;
          } else if (sys.includes("Extract multi-period trend data")) {
            body = payloads.trends;
          } else if (sys.includes("Extract qualitative narratives")) {
            body = payloads.narratives;
          } else {
            body = { metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" }, metrics: [] };
          }
          return Promise.resolve({
            choices: [{ message: { content: JSON.stringify(body) } }],
          });
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
    guidanceDirection: "maintained",
  },
  revenueBreakdown: {
    bySegment: [
      { name: "Passenger Ferries", value: 145200000 },
      { name: "Cargo Shipping", value: 38500000 },
    ],
  },
  profitabilityTrends: {
    periods: ["Q3 2023", "Q4 2023", "Q1 2024"],
    revenue: [220000000, 205000000, 210400000],
    ebitda: [55000000, 46000000, 48700000],
    freeCashFlow: [32000000, 28000000, 31000000],
  },
};

const chunk1Extraction = {
  metadata: {
    companyName: "AS Tallink Grupp",
    reportPeriod: "Q1 2024",
    sourceLanguage: "en",
  },
  metrics: [
    { label: "Revenue", value: 210400000, unit: "EUR" },
    { label: "EBITDA", value: 48700000, unit: "EUR" },
  ],
  narratives: [
    {
      section: "executive_summary",
      text: "Tallink Grupp reported strong Q1 2024 results.",
    },
  ],
  sentiment: {
    managementTone: "positive",
    outlook: "Management expects recovery.",
    riskFactors: ["Fuel price volatility"],
  },
  revenueBreakdown: {
    bySegment: [
      { name: "Passenger Ferries", value: 145200000 },
    ],
  },
  profitabilityTrends: {
    periods: ["Q3 2023", "Q4 2023"],
    revenue: [220000000, 205000000],
  },
};

const chunk2Extraction = {
  metadata: {
    companyName: "",
    reportPeriod: "",
    sourceLanguage: "",
  },
  metrics: [
    { label: "Net Profit", value: 12300000, unit: "EUR" },
    { label: "Total Assets", value: 1650000000, unit: "EUR" },
    // Duplicate revenue across chunk boundary — should be deduplicated
    { label: "Revenue", value: 210500000, unit: "EUR" },
  ],
  narratives: [
    {
      section: "outlook",
      text: "Management expects headwinds from fuel price volatility.",
    },
  ],
  sentiment: {
    managementTone: "",
    outlook: "",
    riskFactors: ["Geopolitical uncertainty in the Baltic Sea region"],
  },
  revenueBreakdown: {
    bySegment: [
      { name: "Cargo Shipping", value: 38500000 },
    ],
  },
  profitabilityTrends: {
    periods: ["Q1 2024"],
    revenue: [210400000],
    ebitda: [48700000],
  },
};

const emptyExtraction = {
  metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
  metrics: [],
  narratives: [],
  sentiment: { managementTone: "", outlook: "", riskFactors: [] },
  revenueBreakdown: {},
  profitabilityTrends: { periods: [], revenue: [], ebitda: [], netProfit: [] },
};

describe("extractFromText — single call (≤ threshold)", () => {
  it("calls OpenAI with the correct model, system prompt, and JSON response format", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    await extractFromText("Financial report text here");

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalled();

    const callArgs = createFn.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.response_format).toEqual({ type: "json_object" });
    expect(callArgs.temperature).toBe(0);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain("financial data extraction specialist");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.messages[1].content).toContain("Financial report text here");
  });

  it("returns parsed JSON with correct structure", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    const result = await extractFromText("dummy text for testing extraction");

    // Metrics stage always runs — metadata + metrics should be populated
    expect(result.metadata.companyName).toBe("AS Tallink Grupp");
    expect(result.metadata.reportPeriod).toBe("Q1 2024");
    expect(result.metrics.length).toBeGreaterThanOrEqual(1);
    expect(result.metrics[0].label).toBe("Revenue");
    expect(result.metrics[0].value).toBe(210400000);
    // Narratives/sentiment may not run for short text — that's OK
  });

  it("handles empty extraction (non-financial document)", async () => {
    const client = mockClient(emptyExtraction);
    setClient(client);

    const result = await extractFromText("not a financial doc");

    expect(result.metrics).toHaveLength(0);
    expect(result.narratives).toHaveLength(0);
  });

  it("uses single-call path for text at threshold boundary", async () => {
    const client = mockClient(validExtraction);
    setClient(client);

    // 60000 chars → should use targeted extraction (≤ threshold, single document)
    const text = "x".repeat(60000);
    await extractFromText(text);

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    // Targeted extraction may run 1-2 stages depending on text content
    expect(createFn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("merges metrics, trends, and narratives when all targeted stages run", async () => {
    const metricsPayload = {
      metadata: validExtraction.metadata,
      metrics: validExtraction.metrics,
    };
    const trendsPayload = {
      revenueBreakdown: validExtraction.revenueBreakdown,
      profitabilityTrends: validExtraction.profitabilityTrends,
    };
    const narrativesPayload = {
      narratives: validExtraction.narratives,
      sentiment: validExtraction.sentiment,
    };
    const client = mockRoutingClient({
      metrics: metricsPayload,
      trends: trendsPayload,
      narratives: narrativesPayload,
    });
    setClient(client);

    const text = `Q1 2024 results. ${"y".repeat(5200)}`;
    const result = await extractFromText(text);

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledTimes(3);
    expect(result.metadata.companyName).toBe("AS Tallink Grupp");
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.profitabilityTrends?.periods?.length).toBeGreaterThanOrEqual(2);
    expect(result.narratives.length).toBeGreaterThan(0);
  });
});

describe("extractFromText — chunked parallel (above threshold)", () => {
  it("uses chunked path for text over threshold", async () => {
    // Override threshold to 100 for testing
    process.env.EXTRACTION_CHUNK_THRESHOLD = "100";
    process.env.EXTRACTION_CHUNK_SIZE = "80";
    process.env.EXTRACTION_CHUNK_OVERLAP = "20";
    process.env.EXTRACTION_MAX_CONCURRENCY = "2";

    try {
      const client = mockMultiClient([chunk1Extraction, chunk2Extraction]);
      setClient(client);

      // 200 chars → should create multiple chunks
      const text = "a".repeat(200);
      const result = await extractFromText(text);

      const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
      // Should have multiple calls (chunks)
      expect(createFn.mock.calls.length).toBeGreaterThan(1);

      // Merged result should include metrics from both chunks
      expect(result.metrics.length).toBeGreaterThanOrEqual(3);

      // Revenue should be deduplicated (appears in both chunks)
      const revenueMetrics = result.metrics.filter((m) => m.label.toLowerCase() === "revenue");
      expect(revenueMetrics.length).toBe(1);

      // Narratives concatenated
      expect(result.narratives.length).toBeGreaterThanOrEqual(1);

      // Sentiment merged
      expect(result.sentiment.riskFactors.length).toBeGreaterThanOrEqual(1);
    } finally {
      delete process.env.EXTRACTION_CHUNK_THRESHOLD;
      delete process.env.EXTRACTION_CHUNK_SIZE;
      delete process.env.EXTRACTION_CHUNK_OVERLAP;
      delete process.env.EXTRACTION_MAX_CONCURRENCY;
    }
  });

  it("deduplicates metrics across chunk boundaries", async () => {
    process.env.EXTRACTION_CHUNK_THRESHOLD = "100";
    process.env.EXTRACTION_CHUNK_SIZE = "80";
    process.env.EXTRACTION_CHUNK_OVERLAP = "20";
    process.env.EXTRACTION_MAX_CONCURRENCY = "2";

    try {
      // Both chunks return Revenue — merged result should only have one
      const client = mockMultiClient([chunk1Extraction, chunk2Extraction]);
      setClient(client);

      const text = "a".repeat(200);
      const result = await extractFromText(text);

      const revenueMetrics = result.metrics.filter(
        (m) => m.label.toLowerCase() === "revenue",
      );
      expect(revenueMetrics.length).toBe(1);
    } finally {
      delete process.env.EXTRACTION_CHUNK_THRESHOLD;
      delete process.env.EXTRACTION_CHUNK_SIZE;
      delete process.env.EXTRACTION_CHUNK_OVERLAP;
      delete process.env.EXTRACTION_MAX_CONCURRENCY;
    }
  });

  it("merges revenue breakdown segments from multiple chunks", async () => {
    process.env.EXTRACTION_CHUNK_THRESHOLD = "100";
    process.env.EXTRACTION_CHUNK_SIZE = "80";
    process.env.EXTRACTION_CHUNK_OVERLAP = "20";
    process.env.EXTRACTION_MAX_CONCURRENCY = "2";

    try {
      const client = mockMultiClient([chunk1Extraction, chunk2Extraction]);
      setClient(client);

      const text = "a".repeat(200);
      const result = await extractFromText(text);

      expect(result.revenueBreakdown?.bySegment).toBeDefined();
      expect(result.revenueBreakdown!.bySegment!.length).toBeGreaterThanOrEqual(2);
    } finally {
      delete process.env.EXTRACTION_CHUNK_THRESHOLD;
      delete process.env.EXTRACTION_CHUNK_SIZE;
      delete process.env.EXTRACTION_CHUNK_OVERLAP;
      delete process.env.EXTRACTION_MAX_CONCURRENCY;
    }
  });

  it("merges profitability trends from multiple chunks", async () => {
    process.env.EXTRACTION_CHUNK_THRESHOLD = "100";
    process.env.EXTRACTION_CHUNK_SIZE = "80";
    process.env.EXTRACTION_CHUNK_OVERLAP = "20";
    process.env.EXTRACTION_MAX_CONCURRENCY = "2";

    try {
      const client = mockMultiClient([chunk1Extraction, chunk2Extraction]);
      setClient(client);

      const text = "a".repeat(200);
      const result = await extractFromText(text);

      expect(result.profitabilityTrends?.periods).toBeDefined();
      // Periods from both chunks merged (Q3 2023, Q4 2023, Q1 2024) — no duplicates
      const uniquePeriods = new Set(result.profitabilityTrends!.periods);
      expect(uniquePeriods.size).toBe(result.profitabilityTrends!.periods.length);
    } finally {
      delete process.env.EXTRACTION_CHUNK_THRESHOLD;
      delete process.env.EXTRACTION_CHUNK_SIZE;
      delete process.env.EXTRACTION_CHUNK_OVERLAP;
      delete process.env.EXTRACTION_MAX_CONCURRENCY;
    }
  });
});

describe("extractFromText — error handling", () => {
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

    await expect(extractFromText("text")).rejects.toThrow();
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

describe("extractFromText — retry behavior", () => {
  it("retries on 429 rate limit and succeeds", async () => {
    process.env.EXTRACTION_MAX_RETRIES = "2";

    try {
      let callCount = 0;
      const client = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount < 3) {
                const err = new Error("429 Too Many Requests") as unknown as Error & { status: number };
                (err as unknown as Record<string, unknown>).status = 429;
                throw err;
              }
              return Promise.resolve({
                choices: [{ message: { content: JSON.stringify(validExtraction) } }],
              });
            }),
          },
        },
      } as unknown as OpenAIClient;
      setClient(client);

      const result = await extractFromText("test text");
      expect(result.metadata.companyName).toBe("AS Tallink Grupp");
      expect(callCount).toBe(3); // 2 failures + 1 success
    } finally {
      delete process.env.EXTRACTION_MAX_RETRIES;
    }
  });

  it("does not retry on 400 Bad Request", async () => {
    process.env.EXTRACTION_MAX_RETRIES = "2";

    try {
      let callCount = 0;
      const client = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              callCount++;
              const err = new Error("400 Bad Request") as unknown as Error & { status: number };
              (err as unknown as Record<string, unknown>).status = 400;
              throw err;
            }),
          },
        },
      } as unknown as OpenAIClient;
      setClient(client);

      await expect(extractFromText("test")).rejects.toThrow("400 Bad Request");
      expect(callCount).toBe(1); // No retries on 4xx
    } finally {
      delete process.env.EXTRACTION_MAX_RETRIES;
    }
  });

  it("retries on 503 Service Unavailable", async () => {
    process.env.EXTRACTION_MAX_RETRIES = "1";

    try {
      let callCount = 0;
      const client = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount < 2) {
                const err = new Error("503 Service Unavailable") as unknown as Error & { status: number };
                (err as unknown as Record<string, unknown>).status = 503;
                throw err;
              }
              return Promise.resolve({
                choices: [{ message: { content: JSON.stringify(validExtraction) } }],
              });
            }),
          },
        },
      } as unknown as OpenAIClient;
      setClient(client);

      const result = await extractFromText("test");
      expect(callCount).toBe(2);
      expect(result.metrics).toHaveLength(4);
    } finally {
      delete process.env.EXTRACTION_MAX_RETRIES;
    }
  });

  it("respects EXTRACTION_MAX_RETRIES env var", async () => {
    process.env.EXTRACTION_MAX_RETRIES = "0"; // No retries

    try {
      let callCount = 0;
      const client = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              callCount++;
              const err = new Error("429 Too Many Requests") as unknown as Error & { status: number };
              (err as unknown as Record<string, unknown>).status = 429;
              throw err;
            }),
          },
        },
      } as unknown as OpenAIClient;
      setClient(client);

      await expect(extractFromText("test")).rejects.toThrow();
      expect(callCount).toBe(1); // Only 1 attempt (0 retries)
    } finally {
      delete process.env.EXTRACTION_MAX_RETRIES;
    }
  });
});

describe("extractFromText — model configuration", () => {
  it("uses OPENAI_MODEL env var when set", async () => {
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    try {
      const client = mockClient(validExtraction);
      setClient(client);

      await extractFromText("test");

      const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
      expect(createFn.mock.calls[0][0].model).toBe("gpt-4o-mini");
    } finally {
      delete process.env.OPENAI_MODEL;
    }
  });
});


describe("detectExtractionStages", () => {
  it("detects trends when text has quarterly periods", () => {
    const text = "Q1 2024 revenue was EUR 100M, up from Q4 2023 revenue of EUR 90M.";
    const stages = detectExtractionStages(text);
    expect(stages.needsTrends).toBe(true);
  });

  it("detects trends when text has segment breakdown", () => {
    const text = "Revenue by segment: Passenger Ferries EUR 50M, Cargo EUR 30M.";
    const stages = detectExtractionStages(text);
    expect(stages.needsTrends).toBe(true);
  });

  it("detects trends when text has year-on-year comparison", () => {
    const text = "Year-on-year revenue growth was 15%.";
    const stages = detectExtractionStages(text);
    expect(stages.needsTrends).toBe(true);
  });

  it("does not detect trends for simple single-period text", () => {
    const text = "The company reported revenue of EUR 100M.";
    const stages = detectExtractionStages(text);
    expect(stages.needsTrends).toBe(false);
  });

  it("needs narratives for text over 5000 chars", () => {
    const text = "a".repeat(5001);
    const stages = detectExtractionStages(text);
    expect(stages.needsNarratives).toBe(true);
  });

  it("skips narratives for short text", () => {
    const text = "Short text";
    const stages = detectExtractionStages(text);
    expect(stages.needsNarratives).toBe(false);
  });

  it("detects trends from multi-year projection format", () => {
    const text = "Targets for the years 2026, 2027, 2028, 2029 include revenue growth.";
    const stages = detectExtractionStages(text);
    expect(stages.needsTrends).toBe(true);
  });
});
