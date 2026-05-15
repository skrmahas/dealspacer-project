import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  levenshtein,
  jaccardSimilarity,
  deduplicateMetrics,
  normalizeDiacritics,
} from "./deduplicator.js";
import type { ExtractedMetric } from "@bei/shared";

describe("normalizeLabel", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeLabel("Revenue  from  operations")).toBe("Revenue from operations");
  });

  it("removes embedded newlines", () => {
    expect(normalizeLabel("Carrying amount of\nGroup's unquoted investments")).toBe(
      "Carrying amount of Group's unquoted investments"
    );
  });

  it("trims whitespace", () => {
    expect(normalizeLabel("  EBITDA  ")).toBe("EBITDA");
  });

  it("handles Windows-style line breaks", () => {
    expect(normalizeLabel("Net\r\nProfit\r\nMargin")).toBe("Net Profit Margin");
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("Revenue", "Revenue")).toBe(0);
  });

  it("returns 1 for single character substitution", () => {
    expect(levenshtein("Revenue", "Revenus")).toBe(1);
  });

  it("returns correct distance for different strings", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "test")).toBe(4);
    expect(levenshtein("test", "")).toBe(4);
    expect(levenshtein("", "")).toBe(0);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical word sets", () => {
    expect(jaccardSimilarity("Revenue from operations", "Revenue from operations")).toBe(1);
  });

  it("is case insensitive", () => {
    expect(jaccardSimilarity("REVENUE FROM OPERATIONS", "revenue from operations")).toBe(1);
  });

  it("returns high similarity for near-identical phrases with one extra word", () => {
    // "total assets" has 6/7 common words → Jaccard ≈ 0.857
    const sim = jaccardSimilarity(
      "total assets equity and liabilities report",
      "total assets equity liabilities report"
    );
    expect(sim).toBeCloseTo(0.83, 1);
  });

  it("returns 0 for completely different word sets", () => {
    expect(jaccardSimilarity("Revenue growth", "Net profit margin")).toBe(0);
  });

  it("handles empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
    expect(jaccardSimilarity("", "x")).toBe(0);
  });
});

describe("deduplicateMetrics", () => {
  it("returns identical array when no duplicates exist", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "EBITDA", value: 50, unit: "EUR" },
      { label: "Net Profit", value: 30, unit: "EUR" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(3);
    expect(result[0].label).toBe("Revenue");
    expect(result[1].label).toBe("EBITDA");
  });

  it("merges exact duplicate labels", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "Revenue", value: 105, unit: "EUR" },
      { label: "EBITDA", value: 50, unit: "EUR" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("Revenue");
    expect(result[1].label).toBe("EBITDA");
  });

  it("merges near-duplicate labels with Levenshtein distance ≤3", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "Reveneu", value: 105, unit: "EUR" }, // typo → distance 1
      { label: "EBITDA", value: 50, unit: "EUR" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(2);
  });

  it("merges labels with high Jaccard similarity", () => {
    const metrics: ExtractedMetric[] = [
      {
        label: "Carrying amount of Group's unquoted investments at fair value",
        value: 107570,
        unit: "thousand EUR",
      },
      {
        label: "Carrying amount of Groups unquoted investments at fair value",
        value: 102432,
        unit: "thousand EUR",
      },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(1);
  });

  it("prefers value with period annotation when merging", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "Revenue", value: 110, unit: "EUR", period: "2025" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(110); // period-annotated value kept
    expect(result[0].period).toBe("2025");
  });

  it("keeps first occurrence when both have period annotations", () => {
    const metrics: ExtractedMetric[] = [
      { label: "EBITDA", value: 50, unit: "EUR", period: "2024" },
      { label: "EBITDA", value: 55, unit: "EUR", period: "2025" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(1);
    // Both have periods — keeps the longer/more specific one (2025 → same length, keeps first)
    expect(result[0].value).toBe(50);
  });

  it("cleans embedded newlines from labels before dedup", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Carrying amount of\nGroup's unquoted investments", value: 107570 },
      { label: "Carrying amount of Group's unquoted investments", value: 115365 },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Carrying amount of\nGroup's unquoted investments");
  });

  it("handles the auditor report scenario: 3 duplicates + clean metrics", () => {
    const metrics: ExtractedMetric[] = [
      {
        label: "Carrying amount of\nGroup's unquoted investments at fair value",
        value: 107570,
        unit: "thousand EUR",
        period: "2025",
      },
      {
        label: "Carrying amount of Group's unquoted investments at fair value",
        value: 102432,
        unit: "thousand EUR",
        period: "2024",
      },
      {
        label: "Carrying amount of Group's unquoted\ninvestments at fair value",
        value: 115365,
        unit: "thousand EUR",
      },
      { label: "Revenue", value: 200000, unit: "EUR m" },
      { label: "EBITDA", value: 80000, unit: "EUR m" },
    ];

    const result = deduplicateMetrics(metrics);
    // 3 duplicates → 1 + 2 clean = 3 total
    expect(result).toHaveLength(3);

    const investmentMetric = result.find((m) => m.label.includes("Carrying amount"));
    expect(investmentMetric).toBeDefined();
    // Should have preferred the period-annotated value (107570 with period "2025")
    expect(investmentMetric!.value).toBe(107570);
    expect(investmentMetric!.period).toBe("2025");
  });

  it("preserves non-duplicate metrics untouched", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "Revenue", value: 110, unit: "EUR", period: "2025" }, // duplicate of above
      { label: "EBITDA", value: 50, unit: "EUR" },                  // unique
      { label: "Net Profit", value: 30, unit: "EUR" },              // unique
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(3);

    const ebitda = result.find((m) => m.label === "EBITDA");
    expect(ebitda!.value).toBe(50);

    const netProfit = result.find((m) => m.label === "Net Profit");
    expect(netProfit!.value).toBe(30);
  });

  it("handles empty metrics array", () => {
    const result = deduplicateMetrics([]);
    expect(result).toHaveLength(0);
  });

  it("handles single metric", () => {
    const result = deduplicateMetrics([{ label: "Revenue", value: 100, unit: "EUR" }]);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(100);
  });

  it("does not merge clearly different metrics", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Revenue", value: 100, unit: "EUR" },
      { label: "Net Asset Value per Share", value: 18.5, unit: "EUR" },
      { label: "Number of Employees", value: 2450, unit: "" },
    ];

    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(3); // All different — none merged
  });
});


describe("normalizeDiacritics", () => {
  it("normalizes Latvian diacritics", () => {
    expect(normalizeDiacritics("Kapitāls")).toBe("Kapitals");
    expect(normalizeDiacritics("Šķērs")).toBe("Skers");
    expect(normalizeDiacritics("Čužuļš")).toBe("Cuzuls");
  });

  it("deduplicates diacritic variants of same label", () => {
    const metrics: ExtractedMetric[] = [
      { label: "Kapitāls", value: 100, unit: "EUR" },
      { label: "Kapitals", value: 100, unit: "EUR" },
    ];
    const result = deduplicateMetrics(metrics);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Kapitāls");
  });
});
