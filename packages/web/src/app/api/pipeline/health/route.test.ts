import { describe, expect, it, vi, beforeEach } from "vitest";

const queryMock = vi.fn();

vi.mock("@bei/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bei/shared")>();
  return {
    ...actual,
    getPool: () => ({ query: queryMock }),
  };
});

describe("GET /api/pipeline/health", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reports unhealthy when stale pending jobs exist with no recent activity", async () => {
    queryMock.mockResolvedValue({
      rows: [{ stale_pending_count: "12", recent_activity_count: "0" }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("worker_offline");
    expect(body.stalePendingCount).toBe(12);
  });

  it("reports healthy when worker recently processed jobs", async () => {
    queryMock.mockResolvedValue({
      rows: [{ stale_pending_count: "12", recent_activity_count: "2" }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
  });
});
