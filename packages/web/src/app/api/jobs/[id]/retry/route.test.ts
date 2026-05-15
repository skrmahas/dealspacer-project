import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPostgresStore } from "@bei/shared";
import { POST } from "./route";

// Mock the store
vi.mock("@bei/shared", () => {
  const actual = vi.importActual("@bei/shared");
  return {
    ...actual,
    createPostgresStore: vi.fn(),
  };
});

function mockStore(job: Record<string, unknown> | null) {
  return {
    getJob: vi.fn().mockResolvedValue(job),
    updateJob: vi.fn().mockImplementation((_id: string, input: Record<string, unknown>) =>
      Promise.resolve({ id: _id, ...job, ...input }),
    ),
  };
}

describe("POST /api/jobs/:id/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets a failed job to pending", async () => {
    const store = mockStore({
      id: "job-1",
      state: "failed",
      originalFilename: "report.pdf",
      error: "Something went wrong",
      extractedText: "old text",
      extractedJson: '{"old": "data"}',
    });
    (createPostgresStore as ReturnType<typeof vi.fn>).mockReturnValue(store);

    const request = new Request("http://localhost/api/jobs/job-1/retry", { method: "POST" });
    const response = await POST(request as unknown as Request, { params: { id: "job-1" } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state).toBe("pending");

    expect(store.updateJob).toHaveBeenCalledWith("job-1", {
      state: "pending",
      error: null,
      extractedText: null,
      extractedJson: null,
    });
  });

  it("returns 404 for non-existent job", async () => {
    const store = mockStore(null);
    (createPostgresStore as ReturnType<typeof vi.fn>).mockReturnValue(store);

    const request = new Request("http://localhost/api/jobs/nonexistent/retry", { method: "POST" });
    const response = await POST(request as unknown as Request, { params: { id: "nonexistent" } });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 409 for non-failed job", async () => {
    const store = mockStore({
      id: "job-2",
      state: "complete",
      originalFilename: "report.pdf",
    });
    (createPostgresStore as ReturnType<typeof vi.fn>).mockReturnValue(store);

    const request = new Request("http://localhost/api/jobs/job-2/retry", { method: "POST" });
    const response = await POST(request as unknown as Request, { params: { id: "job-2" } });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("Only failed jobs");
  });
});
