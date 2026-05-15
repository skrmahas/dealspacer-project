import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock("./db", () => ({
  getPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease }),
  })),
  closePool: vi.fn(),
}));

import { runMigrations } from "./migrate";

describe("runMigrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("creates jobs table with correct columns", async () => {
    await runMigrations();

    const queries = mockQuery.mock.calls.map((c: unknown[]) => (c as string[])[0]);
    const jobsTable = queries.find((q: string) => q.includes("CREATE TABLE IF NOT EXISTS jobs"));
    expect(jobsTable).toBeDefined();
    expect(jobsTable).toContain("id UUID PRIMARY KEY");
    expect(jobsTable).toContain("state TEXT");
    expect(jobsTable).toContain("original_filename TEXT");
    expect(jobsTable).toContain("output_language TEXT");
    expect(jobsTable).toContain("extracted_text TEXT");
    expect(jobsTable).toContain("extracted_json TEXT");
    expect(jobsTable).toContain("error TEXT");
  });

  it("creates translation_cache table", async () => {
    await runMigrations();

    const queries = mockQuery.mock.calls.map((c: unknown[]) => (c as string[])[0]);
    const cacheTable = queries.find((q: string) => q.includes("translation_cache"));
    expect(cacheTable).toBeDefined();
    expect(cacheTable).toContain("source_text TEXT PRIMARY KEY");
    expect(cacheTable).toContain("et TEXT");
    expect(cacheTable).toContain("lv TEXT");
    expect(cacheTable).toContain("lt TEXT");
  });

  it("creates leads table", async () => {
    await runMigrations();

    const queries = mockQuery.mock.calls.map((c: unknown[]) => (c as string[])[0]);
    const leadsTable = queries.find((q: string) => q.includes("CREATE TABLE IF NOT EXISTS leads"));
    expect(leadsTable).toBeDefined();
    expect(leadsTable).toContain("email TEXT NOT NULL UNIQUE");
    expect(leadsTable).toContain("source TEXT");
    expect(leadsTable).toContain("user_agent TEXT");
    expect(leadsTable).toContain("referrer TEXT");
    expect(leadsTable).toContain("ip_address TEXT");
  });

  it("creates all required indexes", async () => {
    await runMigrations();

    const queries = mockQuery.mock.calls.map((c: unknown[]) => (c as string[])[0]);
    const indexQueries = queries.filter((q: string) => q.includes("CREATE INDEX"));
    expect(indexQueries.length).toBeGreaterThanOrEqual(4);

    const stateIdx = indexQueries.find((q: string) => q.includes("idx_jobs_state"));
    expect(stateIdx).toBeDefined();
    expect(stateIdx).toContain("IF NOT EXISTS");

    const createdIdx = indexQueries.find((q: string) => q.includes("idx_jobs_created_at"));
    expect(createdIdx).toBeDefined();

    const pollIdx = indexQueries.find((q: string) => q.includes("idx_jobs_poll"));
    expect(pollIdx).toBeDefined();
    expect(pollIdx).toContain("state, created_at");

    const leadsIdx = indexQueries.find((q: string) => q.includes("idx_leads_created_at"));
    expect(leadsIdx).toBeDefined();
  });

  it("uses IF NOT EXISTS for idempotency", async () => {
    await runMigrations();

    const queries = mockQuery.mock.calls.map((c: unknown[]) => (c as string[])[0]);
    const tableQueries = queries.filter((q: string) => q.includes("CREATE TABLE"));
    for (const q of tableQueries) {
      expect(q).toContain("IF NOT EXISTS");
    }
  });

  it("releases client after migration", async () => {
    await runMigrations();

    expect(mockRelease).toHaveBeenCalled();
  });
});
