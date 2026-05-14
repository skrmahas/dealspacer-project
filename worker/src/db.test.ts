import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: vi.fn(function(this:any){this.query=mockQuery;this.on=vi.fn();this.end=vi.fn();}) } }));
import { getPendingJob, completeJob, failJob } from "./db.js";

describe("Job Orchestrator — State Transitions", () => {
  beforeEach(() => mockQuery.mockReset());
  it("claims pending job and sets state to parsing", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "abc", original_filename: "r.pdf", file_path: "/p" }] });
    const job = await getPendingJob();
    expect(job).not.toBeNull();
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain("state = 'parsing'");
    expect(sql).toContain("WHERE state = 'pending'");
    expect(sql).toContain("SKIP LOCKED");
  });
  it("returns null when no pending jobs", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPendingJob()).toBeNull();
  });
  it("sets state to complete", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await completeJob("abc", "text");
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("state = 'complete'");
    expect(params[0]).toBe("abc");
    expect(params[1]).toBe("text");
  });
  it("sets state to failed", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await failJob("abc", "err");
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("state = 'failed'");
    expect(params[0]).toBe("abc");
    expect(params[1]).toBe("err");
  });
  it("pending→parsing→complete transition chain", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "t1", original_filename: "f.pdf", file_path: "/p" }] });
    expect(await getPendingJob()).not.toBeNull();
    expect(mockQuery.mock.calls[0][0]).toContain("state = 'parsing'");
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await completeJob("t1", "x");
    expect(mockQuery.mock.calls[1][0]).toContain("state = 'complete'");
  });
  it("pending→parsing→failed transition chain", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "t2", original_filename: "f.pdf", file_path: "/p" }] });
    expect(await getPendingJob()).not.toBeNull();
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await failJob("t2", "x");
    expect(mockQuery.mock.calls[1][0]).toContain("state = 'failed'");
  });
});
