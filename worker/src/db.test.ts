import { describe, it, expect, vi, beforeEach } from "vitest";

// Use hoisted mock to share state between mock factory and tests
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("pg", () => ({
  default: {
    Pool: vi.fn(function (this: any) {
      this.query = mockQuery;
      this.on = vi.fn();
      this.end = vi.fn();
    }),
  },
}));

import { getPendingJob, completeJob, failJob } from "./db.js";

describe("Job Orchestrator — State Transitions", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("getPendingJob", () => {
    it("claims the oldest pending job and sets state to parsing", async () => {
      const mockJob = {
        id: "abc-123",
        original_filename: "report.pdf",
        file_path: "/uploads/report.pdf",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockJob] });

      const job = await getPendingJob();

      expect(job).toEqual(mockJob);
      expect(mockQuery).toHaveBeenCalledOnce();
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("UPDATE jobs");
      expect(sql).toContain("state = 'parsing'");
      expect(sql).toContain("WHERE state = 'pending'");
      expect(sql).toContain("SKIP LOCKED");
    });

    it("returns null when no pending jobs exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const job = await getPendingJob();

      expect(job).toBeNull();
    });
  });

  describe("completeJob", () => {
    it("sets state to complete with extracted text and timestamps", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await completeJob("abc-123", "Extracted earnings text here.");

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("state = 'complete'");
      expect(sql).toContain("extracted_text");
      expect(sql).toContain("completed_at = NOW()");
      expect(params[0]).toBe("abc-123");
      expect(params[1]).toBe("Extracted earnings text here.");
    });
  });

  describe("failJob", () => {
    it("sets state to failed with error message", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await failJob("abc-123", "PDF parsing failed: corrupt file");

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("state = 'failed'");
      expect(sql).toContain("error_message");
      expect(params[0]).toBe("abc-123");
      expect(params[1]).toBe("PDF parsing failed: corrupt file");
    });
  });

  describe("State machine integrity", () => {
    it("transition: pending → parsing (via getPendingJob)", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "t1", original_filename: "f.pdf", file_path: "/p" }],
      });

      const job = await getPendingJob();
      expect(job).not.toBeNull();

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("WHERE state = 'pending'");
      expect(sql).toContain("state = 'parsing'");
    });

    it("transition: parsing → complete (via completeJob)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await completeJob("t2", "sample text");

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("state = 'complete'");
      expect(sql).toContain("completed_at");
    });

    it("transition: parsing → failed (via failJob)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await failJob("t3", "error");

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("state = 'failed'");
    });
  });
});
