import { describe, it, expect, beforeEach } from "vitest";
import { recordFailedAttempt, resetRateLimit, resetAllRateLimits, isRateLimited } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetAllRateLimits();
    process.env.ACCESS_RATE_LIMIT_MAX = "3";
    process.env.ACCESS_RATE_LIMIT_WINDOW_MS = "60000";
  });

  it("allows up to the max attempts before rate limiting", () => {
    const key = "192.168.1.1";

    // First 3 failures should NOT trigger rate limit (max=3 means 4th triggers it)
    expect(recordFailedAttempt(key)).toBe(false); // failure 1 (not limited)
    expect(recordFailedAttempt(key)).toBe(false); // failure 2
    expect(recordFailedAttempt(key)).toBe(false); // failure 3
    // 4th failure exceeds max (3) — rate limited
    expect(recordFailedAttempt(key)).toBe(true);
  });

  it("resets rate limit on successful access", () => {
    const key = "192.168.1.2";

    recordFailedAttempt(key);
    recordFailedAttempt(key);
    recordFailedAttempt(key);

    resetRateLimit(key);

    // After reset, should start fresh
    expect(recordFailedAttempt(key)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const key1 = "192.168.1.3";
    const key2 = "10.0.0.1";

    // Key1 hits limit
    recordFailedAttempt(key1);
    recordFailedAttempt(key1);
    recordFailedAttempt(key1);

    // Key2 should not be limited
    expect(recordFailedAttempt(key2)).toBe(false);
    expect(recordFailedAttempt(key2)).toBe(false);
  });

  it("isRateLimited returns true after exceeding max, false before", () => {
    const key = "192.168.1.4";

    recordFailedAttempt(key);
    recordFailedAttempt(key);
    recordFailedAttempt(key);
    // 3 failures at max=3 — not yet limited
    expect(isRateLimited(key)).toBe(false);

    // 4th failure exceeds max
    recordFailedAttempt(key);
    expect(isRateLimited(key)).toBe(true);
  });

  it("isRateLimited does not increment the counter", () => {
    const key = "192.168.1.5";

    recordFailedAttempt(key);
    recordFailedAttempt(key);
    // 2 failures — check does not affect count
    expect(isRateLimited(key)).toBe(false);
    expect(isRateLimited(key)).toBe(false);
  });
});
