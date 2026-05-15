import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetJob = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock("@bei/shared", () => ({
  createPostgresStore: vi.fn(() => ({
    getJob: mockGetJob,
    createJob: vi.fn(),
    updateJob: vi.fn(),
    pollNextPending: vi.fn(),
    getCachedTranslations: vi.fn().mockResolvedValue(new Map()),
    saveCachedTranslations: vi.fn(),
  })),
  createPostgresFileStore: vi.fn(() => ({
    saveFile: vi.fn(),
    readFile: vi.fn(),
    saveReport: vi.fn(),
    readReport: vi.fn(),
  })),
  getPool: vi.fn(() => ({
    query: mockPoolQuery,
  })),
  closePool: vi.fn(),
}));

import { GET as getJobs } from "./route";
import { GET as getJob } from "./[id]/route";

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of jobs", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [
        { id: "job-1", state: "complete", original_filename: "a.pdf" },
        { id: "job-2", state: "pending", original_filename: "b.pdf" },
      ],
      rowCount: 2,
    });

    const response = await getJobs();
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].id).toBe("job-1");
  });

  it("returns empty array when no jobs exist", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const response = await getJobs();
    const data = await response.json();

    expect(data).toEqual([]);
  });
});

describe("GET /api/jobs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns job details for a found job", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-1",
      state: "complete",
      originalFilename: "report.pdf",
      outputLanguage: "en",
      extractedText: "text",
      extractedJson: '{"key":"val"}',
      error: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    });

    const response = await getJob(new Request("http://localhost"), { params: { id: "job-1" } });
    const data = await response.json();

    expect(data.jobId).toBe("job-1");
    expect(data.state).toBe("complete");
  });

  it("returns 404 for missing job", async () => {
    mockGetJob.mockResolvedValue(null);

    const response = await getJob(new Request("http://localhost"), { params: { id: "missing" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });
});
