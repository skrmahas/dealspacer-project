import type { Job, JobStore, ExtractedData } from "@bei/shared";
import { detectFileType, FILE_TOO_LARGE_MESSAGE, MAX_FILE_SIZE_BYTES } from "./parser.js";

export async function processJob(
  job: Job,
  store: JobStore,
  readFile: (jobId: string) => Promise<Buffer>,
  parseDocument: (buffer: Buffer, filename: string) => Promise<string>,
  extractFromText: (text: string) => Promise<ExtractedData>,
  translateExtractedData: (data: ExtractedData, language: Job["outputLanguage"], store: JobStore) => Promise<ExtractedData>,
  assemblePdf: (data: ExtractedData) => Promise<Buffer>,
  saveReport: (jobId: string, pdf: Buffer) => Promise<void>,
): Promise<void> {
  try {
    await store.updateJob(job.id, { state: "parsing" });
    const buffer = await readFile(job.id);
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(FILE_TOO_LARGE_MESSAGE);
    }
    detectFileType(job.originalFilename);
    const text = await parseDocument(buffer, job.originalFilename);

    await store.updateJob(job.id, { state: "extracting" });
    const extracted = await extractFromText(text);

    // Detect non-financial uploads: no metrics and no meaningful narratives
    const hasMetrics = extracted.metrics.length > 0;
    const hasMeaningfulNarratives = extracted.narratives.some((n) => n.text.length > 50);
    if (!hasMetrics && !hasMeaningfulNarratives) {
      throw new Error("No financial data found in this document");
    }

    await store.updateJob(job.id, { state: "translating" });
    const translated = await translateExtractedData(extracted, job.outputLanguage, store);

    await store.updateJob(job.id, { state: "assembling" });
    const pdf = await assemblePdf(translated);
    await saveReport(job.id, pdf);

    await store.updateJob(job.id, {
      state: "complete",
      extractedText: text,
      extractedJson: JSON.stringify(translated),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateJob(job.id, { state: "failed", error: message });
  }
}
