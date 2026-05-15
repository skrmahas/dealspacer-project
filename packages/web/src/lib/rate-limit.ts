/**
 * Simple in-memory rate limiter for the access code endpoint.
 * Tracks failed attempts per IP within a time window.
 */

interface RateLimitEntry {
  failures: number;
  windowStart: number;
}

const attempts = new Map<string, RateLimitEntry>();
const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getConfig() {
  const maxRaw = process.env.ACCESS_RATE_LIMIT_MAX;
  const windowRaw = process.env.ACCESS_RATE_LIMIT_WINDOW_MS;
  return {
    max: maxRaw ? Math.max(1, parseInt(maxRaw, 10) || DEFAULT_MAX) : DEFAULT_MAX,
    windowMs: windowRaw ? Math.max(1000, parseInt(windowRaw, 10) || DEFAULT_WINDOW_MS) : DEFAULT_WINDOW_MS,
  };
}

function cleanup() {
  const now = Date.now();
  const { windowMs } = getConfig();
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > windowMs * 2) {
      attempts.delete(key);
    }
  }
}

function ensureCleanup() {
  if (!cleanupTimer) {
    const { windowMs } = getConfig();
    cleanupTimer = setInterval(cleanup, windowMs);
    // Allow timer to not block process exit
    if (cleanupTimer.unref) cleanupTimer.unref();
  }
}

/** Record a failed attempt for the given key. Returns true if rate limited. */
export function recordFailedAttempt(key: string): boolean {
  ensureCleanup();
  const now = Date.now();
  const { max, windowMs } = getConfig();

  const existing = attempts.get(key);
  if (existing && now - existing.windowStart < windowMs) {
    existing.failures++;
    return existing.failures > max;
  }

  // New window
  attempts.set(key, { failures: 1, windowStart: now });
  return false;
}

/** Check if the key is currently rate-limited without incrementing. */
export function isRateLimited(key: string): boolean {
  ensureCleanup();
  const now = Date.now();
  const { max, windowMs } = getConfig();

  const existing = attempts.get(key);
  if (existing && now - existing.windowStart < windowMs) {
    return existing.failures > max;
  }

  return false;
}

/** Reset the rate limit for a key (called on successful access). */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

/** For testing: clear all state. */
export function resetAllRateLimits(): void {
  attempts.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
