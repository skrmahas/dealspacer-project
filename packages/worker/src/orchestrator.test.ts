import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job, JobState, JobStore, ExtractedData, OutputLanguage, TranslationCacheEntry } from "@bei/shared";
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
    async createJob(input: { originalFilename: string; outputLanguage?: OutputLanguage }): Promise<Job> {
      const job: Job = {
        id: crypto.randomUUID(),
        state: "pending",
        originalFilename: input.originalFilename,
        outputLanguage: input.outputLanguage ?? "en",
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
    async getCachedTranslations(_sourceTexts: string[]) {
      return new Map<string, TranslationCacheEntry>();
    },
    async saveCachedTranslations(_entries: TranslationCacheEntry[]) {},
    async deleteOldJobs(_retentionMs: number, _minCount: number) { return 0; },
  } satisfies JobStore;
  return store;
}

describe("processJob", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  it("transitions pending → parsing → extracting → translating → assembling → complete on success", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf", outputLanguage: "lt" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Annual report extracted financial data showing revenue ebitda profit margins growth performance summary business overview segment results");
    const extractFromText = vi.fn().mockResolvedValue(mockExtraction());
    const translated = { ...mockExtraction(), metadata: { ...mockExtraction().metadata, outputLanguage: "lt" as const } };
    const translateExtractedData = vi.fn().mockResolvedValue(translated);
    const assemblePdf = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const saveReport = vi.fn().mockResolvedValue(undefined);

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "translating", "assembling", "complete"]);
    expect(readFile).toHaveBeenCalledWith(job.id);
    expect(parseDocument).toHaveBeenCalledWith(Buffer.from("fake pdf"), "report.pdf");
    expect(extractFromText).toHaveBeenCalled();
    expect(extractFromText.mock.calls[0][0]).toBe("Annual report extracted financial data showing revenue ebitda profit margins growth performance summary business overview segment results");
    expect(translateExtractedData).toHaveBeenCalledWith(mockExtraction(), "lt", store);
    expect(assemblePdf).toHaveBeenCalledWith(translated);
    expect(saveReport).toHaveBeenCalledWith(job.id, Buffer.from("fake pdf"));

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("complete");
    expect(updated!.extractedText).toBe("Annual report extracted financial data showing revenue ebitda profit margins growth performance summary business overview segment results");
    expect(updated!.extractedJson).toBe(JSON.stringify(translated));
  });

  it("transitions pending → parsing → failed on parse error", async () => {
    const job = await store.createJob({ originalFilename: "bad.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockRejectedValue(new Error("PDF corrupt"));
    const extractFromText = vi.fn();
    const translateExtractedData = vi.fn();
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "failed"]);
    expect(extractFromText).not.toHaveBeenCalled();
    expect(translateExtractedData).not.toHaveBeenCalled();
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("PDF corrupt");
  });

  it("transitions pending → parsing → extracting → failed on extraction error", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Annual report summary financial data revenue ebitda profit margins growth performance business overview segment results");
    const extractFromText = vi.fn().mockRejectedValue(new Error("GPT-4o rate limit"));
    const translateExtractedData = vi.fn();
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "failed"]);
    expect(translateExtractedData).not.toHaveBeenCalled();
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("GPT-4o rate limit");
  });

  it("transitions pending → parsing → extracting → translating → assembling → failed on assembly error", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Annual report summary financial data revenue ebitda profit margins growth performance business overview segment results");
    const extractFromText = vi.fn().mockResolvedValue(mockExtraction());
    const translateExtractedData = vi.fn().mockResolvedValue(mockExtraction());
    const assemblePdf = vi.fn().mockRejectedValue(new Error("PDF rendering failed"));
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "translating", "assembling", "failed"]);
    expect(saveReport).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("PDF rendering failed");
  });

  it("fails with 'No financial data found' when extraction returns empty", async () => {
    const job = await store.createJob({ originalFilename: "not-financial.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    // Must have 10+ unique 4-letter words to pass the classifier quality gate
    const parseDocument = vi.fn().mockResolvedValue(
      "annual report overview management summary company performance financial statements revenue ebitda profit presentation document business",
    );
    const extractFromText = vi.fn().mockResolvedValue({
      metadata: { companyName: "", reportPeriod: "", sourceLanguage: "" },
      metrics: [],
      narratives: [],
      sentiment: { managementTone: "", outlook: "", riskFactors: [] },
    } satisfies ExtractedData);
    const translateExtractedData = vi.fn();
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "extracting", "failed"]);
    expect(translateExtractedData).not.toHaveBeenCalled();
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toBe("No financial data found in this document");
  });

  it("rejects auditor reports with user-friendly message before extraction", async () => {
    const job = await store.createJob({ originalFilename: "kpmg-audit.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Independent Auditor's Report. We have audited the financial statements. In our opinion they present fairly...");
    const extractFromText = vi.fn();
    const translateExtractedData = vi.fn();
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    const states: JobState[] = [];
    const originalUpdate = store.updateJob;
    store.updateJob = vi.fn().mockImplementation(async (id, input) => {
      if (input.state) states.push(input.state);
      return originalUpdate(id, input);
    });

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    expect(states).toEqual(["parsing", "failed"]);
    // GPT-4o extraction should NOT be called for rejected documents
    expect(extractFromText).not.toHaveBeenCalled();
    expect(translateExtractedData).not.toHaveBeenCalled();
    expect(assemblePdf).not.toHaveBeenCalled();

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toContain("auditor's report");
  });

  it("fails job when translation throws an error", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Annual report summary financial data revenue ebitda profit margins growth performance business overview segment results");
    const extractFromText = vi.fn().mockResolvedValue({
      metadata: { companyName: "Test", reportPeriod: "Q1", sourceLanguage: "en" },
      metrics: [{ label: "Revenue", value: 100, unit: "EUR" }],
      narratives: [{ section: "executive_summary", text: "Good results with strong growth across all segments of the business." }],
      sentiment: { managementTone: "positive", outlook: "Good", riskFactors: [] },
    });
    const translateExtractedData = vi.fn().mockRejectedValue(new Error("Translation API error"));
    const assemblePdf = vi.fn();
    const saveReport = vi.fn();

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("failed");
    expect(updated!.error).toContain("Translation API error");
  });

  it("completes job successfully with sanitizer warnings (null metrics dropped)", async () => {
    const job = await store.createJob({ originalFilename: "report.pdf" });
    const readFile = vi.fn().mockResolvedValue(Buffer.from("fake pdf"));
    const parseDocument = vi.fn().mockResolvedValue("Annual report summary financial data revenue ebitda profit margins growth performance business overview segment results");
    // Extract returns one good metric and one null-value metric (sanitizer will drop the null)
    const extractFromText = vi.fn().mockResolvedValue({
      metadata: { companyName: "Test", reportPeriod: "Q1", sourceLanguage: "en" },
      metrics: [
        { label: "Revenue", value: 100, unit: "EUR" },
        { label: "Bad Metric", value: null },
      ],
      narratives: [{ section: "executive_summary", text: "Results were strong with good growth across all segments." }],
      sentiment: { managementTone: "positive", outlook: "Good", riskFactors: [] },
    });
    const translateExtractedData = vi.fn().mockImplementation(async (data: ExtractedData) => ({ ...data, metadata: { ...data.metadata, outputLanguage: "en" } }));
    const assemblePdf = vi.fn().mockResolvedValue(Buffer.from("pdf"));
    const saveReport = vi.fn();

    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);

    const updated = await store.getJob(job.id);
    expect(updated!.state).toBe("complete");
  });
});
