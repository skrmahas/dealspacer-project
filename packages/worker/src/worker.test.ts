import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startWorker } from "./worker.js";
import type { Job, JobState, JobStore, TranslationCacheEntry } from "@bei/shared";

const IN_PROGRESS_STATES: JobState[] = ["parsing", "extracting", "translating", "assembling"];

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
      job.updatedAt = new Date().toISOString();
      return job;
    },
    async resetStaleJobs(staleAfterMs: number) {
      const cutoff = Date.now() - staleAfterMs;
      let resetCount = 0;
      for (const job of map.values()) {
        if (!IN_PROGRESS_STATES.includes(job.state)) continue;
        const updatedAtMs = Date.parse(job.updatedAt);
        if (Number.isNaN(updatedAtMs) || updatedAtMs >= cutoff) continue;
        job.state = "pending";
        job.updatedAt = new Date().toISOString();
        resetCount++;
      }
      return resetCount;
    },
    async createJob() {
      throw new Error("not used");
    },
    async getJob() {
      throw new Error("not used");
    },
    async getCachedTranslations(_sourceTexts: string[]) {
      return new Map<string, TranslationCacheEntry>();
    },
    async saveCachedTranslations(_entries: TranslationCacheEntry[]) {},
    async deleteOldJobs(_retentionMs: number, _minCount: number) { return 0; },
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
      companyId: null,
      originalFilename: "report.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = createMockStore([job]);
    const processJob = vi.fn().mockImplementation(async (j: Job) => {
      await store.updateJob(j.id, { state: "parsing" });
    });

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    // First poll happens immediately (before time advance)
    await vi.advanceTimersByTimeAsync(1);
    expect(processJob).toHaveBeenCalledTimes(1);

    // Job state should now be "parsing"
    expect(job.state).toBe("parsing");

    worker.stop();
  });

  it("waits when no pending jobs are found", async () => {
    const store = createMockStore([]);
    const processJob = vi.fn();

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(processJob).not.toHaveBeenCalled();

    worker.stop();
  });

  it("processes multiple jobs in sequence", async () => {
    const job1: Job = {
      id: "job-1",
      state: "pending",
      companyId: null,
      originalFilename: "a.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const job2: Job = {
      id: "job-2",
      state: "pending",
      companyId: null,
      originalFilename: "b.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = createMockStore([job1, job2]);
    const processJob = vi.fn().mockImplementation(async (j: Job) => {
      await store.updateJob(j.id, { state: "parsing" });
    });

    const worker = startWorker({
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

    worker.stop();
  });

  it("resets stale in-progress jobs and they are picked up by poll loop", async () => {
    const staleJob: Job = {
      id: "job-stale",
      state: "extracting",
      companyId: null,
      originalFilename: "stale.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };
    const store = createMockStore([staleJob]);
    const processJob = vi.fn().mockImplementation(async (j: Job) => {
      await store.updateJob(j.id, { state: "parsing" });
    });

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 50,
      staleJobSweepIntervalMs: 20,
      staleJobThresholdMs: 30 * 60 * 1000,
    });

    await vi.advanceTimersByTimeAsync(250);

    expect(processJob).toHaveBeenCalledTimes(1);
    expect(staleJob.state).toBe("parsing");

    worker.stop();
  });

  it("does not reset terminal jobs", async () => {
    const completeJob: Job = {
      id: "job-complete",
      state: "complete",
      companyId: null,
      originalFilename: "complete.pdf",
      outputLanguage: "en",
      extractedText: "ok",
      extractedJson: "{}",
      error: null,
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };
    const failedJob: Job = {
      id: "job-failed",
      state: "failed",
      companyId: null,
      originalFilename: "failed.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: "boom",
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };
    const store = createMockStore([completeJob, failedJob]);
    const processJob = vi.fn();

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 50,
      staleJobSweepIntervalMs: 20,
      staleJobThresholdMs: 30 * 60 * 1000,
    });

    await vi.advanceTimersByTimeAsync(250);

    expect(processJob).not.toHaveBeenCalled();
    expect(completeJob.state).toBe("complete");
    expect(failedJob.state).toBe("failed");

    worker.stop();
  });

  it("does not reset recent in-progress jobs", async () => {
    const recentJob: Job = {
      id: "job-recent",
      state: "extracting",
      companyId: null,
      originalFilename: "recent.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    };
    const store = createMockStore([recentJob]);
    const processJob = vi.fn();

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 50,
      staleJobSweepIntervalMs: 20,
      staleJobThresholdMs: 30 * 60 * 1000,
    });

    await vi.advanceTimersByTimeAsync(250);

    expect(processJob).not.toHaveBeenCalled();
    expect(recentJob.state).toBe("extracting");

    worker.stop();
  });

  it("drain resolves immediately when no jobs are in flight", async () => {
    const store = createMockStore([]);
    const processJob = vi.fn();

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1);

    worker.stop();
    await expect(worker.drain(5000)).resolves.toBeUndefined();
  });

  it("drain waits for in-flight job to complete", async () => {
    const job: Job = {
      id: "job-1",
      state: "pending",
      companyId: null,
      originalFilename: "a.pdf",
      outputLanguage: "en",
      extractedText: null,
      extractedJson: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = createMockStore([job]);

    let jobResolve: (() => void) | null = null;
    const processJob = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        jobResolve = resolve;
      });
    });

    const worker = startWorker({
      store: store as JobStore,
      processJob,
      pollIntervalMs: 1000,
    });

    // Let the worker pick up the job and start processing
    await vi.advanceTimersByTimeAsync(1);
    expect(processJob).toHaveBeenCalledTimes(1);

    // Stop polling, start drain
    worker.stop();
    const drainPromise = worker.drain(5000);

    // Drain should not resolve yet — job still in flight
    let drained = false;
    drainPromise.then(() => { drained = true; });
    await vi.advanceTimersByTimeAsync(100);
    expect(drained).toBe(false);

    // Complete the in-flight job
    jobResolve!();
    await vi.advanceTimersByTimeAsync(1);
    await drainPromise;
    expect(drained).toBe(true);
  });
});
