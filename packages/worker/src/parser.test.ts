import { describe, it, expect } from "vitest";
import { parsePdf } from "./parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixturePath = resolve(import.meta.dirname, "__fixtures__", "sample.pdf");

describe("parsePdf", () => {
  it("extracts text from a digital PDF", async () => {
    const pdfBuffer = readFileSync(fixturePath);
    const text = await parsePdf(pdfBuffer);

    expect(text).toBeTruthy();
    expect(text).toContain("Hello Baltic Earnings");
  });
});
