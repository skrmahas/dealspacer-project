import { describe, it, expect, vi, beforeEach } from "vitest";
const mockLoad = vi.fn(); const mockGetText = vi.fn(); const mockDestroy = vi.fn();
vi.mock("pdf-parse", () => ({ PDFParse: vi.fn(function(this:any){this.load=mockLoad;this.getText=mockGetText;this.destroy=mockDestroy;}) }));
import { parsePdf } from "./parser.js";

describe("PDF Parser", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("reads file, creates PDFParse, returns text", async () => {
    mockLoad.mockResolvedValueOnce(undefined); mockGetText.mockReturnValueOnce("extracted text");
    const text = await parsePdf("test-fixtures/sample.pdf");
    expect(text).toBe("extracted text");
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
  it("passes Uint8Array to PDFParse", async () => {
    mockLoad.mockResolvedValueOnce(undefined); mockGetText.mockReturnValueOnce("t");
    await parsePdf("test-fixtures/sample.pdf");
    const { PDFParse } = await import("pdf-parse");
    expect((PDFParse as any).mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  });
  it("throws on non-existent file", async () => {
    await expect(parsePdf("/nonexistent/file.pdf")).rejects.toThrow();
  });
  it("destroys parser even on load failure", async () => {
    mockLoad.mockRejectedValueOnce(new Error("parse error"));
    await expect(parsePdf("test-fixtures/sample.pdf")).rejects.toThrow("parse error");
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});
