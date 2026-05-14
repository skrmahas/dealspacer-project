import { describe, it, expect } from "vitest";
import { parsePdf } from "./parser.js";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const samplePath = resolve(import.meta.dirname, "__fixtures__", "sample.pdf");
const ignitisPath = resolve(
  import.meta.dirname,
  "__fixtures__",
  "ignitis-strategic-plan.pdf",
);

describe("parsePdf", () => {
  it("extracts text from a digital PDF", async () => {
    const pdfBuffer = readFileSync(samplePath);
    const text = await parsePdf(pdfBuffer);

    expect(text).toBeTruthy();
    expect(text).toContain("Hello Baltic Earnings");
  });

  // Real Baltic earnings report — large file (7.2MB), skip in CI
  if (existsSync(ignitisPath)) {
    it(
      "extracts financial data from Ignitis Group Strategic Plan 2026-2029",
      async () => {
        const pdfBuffer = readFileSync(ignitisPath);
        const text = await parsePdf(pdfBuffer);

        expect(text.length).toBeGreaterThan(10000);
        expect(text).toContain("Ignitis");
        expect(text).toMatch(/EBITDA/i);
        expect(text).toMatch(/EUR/);
        expect(text).toMatch(/Strategic Plan/);
        expect(text).toMatch(/renewable/i);
      },
      30000,
    );
  }
});
