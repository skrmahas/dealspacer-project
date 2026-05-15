import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPostgresStore, createPostgresFileStore, createCompanyStore } from "./pg-store";
import * as db from "./db";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Mock the db module
vi.mock("./db", () => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockClient = { query: mockQuery, release: mockRelease };
  const actual = vi.importActual("./db");

  return {
    getPool: vi.fn().mockReturnValue({ connect: vi.fn().mockResolvedValue(mockClient) }),
    closePool: vi.fn(),
    withClient: vi.fn(),
  };
});

function setupWithClient(rows: Record<string, unknown>[], rowCount = rows.length) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount });
  const client = { query, release: vi.fn() };
  (db.withClient as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (c: typeof client) => Promise<unknown>) => fn(client),
  );
  return client;
}

describe("createPostgresStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createJob", () => {
    it("creates a job with default state and language", async () => {
      const row = {
        id: "test-id-1",
        state: "pending",
        original_filename: "report.pdf",
        output_language: "en",
        extracted_text: null,
        extracted_json: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      const client = setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.createJob({ originalFilename: "report.pdf" });

      expect(job.id).toBe("test-id-1");
      expect(job.state).toBe("pending");
      expect(job.originalFilename).toBe("report.pdf");
      expect(job.outputLanguage).toBe("en");
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][0]).toContain("INSERT INTO jobs");
    });

    it("creates a job with custom output language", async () => {
      const row = {
        id: "test-id-2",
        state: "pending",
        original_filename: "report.pdf",
        output_language: "lt",
        extracted_text: null,
        extracted_json: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.createJob({ originalFilename: "report.pdf", outputLanguage: "lt" });

      expect(job.outputLanguage).toBe("lt");
    });
  });

  describe("getJob", () => {
    it("returns a job by ID", async () => {
      const row = {
        id: "job-1",
        state: "complete",
        original_filename: "test.pdf",
        output_language: "en",
        extracted_text: "some text",
        extracted_json: '{"key":"value"}',
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };
      setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.getJob("job-1");

      expect(job).not.toBeNull();
      expect(job!.id).toBe("job-1");
      expect(job!.state).toBe("complete");
      expect(job!.extractedText).toBe("some text");
    });

    it("returns null for non-existent job", async () => {
      setupWithClient([]);
      const store = createPostgresStore();

      const job = await store.getJob("nonexistent");

      expect(job).toBeNull();
    });
  });

  describe("updateJob", () => {
    it("updates job state", async () => {
      const row = {
        id: "job-1",
        state: "extracting",
        original_filename: "test.pdf",
        output_language: "en",
        extracted_text: null,
        extracted_json: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };
      const client = setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.updateJob("job-1", { state: "extracting" });

      expect(job.state).toBe("extracting");
      expect(client.query.mock.calls[0][0]).toContain("state = $");
    });

    it("updates multiple fields", async () => {
      const row = {
        id: "job-1",
        state: "failed",
        original_filename: "test.pdf",
        output_language: "en",
        extracted_text: null,
        extracted_json: null,
        error: "something broke",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };
      const client = setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.updateJob("job-1", {
        state: "failed",
        error: "something broke",
      });

      expect(job.state).toBe("failed");
      expect(job.error).toBe("something broke");
      // Should include both state and error in the UPDATE
      const sql = client.query.mock.calls[0][0] as string;
      expect(sql).toContain("state = $");
      expect(sql).toContain("error = $");
    });

    it("throws when job not found", async () => {
      setupWithClient([]);
      const store = createPostgresStore();

      await expect(
        store.updateJob("missing", { state: "extracting" }),
      ).rejects.toThrow("not found");
    });

    it("clears fields when null is passed", async () => {
      const row = {
        id: "job-1",
        state: "pending",
        original_filename: "test.pdf",
        output_language: "en",
        extracted_text: null,
        extracted_json: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };
      const client = setupWithClient([row]);
      const store = createPostgresStore();

      await store.updateJob("job-1", { error: null });

      const sql = client.query.mock.calls[0][0] as string;
      expect(sql).toContain("error = $");
      // null should be passed as the parameter value
      expect(client.query.mock.calls[0][1]).toContain(null);
    });
  });

  describe("pollNextPending", () => {
    it("returns and locks the oldest pending job", async () => {
      const row = {
        id: "oldest-job",
        state: "parsing",
        original_filename: "old.pdf",
        output_language: "en",
        extracted_text: null,
        extracted_json: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };
      const client = setupWithClient([row]);
      const store = createPostgresStore();

      const job = await store.pollNextPending();

      expect(job).not.toBeNull();
      expect(job!.id).toBe("oldest-job");
      expect(job!.state).toBe("parsing");
      const sql = client.query.mock.calls[0][0] as string;
      expect(sql).toContain("FOR UPDATE SKIP LOCKED");
      expect(sql).toContain("ORDER BY created_at ASC");
    });

    it("returns null when no pending jobs exist", async () => {
      setupWithClient([]);
      const store = createPostgresStore();

      const job = await store.pollNextPending();

      expect(job).toBeNull();
    });
  });

  describe("resetStaleJobs", () => {
    it("resets stale in-progress jobs to pending", async () => {
      const client = setupWithClient([], 3);
      const store = createPostgresStore();

      const count = await store.resetStaleJobs!(30000);

      expect(count).toBe(3);
      const sql = client.query.mock.calls[0][0] as string;
      expect(sql).toContain("state = ANY");
      expect(sql).toContain("INTERVAL '1 millisecond'");
    });

    it("returns 0 when no stale jobs found", async () => {
      setupWithClient([], 0);
      const store = createPostgresStore();

      const count = await store.resetStaleJobs!(30000);

      expect(count).toBe(0);
    });
  });

  describe("getCachedTranslations", () => {
    it("returns cached translations as a Map", async () => {
      const rows = [
        {
          source_text: "Revenue",
          et: "Käive",
          lv: "Ieņēmumi",
          lt: "Pajamos",
        },
        {
          source_text: "EBITDA",
          et: null,
          lv: null,
          lt: null,
        },
      ];
      setupWithClient(rows);
      const store = createPostgresStore();

      const result = await store.getCachedTranslations(["Revenue", "EBITDA"]);

      expect(result.size).toBe(2);
      expect(result.get("Revenue")?.et).toBe("Käive");
      expect(result.get("EBITDA")?.et).toBeNull();
    });

    it("returns empty Map for empty input", async () => {
      const store = createPostgresStore();

      const result = await store.getCachedTranslations([]);

      expect(result.size).toBe(0);
    });
  });

  describe("saveCachedTranslations", () => {
    it("batches multiple entries into a single INSERT", async () => {
      const client = setupWithClient([]);
      const store = createPostgresStore();

      await store.saveCachedTranslations([
        { sourceText: "Revenue", et: "Käive", lv: null, lt: null },
        { sourceText: "EBITDA", et: "Ärikasum", lv: null, lt: null },
      ]);

      expect(client.query).toHaveBeenCalledTimes(1);
      const sql = client.query.mock.calls[0][0] as string;
      // Multi-row VALUES
      expect(sql).toContain("VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)");
      expect(sql).toContain("ON CONFLICT (source_text)");
      expect(sql).toContain("COALESCE");
    });

    it("does nothing for empty entries", async () => {
      const client = setupWithClient([]);
      const store = createPostgresStore();

      await store.saveCachedTranslations([]);

      expect(client.query).not.toHaveBeenCalled();
    });
  });

  describe("deleteOldJobs", () => {
    it("deletes old terminal jobs and returns count", async () => {
      // First query: count terminal jobs
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: "150" }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 50 }),
        release: vi.fn(),
      };
      (db.withClient as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (c: typeof client) => Promise<unknown>) => fn(client),
      );
      const store = createPostgresStore();

      const deleted = await store.deleteOldJobs!(7 * 24 * 60 * 60 * 1000, 100);

      expect(deleted).toBe(50);
    });

    it("returns 0 when total terminal jobs <= minCount", async () => {
      const client = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ total: "30" }], rowCount: 1 }),
        release: vi.fn(),
      };
      (db.withClient as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (c: typeof client) => Promise<unknown>) => fn(client),
      );
      const store = createPostgresStore();

      const deleted = await store.deleteOldJobs!(7 * 24 * 60 * 60 * 1000, 50);

      expect(deleted).toBe(0);
    });
  });
});

