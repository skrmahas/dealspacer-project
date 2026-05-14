import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job, JobState } from "@bei/shared";
import type { JobStore } from "./store.js";
import { processJob } from "./orchestrator.js";

function createMockStore() {
  const jobs = new Map<string, Job>();
  return {
    jobs,
    async createJob(input: { originalFilename: string }): Promise<Job> {
      const job: Job = {
        id: crypto.randomUUID(),
        state: "pending",
        originalFilename: input.originalFilename,
        extractedText: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(job.id, job);
      return job;
    },
    async getJob(id: string) {
      return jobs.get(id) ?? null;
    },
    async updateJob(id: string, input: { state?: JobState; extractedText?: string; error?: string }) {
      const job = jobs.get(id);
      if (!job) throw new Error("Job not found");
      Object.assign(job, input, { updatedAt: new Date().toISOString() });
      return job;
    },
    async pollNextPending() {
      for (const job of jobs.values()) {
        if (job.state === "pending") return job;
      }
      return null;
    },
  } satisfies JobStore;
}

describe("processJob", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  it("transitions pending → parsing → complete on success", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockResolvedValue("Extracted financial data");

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf);

    expect(states).toEqual(["parsing", "complete"]);
    expect(readFile).toHaveBeenCalledWith(job.id);

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("complete");
    expect(updated!.extractedText).toBe("Extracted financial data");
  });

  it("transitions pending → parsing → failed on parse error", async () => {
    const job = await store.createJob({ originalFilename: "bad.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockRejectedValue(new Error("PDF corrupt"));

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf);

    expect(states).toEqual(["parsing", "failed"]);

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("PDF corrupt");
  });
});
