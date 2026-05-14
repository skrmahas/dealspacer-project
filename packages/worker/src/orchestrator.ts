import type { Job } from "@bei/shared";
import type { JobStore } from "./store.js";

export async function processJob(
  job: Job,
  store: JobStore,
  readFile: (jobId: string) => Promise<Buffer>,
  parsePdf: (buffer: Buffer) => Promise<string>,
): Promise<void> {
  try {
    await store.updateJob(job.id, { state: "parsing" });
    const buffer = await readFile(job.id);
    const text = await parsePdf(buffer);
    await store.updateJob(job.id, { state: "complete", extractedText: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateJob(job.id, { state: "failed", error: message });
  }
}
