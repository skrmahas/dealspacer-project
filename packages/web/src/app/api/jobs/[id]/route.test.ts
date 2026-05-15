import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetJob = vi.fn();

vi.mock("@bei/shared", () => ({
  createPostgresStore: vi.fn(() => ({
    getJob: mockGetJob,
  })),
  createPostgresFileStore: vi.fn(),
  getPool: vi.fn(),
  closePool: vi.fn(),
}));

import { GET } from "./[id]/route";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    state: "complete",
    originalFilename: "report.pdf",
    outputLanguage: "en",
    extractedText: "some extracted text",
    extractedJson: '{"metrics":[]}',
    error: null,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-02",
    ...overrides,
  };
}

describe("GET /api/jobs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full data including extractedJson for complete job", async () => {
    mockGetJob.mockResolvedValue(makeJob());

    const response = await GET(new Request("http://localhost"), { params: { id: "job-1" } });
    const data = await response.json();

    expect(data.jobId).toBe("job-1");
    expect(data.state).toBe("complete");
    expect(data.extractedJson).toBe('{"metrics":[]}');
    expect(data.extractedText).toBe("some extracted text");
  });

  it("omits extractedJson and extractedText for in-progress job", async () => {
    mockGetJob.mockResolvedValue(makeJob({ state: "extracting" }));

    const response = await GET(new Request("http://localhost"), { params: { id: "job-1" } });
    const data = await response.json();

    expect(data.state).toBe("extracting");
    expect(data.extractedJson).toBeUndefined();
    expect(data.extractedText).toBeUndefined();
  });

  it("returns extractedJson and extractedText for failed job", async () => {
    mockGetJob.mockResolvedValue(makeJob({ state: "failed", error: "something broke", extractedJson: '{"error":true}' }));

    const response = await GET(new Request("http://localhost"), { params: { id: "job-1" } });
    const data = await response.json();

    expect(data.state).toBe("failed");
    expect(data.extractedJson).toBe('{"error":true}');
    expect(data.error).toBe("something broke");
  });

  it("returns 404 for missing job", async () => {
    mockGetJob.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), { params: { id: "missing" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });
});