describe("createPostgresFileStore", () => {
  it("delegates to auto file store (disk mode)", async () => {
    const oldBucket = process.env.S3_BUCKET;
    delete process.env.S3_BUCKET;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bei-pgfs-test-"));
    process.env.DATA_DIR = tmpDir;

    try {
      const fileStore = createPostgresFileStore();

      const buffer = Buffer.from("test content");
      await fileStore.saveFile("pgfs-test", buffer);
      const result = await fileStore.readFile("pgfs-test");

      expect(result.toString()).toBe("test content");
    } finally {
      if (oldBucket) process.env.S3_BUCKET = oldBucket;
      delete process.env.DATA_DIR;
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe("createCompanyStore", () => {
  it("listCompanies returns companies ordered by exchange then name", async () => {
    const rows = [
      { id: "1", name: "Tallink", ticker: "TAL", exchange: "Nasdaq Tallinn", slug: "tallink", country: "EE", sector: "Industrials", report_count: 0, created_at: "2024-01-01", updated_at: "2024-01-01" },
      { id: "2", name: "LHV", ticker: "LHV", exchange: "Nasdaq Tallinn", slug: "lhv", country: "EE", sector: "Financials", report_count: 0, created_at: "2024-01-01", updated_at: "2024-01-01" },
      { id: "3", name: "Olainfarm", ticker: "OLF", exchange: "Nasdaq Riga", slug: "olainfarm", country: "LV", sector: "Health Care", report_count: 0, created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];
    const { query } = setupWithClient(rows);

    const store = createCompanyStore();
    const companies = await store.listCompanies();

    expect(companies).toHaveLength(3);
    expect(companies[0].name).toBe("Tallink");
    expect(companies[1].name).toBe("LHV");
    expect(companies[2].name).toBe("Olainfarm");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY exchange, name"),
    );
  });

  it("getCompanyBySlug returns the correct company", async () => {
    const rows = [
      { id: "1", name: "Tallink", ticker: "TAL", exchange: "Nasdaq Tallinn", slug: "tallink", country: "EE", sector: "Industrials", report_count: 0, created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];
    setupWithClient(rows);

    const store = createCompanyStore();
    const company = await store.getCompanyBySlug("tallink");

    expect(company).not.toBeNull();
    expect(company!.name).toBe("Tallink");
    expect(company!.slug).toBe("tallink");
    expect(company!.reportCount).toBe(0);
  });

  it("getCompanyBySlug returns null for unknown slug", async () => {
    setupWithClient([]);

    const store = createCompanyStore();
    const company = await store.getCompanyBySlug("nonexistent");

    expect(company).toBeNull();
  });

  it("createCompany inserts and returns company with reportCount 0", async () => {
    const rows = [
      { id: "new", name: "TestCo", ticker: "TST", exchange: "Nasdaq Tallinn", slug: "testco", country: "EE", sector: "Tech", created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];
    const { query } = setupWithClient(rows);

    const store = createCompanyStore();
    const company = await store.createCompany({
      name: "TestCo", exchange: "Nasdaq Tallinn", slug: "testco", ticker: "TST", country: "EE", sector: "Tech",
    });

    expect(company.name).toBe("TestCo");
    expect(company.slug).toBe("testco");
    expect(company.reportCount).toBe(0);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (slug)"),
      expect.arrayContaining(["TestCo", "TST", "Nasdaq Tallinn", "testco"]),
    );
  });

  it("listCompanies returns empty array when no companies exist", async () => {
    setupWithClient([]);
    const store = createCompanyStore();
    const companies = await store.listCompanies();
    expect(companies).toHaveLength(0);
  });
});
