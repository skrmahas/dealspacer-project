import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPool, closePool, setPool, withClient } from "./db";

// Mock pg Pool
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn();
const mockRelease = vi.fn();
const mockQuery = vi.fn();

vi.mock("pg", () => {
  function MockPool() {
    return {
      connect: mockConnect,
      end: mockEnd,
    };
  }
  return { Pool: MockPool };
});

describe("getPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset pool between tests
    setPool(null as unknown as never);
  });

  it("creates a pool with DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    // Should not throw — pool created with DATABASE_URL
    const pool = getPool();
    expect(pool).toBeDefined();
    delete process.env.DATABASE_URL;
  });

  it("throws when DATABASE_URL is not set", () => {
    const oldUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => getPool()).toThrow("DATABASE_URL");
    } finally {
      if (oldUrl) process.env.DATABASE_URL = oldUrl;
    }
  });

  it("returns the same pool on subsequent calls", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const pool1 = getPool();
    const pool2 = getPool();

    expect(pool1).toBe(pool2);
    delete process.env.DATABASE_URL;
  });

  it("respects DATABASE_POOL_MAX env var", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    process.env.DATABASE_POOL_MAX = "8";

    // Should not throw — pool created with custom max
    const pool = getPool();
    expect(pool).toBeDefined();

    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_POOL_MAX;
  });
});

describe("closePool", () => {
  it("ends the pool and clears reference", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const pool = getPool();
    await closePool();

    expect(mockEnd).toHaveBeenCalled();
    delete process.env.DATABASE_URL;
  });

  it("does nothing when pool is not initialized", async () => {
    await closePool();
    // Should not throw
  });
});

describe("withClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("acquires client, runs callback, and releases", async () => {
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withClient(fn);

    expect(result).toBe("result");
    expect(mockConnect).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });

  it("releases client even when callback throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(withClient(fn)).rejects.toThrow("boom");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("passes client to callback", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    await withClient(fn);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ query: mockQuery, release: mockRelease }),
    );
  });
});
