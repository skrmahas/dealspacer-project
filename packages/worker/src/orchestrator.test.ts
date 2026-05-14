import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job, JobState, JobStore, ExtractedData } from "@bei/shared";
import { processJob } from "./orchestrator.js";

function mockExtraction(): ExtractedData {
  return {
    metadata: { companyName: "Test Co", reportPeriod: "2024", sourceLanguage: "en" },
    metrics: [{ label: "Revenue", value: 1000000, unit: "EUR" }],
    narratives: [{ section: "executive_summary", text: "Test summary text that is long enough to pass the meaningful text check." }],
    sentiment: { managementTone: "positive", outlook: "Good", riskFactors: ["None"] },
  };
}

function createMockStore() {
  const jobs = new Map<string, Job>();
  const store = {
    async createJob(input: { originalFilename: string }): Promise<Job> {
      const job: Job = {
        id: crypto.randomUUID(),
        state: "pending",
        originalFilename: input.originalFilename,
        extractedText: null,
        extractedJson: null,
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
    async updateJob(id: string, input: { state?: JobState; extractedText?: string; extractedJson?: string; error?: string }) {
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
  return store;
}

describe("processJob", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  it("transitions pending → parsing → extracting → assembling → complete on success", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockResolvedValue("Extracted financial data");
    const extractFromText = vi.fn().mockResolvedValue(mockExtraction());
    const assemblePdf = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const saveReport = vi.fn().mockResolvedValue(undefined);

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "assembling", "complete"]);
    expect(readFile).toHaveBeenCalledWith(job.id);
    expect(extractFromText).toHaveBeenCalledWith("Extracted financial data");
    expect(assemblePdf).toHaveBeenCalledWith(mockExtraction());
    expect(saveReport).toHaveBeenCalledWith(job.id, Buffer.from("fake pdf"));

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("complete");
    expect(updated!.extractedText).toBe("Extracted financial data");
    expect(updated!.extractedJson).toBe(JSON.stringify(mockExtraction()));
  });

  it("transitions pending → parsing → failed on parse error", async () => {
    const job = await store.createJob({ originalFilename: "bad.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockRejectedValue(new Error("PDF corrupt"));
    const extractFromText = vi.fn();
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "failed"]);
    expect(extractFromText).not.toHaveBeenCalled();
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("PDF corrupt");
  });

  it("transitions pending → parsing → extracting → failed on extraction error", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockResolvedValue("Some text");
    const extractFromText = vi.fn().mockRejectedValue(new Error("GPT-4o rate limit"));
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "failed"]);
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("GPT-4o rate limit");
  });

  it("transitions pending → parsing → extracting → assembling → failed on assembly error", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockResolvedValue("Some text");
    const extractFromText = vi.fn().mockResolvedValue(mockExtraction());
    const assemblePdf = vi.fn().mockRejectedValue(new Error("PDF rendering failed"));
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "assembling", "failed"]);
    expect(saveReport).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("PDF rendering failed");
  });

  it("fails with 'No financial data found' when extraction returns empty", async () => {
    const job = await store.createJob({ originalFilename: "not-financial.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parsePdf = vi.fn().mockResolvedValue("Some random text");
    const extractFromText = vi.fn().mockResolvedValue({
      metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
      metrics: [],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    } satisfies ExtractedData);
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "failed"]);
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("No financial data found in this document");
  });
});
