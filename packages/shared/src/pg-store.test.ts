import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPostgresStore, createPostgresFileStore, createCompanyStore, createReportStore, DuplicateReportError } from "./pg-store";
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
  it("listCompanies returns companies ordered by exchange then name with real report counts", async () => {
    const rows = [
      { id: "1", name: "Tallink", ticker: "TAL", exchange: "Nasdaq Tallinn", slug: "tallink", country: "EE", sector: "Industrials", report_count: 4, created_at: "2024-01-01", updated_at: "2024-01-01" },
      { id: "2", name: "LHV", ticker: "LHV", exchange: "Nasdaq Tallinn", slug: "lhv", country: "EE", sector: "Financials", report_count: 7, created_at: "2024-01-01", updated_at: "2024-01-01" },
      { id: "3", name: "Olainfarm", ticker: "OLF", exchange: "Nasdaq Riga", slug: "olainfarm", country: "LV", sector: "Health Care", report_count: 2, created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];
    const { query } = setupWithClient(rows);

    const store = createCompanyStore();
    const companies = await store.listCompanies();

    expect(companies).toHaveLength(3);
    expect(companies[0].name).toBe("Tallink");
    expect(companies[1].name).toBe("LHV");
    expect(companies[2].name).toBe("Olainfarm");
    expect(companies[0].reportCount).toBe(4);
    expect(companies[1].reportCount).toBe(7);
    expect(companies[2].reportCount).toBe(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY exchange, name"),
    );
    expect(query.mock.calls[0][0]).toContain("SELECT COUNT(*)");
    expect(query.mock.calls[0][0]).toContain("FROM reports");
  });

  it("getCompanyBySlug returns the correct company with real report counts", async () => {
    const rows = [
      { id: "1", name: "Tallink", ticker: "TAL", exchange: "Nasdaq Tallinn", slug: "tallink", country: "EE", sector: "Industrials", report_count: 6, created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];
    const { query } = setupWithClient(rows);

    const store = createCompanyStore();
    const company = await store.getCompanyBySlug("tallink");

    expect(company).not.toBeNull();
    expect(company!.name).toBe("Tallink");
    expect(company!.slug).toBe("tallink");
    expect(company!.reportCount).toBe(6);
    expect(query.mock.calls[0][0]).toContain("SELECT COUNT(*)");
    expect(query.mock.calls[0][0]).toContain("FROM reports");
  });

  it("getCompanyBySlug returns null for unknown slug", async () => {
    setupWithClient([]);

    const store = createCompanyStore();
    const company = await store.getCompanyBySlug("nonexistent");

    expect(company).toBeNull();
  });

  it("countCompanies returns the company total without loading rows", async () => {
    const { query } = setupWithClient([{ total: 3 }]);

    const store = createCompanyStore();
    const count = await store.countCompanies();

    expect(count).toBe(3);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*)::int AS total FROM companies"),
    );
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

describe("createReportStore", () => {
  it("createReport inserts and returns a report", async () => {
    const rows = [{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "annual", language: "en", job_id: null, s3_key: "r1-report.pdf", extracted_json_snapshot: null, created_at: "2024-01-01" }];
    const { query } = setupWithClient(rows);
    const store = createReportStore();
    const report = await store.createReport({
      fiscalYear: 2024, reportType: "annual", language: "en", s3Key: "r1-report.pdf",
    });
    expect(report.fiscalYear).toBe(2024);
    expect(report.reportType).toBe("annual");
  });

  it("createReport throws DuplicateReportError on unique violation", async () => {
    const err: any = new Error("duplicate key");
    err.code = "23505";
    const query = vi.fn().mockRejectedValue(err);
    vi.mocked(db.withClient).mockImplementationOnce(
      async (fn: (c: any) => Promise<unknown>) => fn({ query }),
    );
    const store = createReportStore();
    await expect(
      store.createReport({ fiscalYear: 2024, reportType: "annual", language: "en", s3Key: "dup.pdf" }),
    ).rejects.toThrow(DuplicateReportError);
  });

  it("getReportById returns report or null", async () => {
    const rows = [{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "q4", language: "en", job_id: null, s3_key: "r1.pdf", extracted_json_snapshot: null, created_at: "2024-01-01" }];
    setupWithClient(rows);
    const store = createReportStore();
    expect(await store.getReportById("r1")).not.toBeNull();
    setupWithClient([]);
    expect(await store.getReportById("nonexistent")).toBeNull();
  });

  it("getReportByJobId finds by job_id", async () => {
    setupWithClient([{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "annual", language: "en", job_id: "job-1", s3_key: "r1.pdf", extracted_json_snapshot: null, created_at: "2024-01-01" }]);
    const store = createReportStore();
    const r = await store.getReportByJobId("job-1");
    expect(r).not.toBeNull();
    expect(r!.jobId).toBe("job-1");
  });

  it("listReportsByCompany returns chronological with metric previews", async () => {
    const snapshot = { metadata: { companyName: "ACME", reportPeriod: "2024", sourceLanguage: "en" }, metrics: [{ label: "Revenue", value: 100, unit: "EUR" }, { label: "EBITDA", value: 40, unit: "EUR" }, { label: "Free Cash Flow", value: 25, unit: "EUR" }], narratives: [], sentiment: { managementTone: "positive", outlook: "Good", riskFactors: [], guidanceDirection: "raised" } };
    const rows = [{ id: "r1", company_id: "c1", fiscal_year: 2024, report_type: "annual", language: "en", job_id: null, s3_key: "r1.pdf", extracted_json_snapshot: JSON.stringify(snapshot), created_at: "2024-01-01", company_name: "ACME" }];
    setupWithClient(rows);
    const store = createReportStore();
    const reports = await store.listReportsByCompany("c1");
    expect(reports).toHaveLength(1);
    expect(reports[0].companyName).toBe("ACME");
    expect(reports[0].previewRevenue).toBe(100);
    expect(reports[0].previewEbitda).toBe(40);
    expect(reports[0].previewNetProfit).toBeNull();
    expect(reports[0].previewFcf).toBe(25);
  });

  it("normalizes preview metrics from stated units", async () => {
    const snapshot = {
      metadata: { companyName: "Arco", reportPeriod: "Q1 2026", sourceLanguage: "en" },
      metrics: [
        { label: "Revenue", value: 0.39, unit: "EUR m" },
        { label: "Net profit/loss", value: -0.578, unit: "EUR m" },
      ],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    };
    const rows = [
      {
        id: "r1",
        company_id: "c1",
        fiscal_year: 2026,
        report_type: "q1",
        language: "en",
        job_id: null,
        s3_key: "r1.pdf",
        extracted_json_snapshot: JSON.stringify(snapshot),
        created_at: "2026-01-01",
        company_name: "Arco",
      },
    ];
    setupWithClient(rows);
    const store = createReportStore();
    const reports = await store.listReportsByCompany("c1");
    expect(reports[0].previewRevenue).toBe(390_000);
    expect(reports[0].previewNetProfit).toBe(-578_000);
  });

  it("listUnmatchedReports returns only null company_id", async () => {
    setupWithClient([{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "annual", language: "en", job_id: null, s3_key: "r1.pdf", extracted_json_snapshot: null, created_at: "2024-01-01" }]);
    const store = createReportStore();
    const reports = await store.listUnmatchedReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].companyId).toBeNull();
  });

  it("countProcessedReports returns all processed report rows without loading them", async () => {
    const { query } = setupWithClient([{ total: 15 }]);

    const store = createReportStore();
    const count = await store.countProcessedReports();

    expect(count).toBe(15);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*)::int AS total FROM reports"),
    );
    expect(query.mock.calls[0][0]).not.toContain("company_id IS NOT NULL");
  });

  it("updateReportCompany maps unmatched to company", async () => {
    setupWithClient([{ id: "r1", company_id: "c1", fiscal_year: 2024, report_type: "annual", language: "en", job_id: null, s3_key: "r1.pdf", extracted_json_snapshot: null, created_at: "2024-01-01" }]);
    const store = createReportStore();
    const r = await store.updateReportCompany("r1", "c1");
    expect(r.companyId).toBe("c1");
  });

  it("replaceReport updates job, s3 key, and snapshot", async () => {
    const snap = { metadata: { companyName: "X", reportPeriod: "2025", sourceLanguage: "en" }, metrics: [], narratives: [], sentiment: { managementTone: "", outlook: "", riskFactors: [] } };
    setupWithClient([{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "annual", language: "en", job_id: "j2", s3_key: "new.pdf", extracted_json_snapshot: JSON.stringify(snap), created_at: "2024-01-01" }]);
    const store = createReportStore();
    const r = await store.replaceReport("r1", "j2", "new.pdf", snap);
    expect(r.jobId).toBe("j2");
    expect(r.s3Key).toBe("new.pdf");
  });

  it("createReportRerunCandidate stores successful reruns separately from public reports", async () => {
    const snap = { metadata: { companyName: "X", reportPeriod: "2025", sourceLanguage: "en" }, metrics: [], narratives: [], sentiment: { managementTone: "", outlook: "", riskFactors: [] } };
    const { query } = setupWithClient([{
      id: "candidate-1",
      report_id: "r1",
      job_id: "j2",
      s3_key: "reports/j2.pdf",
      extracted_json_snapshot: JSON.stringify(snap),
      status: "pending_review",
      quality_warnings: [],
      created_at: "2024-01-01",
      approved_at: null,
    }]);

    const store = createReportStore();
    const candidate = await store.createReportRerunCandidate({
      reportId: "r1",
      jobId: "j2",
      s3Key: "reports/j2.pdf",
      extractedJsonSnapshot: snap,
    });

    expect(candidate.status).toBe("pending_review");
    expect(candidate.reportId).toBe("r1");
    expect(query.mock.calls[0][0]).toContain("INSERT INTO report_rerun_candidates");
    expect(query.mock.calls[0][0]).not.toContain("UPDATE reports");
  });

  it("createReportRerunCandidate stores failed-quality reruns with warnings", async () => {
    const snap = { metadata: { companyName: "X", reportPeriod: "2025", sourceLanguage: "en" }, metrics: [], narratives: [], sentiment: { managementTone: "", outlook: "", riskFactors: [] } };
    setupWithClient([{
      id: "candidate-1",
      report_id: "r1",
      job_id: "j2",
      s3_key: "reports/j2.pdf",
      extracted_json_snapshot: JSON.stringify(snap),
      status: "failed_quality",
      quality_warnings: JSON.stringify(["Report sanity check failed"]),
      created_at: "2024-01-01",
      approved_at: null,
    }]);

    const store = createReportStore();
    const candidate = await store.createReportRerunCandidate({
      reportId: "r1",
      jobId: "j2",
      s3Key: "reports/j2.pdf",
      extractedJsonSnapshot: snap,
      status: "failed_quality",
      qualityWarnings: ["Report sanity check failed"],
    });

    expect(candidate.status).toBe("failed_quality");
    expect(candidate.qualityWarnings).toEqual(["Report sanity check failed"]);
  });

  it("promoteReportRerunCandidate approves the candidate and replaces the public report", async () => {
    const snap = { metadata: { companyName: "X", reportPeriod: "2025", sourceLanguage: "en" }, metrics: [], narratives: [], sentiment: { managementTone: "", outlook: "", riskFactors: [] } };
    const candidateRow = {
      id: "candidate-1",
      report_id: "r1",
      job_id: "j2",
      s3_key: "reports/j2.pdf",
      extracted_json_snapshot: JSON.stringify(snap),
      status: "pending_review",
      quality_warnings: [],
      created_at: "2024-01-01",
      approved_at: null,
    };
    const reportRow = {
      id: "r1",
      company_id: "c1",
      fiscal_year: 2025,
      report_type: "annual",
      language: "en",
      job_id: "j2",
      s3_key: "reports/j2.pdf",
      extracted_json_snapshot: JSON.stringify(snap),
      created_at: "2024-01-01",
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [candidateRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [reportRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(db.withClient).mockImplementationOnce(
      async (fn: (c: any) => Promise<unknown>) => fn({ query }),
    );

    const store = createReportStore();
    const report = await store.promoteReportRerunCandidate("candidate-1");

    expect(report.jobId).toBe("j2");
    expect(report.s3Key).toBe("reports/j2.pdf");
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "BEGIN",
      expect.stringContaining("FOR UPDATE"),
      expect.stringContaining("UPDATE reports"),
      expect.stringContaining("UPDATE report_rerun_candidates"),
      "COMMIT",
    ]);
  });

  it("listRecentReports returns limited results", async () => {
    setupWithClient([{ id: "r1", company_id: null, fiscal_year: 2024, report_type: "annual", language: "en", job_id: null, s3_key: "r1.pdf", extracted_json_snapshot: null, created_at: "2024-01-01", company_name: null }]);
    const store = createReportStore();
    const reports = await store.listRecentReports(8);
    expect(reports).toHaveLength(1);
  });

  it("listReportsForCompare returns joined company slug and respects limit", async () => {
    setupWithClient([
      {
        id: "r1",
        company_id: "c1",
        fiscal_year: 2024,
        report_type: "annual",
        language: "en",
        job_id: null,
        s3_key: "r1.pdf",
        extracted_json_snapshot: null,
        created_at: "2024-01-01",
        company_name: "Tallink",
        company_slug: "tallink",
      },
    ]);
    const store = createReportStore();
    const reports = await store.listReportsForCompare({ limit: 10 });
    expect(reports).toHaveLength(1);
    expect(reports[0].companyName).toBe("Tallink");
    expect(reports[0].companySlug).toBe("tallink");
  });
});
