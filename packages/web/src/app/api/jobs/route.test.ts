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
        {
          id: "job-1",
          state: "complete",
          original_filename: "a.pdf",
          output_language: "en",
          error: null,
          created_at: "2024-01-02",
          updated_at: "2024-01-03",
          report_id: "report-1",
        },
        {
          id: "job-2",
          state: "pending",
          original_filename: "b.pdf",
          output_language: "lt",
          error: null,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          report_id: null,
        },
      ],
      rowCount: 2,
    });

    const response = await getJobs();
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]).toEqual({
      jobId: "job-1",
      state: "complete",
      originalFilename: "a.pdf",
      outputLanguage: "en",
      error: null,
      createdAt: "2024-01-02",
      updatedAt: "2024-01-03",
      reportId: "report-1",
    });
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
    // The route now pre-generates the job id and inserts it explicitly, so
    // the mock must echo whichever id the route picked.
    mockCreateJob.mockImplementation(async (input) => ({
      id: input.id ?? "job-upload",
      state: "pending",
      originalFilename: input.originalFilename,
      outputLanguage: input.outputLanguage ?? "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    }));
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
    expect(body.jobId).toBeTypeOf("string");
    expect(mockSaveFile).toHaveBeenCalledWith(body.jobId, expect.any(Buffer));
  });

  // Regression test for the race condition that caused
  // "FAILED: The specified key does not exist." on large uploads:
  // the upload route MUST call saveFile before createJob, so the
  // worker's pollNextPending cannot claim the job before its file
  // is in storage.
  it("uploads the file to storage before persisting the job row", async () => {
    const callOrder: string[] = [];

    mockSaveFile.mockImplementationOnce(async () => {
      callOrder.push("saveFile");
    });
    mockCreateJob.mockImplementationOnce(async (input) => {
      callOrder.push("createJob");
      return {
        id: input.id,
        state: "pending",
        originalFilename: input.originalFilename,
        outputLanguage: input.outputLanguage ?? "en",
        extractedText: null,
        extractedJson: null,
        error: null,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };
    });

    const formData = new FormData();
    formData.set("file", new File([Buffer.from("%PDF-1.4\n")], "report.pdf", { type: "application/pdf" }));

    const response = await createJob(requestWithFormData(formData));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(callOrder).toEqual(["saveFile", "createJob"]);
    // The pre-generated id used for saveFile must equal the one inserted.
    const saveFileId = mockSaveFile.mock.calls[0][0];
    const createJobId = mockCreateJob.mock.calls[0][0].id;
    expect(saveFileId).toBe(createJobId);
    expect(body.jobId).toBe(saveFileId);
  });

  it("returns 500 without creating a job row when file storage fails", async () => {
    mockSaveFile.mockRejectedValueOnce(new Error("S3 unavailable"));

    const formData = new FormData();
    formData.set("file", new File([Buffer.from("%PDF-1.4\n")], "report.pdf", { type: "application/pdf" }));

    const response = await createJob(requestWithFormData(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("File upload failed");
    // No orphan job row: createJob must not have run, and there's nothing to
    // mark as failed.
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockUpdateJob).not.toHaveBeenCalled();
  });
});
