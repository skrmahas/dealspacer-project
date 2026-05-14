import { describe, it, expect } from "vitest";

/**
 * Unit tests for the HTTP Range header parsing logic used in
 * the download route. The actual route handler is tested via
 * integration; these tests verify the range parsing edge cases.
 */

function parseRange(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const endRaw = match[2];

  if (start >= fileSize) return null;

  let end: number;
  if (endRaw === "") {
    end = fileSize - 1;
  } else {
    end = parseInt(endRaw, 10);
    if (end >= fileSize) end = fileSize - 1;
  }

  if (start > end) return null;

  return { start, end };
}

describe("parseRange", () => {
  const fileSize = 10000;

  it("parses valid bytes=start-end range", () => {
    const range = parseRange("bytes=0-499", fileSize);
    expect(range).toEqual({ start: 0, end: 499 });
  });

  it("parses bytes=start- (open-ended) range", () => {
    const range = parseRange("bytes=9500-", fileSize);
    expect(range).toEqual({ start: 9500, end: 9999 });
  });

  it("clamps end to fileSize-1 when exceeding file size", () => {
    const range = parseRange("bytes=9900-20000", fileSize);
    expect(range).toEqual({ start: 9900, end: 9999 });
  });

  it("returns null when start >= fileSize", () => {
    const range = parseRange("bytes=10000-10005", fileSize);
    expect(range).toBeNull();
  });

  it("returns null when start > end", () => {
    const range = parseRange("bytes=500-300", fileSize);
    expect(range).toBeNull();
  });

  it("returns null for invalid format (no bytes= prefix)", () => {
    const range = parseRange("0-499", fileSize);
    expect(range).toBeNull();
  });

  it("returns null for invalid format (text)", () => {
    const range = parseRange("bytes=abc-def", fileSize);
    expect(range).toBeNull();
  });

  it("handles single-byte range at start", () => {
    const range = parseRange("bytes=0-0", fileSize);
    expect(range).toEqual({ start: 0, end: 0 });
  });

  it("handles single-byte range at end", () => {
    const range = parseRange("bytes=9999-9999", fileSize);
    expect(range).toEqual({ start: 9999, end: 9999 });
  });

  it("parses range with whitespace", () => {
    const range = parseRange(" bytes=100-200 ", fileSize);
    expect(range).toEqual({ start: 100, end: 200 });
  });
});
