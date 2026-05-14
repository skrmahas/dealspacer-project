import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pdf-parse before importing parser
const mockLoad = vi.fn();
const mockGetText = vi.fn();
const mockDestroy = vi.fn();

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(function (this: any) {
    this.load = mockLoad;
    this.getText = mockGetText;
    this.destroy = mockDestroy;
  }),
}));

import { parsePdf } from "./parser.js";

describe("PDF Parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads file, creates PDFParse instance, and returns text", async () => {
    mockLoad.mockResolvedValueOnce(undefined);
    mockGetText.mockReturnValueOnce("Sample extracted text from earnings report");

    const text = await parsePdf("test-fixtures/sample.pdf");

    expect(text).toBe("Sample extracted text from earnings report");
    expect(mockLoad).toHaveBeenCalledOnce();
    expect(mockGetText).toHaveBeenCalledOnce();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("passes Uint8Array data to PDFParse constructor", async () => {
    mockLoad.mockResolvedValueOnce(undefined);
    mockGetText.mockReturnValueOnce("text");

    await parsePdf("test-fixtures/sample.pdf");

    // Verify PDFParse was constructed
    const { PDFParse } = await import("pdf-parse");
    expect(PDFParse).toHaveBeenCalledOnce();
    const arg = (PDFParse as any).mock.calls[0][0];
    expect(arg).toBeInstanceOf(Uint8Array);
  });

  it("throws on non-existent file", async () => {
    await expect(parsePdf("/nonexistent/file.pdf")).rejects.toThrow();
  });

  it("destroys parser even if load throws", async () => {
    mockLoad.mockRejectedValueOnce(new Error("Parse error"));

    await expect(parsePdf("test-fixtures/sample.pdf")).rejects.toThrow("Parse error");
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});
