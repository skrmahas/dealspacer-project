import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startWorker } from "./worker.js";
import type { Job, JobState } from "@bei/shared";
import type { JobStore } from "./store.js";

function createMockStore(jobs: Job[] = []) {
  const map = new Map(jobs.map((j) => [j.id, j]));
  return {
    async pollNextPending() {
      for (const job of map.values()) {
        if (job.state === "pending") return job;
      }
      return null;
    },
    async updateJob(id: string, input: { state?: JobState }) {
      const job = map.get(id);
      if (!job) throw new Error("not found");
      Object.assign(job, input);
      return job;
    },
    async createJob() {
      throw new Error("not used");
    },
    async getJob() {
      throw new Error("not used");
    },
  } satisfies JobStore;
}

describe("startWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls for pending jobs and processes them", async () => {
    const job: Job = {
      id: "job-1",
      state: "pending",
      originalFilename: "report.pdf",
      extractedText: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = createMockStore([job]);
    const processJob = vi.fn().mockImplementation(async (j: Job) => {
      await store.updateJob(j.id, { state: "parsing" });
    });

    const stop = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    // First poll happens immediately (before time advance)
    await vi.advanceTimersByTimeAsync(1);
    expect(processJob).toHaveBeenCalledTimes(1);

    // Job state should now be "parsing"
    expect(job.state).toBe("parsing");

    stop();
  });

  it("waits when no pending jobs are found", async () => {
    const store = createMockStore([]);
    const processJob = vi.fn();

    const stop = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(processJob).not.toHaveBeenCalled();

    stop();
  });

  it("processes multiple jobs in sequence", async () => {
    const job1: Job = {
      id: "job-1",
      state: "pending",
      originalFilename: "a.pdf",
      extractedText: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const job2: Job = {
      id: "job-2",
      state: "pending",
      originalFilename: "b.pdf",
      extractedText: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = createMockStore([job1, job2]);
    const processJob = vi.fn().mockImplementation(async (j: Job) => {
      await store.updateJob(j.id, { state: "parsing" });
    });

    const stop = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    // First poll runs immediately, picks job1
    await vi.advanceTimersByTimeAsync(1);
    expect(processJob).toHaveBeenCalledTimes(1);
    expect(job1.state).toBe("parsing");

    // Second poll: job1 is now "parsing" (not pending), so picks job2
    await vi.advanceTimersByTimeAsync(1000);
    expect(processJob).toHaveBeenCalledTimes(2);
    expect(job2.state).toBe("parsing");

    stop();
  });
});
