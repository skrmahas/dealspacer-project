import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetJob,
  mockPoolQuery,
  mockCreateJob,
  mockUpdateJob,
  mockSaveFile,
} = vi.hoisted(() => ({
  mockGetJob: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockCreateJob: vi.fn(),
  mockUpdateJob: vi.fn(),
  mockSaveFile: vi.fn(),
}));

vi.mock("@bei/shared", () => ({
  createPostgresStore: vi.fn(() => ({
    getJob: mockGetJob,
    createJob: mockCreateJob,
    updateJob: mockUpdateJob,
    pollNextPending: vi.fn(),
    getCachedTranslations: vi.fn().mockResolvedValue(new Map()),
    saveCachedTranslations: vi.fn(),
  })),
  createAutoFileStore: vi.fn(() => ({
    saveFile: mockSaveFile,
    readFile: vi.fn(),
    saveReport: vi.fn(),
    readReport: vi.fn(),
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

import { GET as getJobs, POST as createJob } from "./route";
import { GET as getJob } from "./[id]/route";

function requestWithFormData(formData: FormData): Parameters<typeof createJob>[0] {
  return {
    formData: async () => formData,
  } as Parameters<typeof createJob>[0];
}

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

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateJob.mockResolvedValue({
      id: "job-upload",
      state: "pending",
      originalFilename: "report.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    });
    mockSaveFile.mockResolvedValue(undefined);
  });

  it("waits for file storage before returning the pending job", async () => {
    let releaseSave!: () => void;
    const saveStarted = new Promise<void>((resolve) => {
      mockSaveFile.mockImplementationOnce(async () => {
        resolve();
        await new Promise<void>((release) => {
          releaseSave = release;
        });
      });
    });

    const formData = new FormData();
    formData.set("file", new File([Buffer.from("%PDF-1.4\n")], "report.pdf", { type: "application/pdf" }));
    formData.set("outputLanguage", "en");

    const responsePromise = createJob(requestWithFormData(formData));

    await saveStarted;
    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);

    releaseSave();
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.jobId).toBe("job-upload");
    expect(mockSaveFile).toHaveBeenCalledWith("job-upload", expect.any(Buffer));
  });

  it("marks the job failed when file storage fails", async () => {
    mockSaveFile.mockRejectedValueOnce(new Error("S3 unavailable"));

    const formData = new FormData();
    formData.set("file", new File([Buffer.from("%PDF-1.4\n")], "report.pdf", { type: "application/pdf" }));

    const response = await createJob(requestWithFormData(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("File upload failed");
    expect(mockUpdateJob).toHaveBeenCalledWith("job-upload", {
      state: "failed",
      error: "File upload failed: S3 unavailable",
    });
  });
});
