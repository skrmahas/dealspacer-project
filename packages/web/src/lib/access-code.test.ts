import { describe, it, expect, beforeEach } from "vitest";
import { resolveExpectedAccessCode, PRODUCTION_ACCESS_CODE_MISSING_MESSAGE } from "@/lib/access-code";

describe("resolveExpectedAccessCode", () => {
  it("returns configured code when BEI_ACCESS_CODE is set", () => {
    const code = resolveExpectedAccessCode("development", "secret123");
    expect(code).toBe("secret123");
  });

  it("returns trimmed code", () => {
    const code = resolveExpectedAccessCode("development", "  secret123  ");
    expect(code).toBe("secret123");
  });

  it("returns null in production when not set", () => {
    const code = resolveExpectedAccessCode("production", undefined);
    expect(code).toBeNull();
  });

  it("returns fallback in development when not set", () => {
    const code = resolveExpectedAccessCode("development", undefined);
    expect(code).toBeTruthy();
    expect(typeof code).toBe("string");
    expect(code!.length).toBeGreaterThanOrEqual(4);
  });

  it("returns same fallback on subsequent calls", () => {
    const code1 = resolveExpectedAccessCode("development", undefined);
    const code2 = resolveExpectedAccessCode("development", undefined);
    expect(code1).toBe(code2);
  });

  it("returns PRODUCTION_ACCESS_CODE_MISSING_MESSAGE constant", () => {
    expect(PRODUCTION_ACCESS_CODE_MISSING_MESSAGE).toContain("production");
  });
});
