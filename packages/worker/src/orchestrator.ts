import type { Job, JobStore, ExtractedData } from "@bei/shared";

export async function processJob(
  job: Job,
  store: JobStore,
  readFile: (jobId: string) => Promise<Buffer>,
  parsePdf: (buffer: Buffer) => Promise<string>,
  extractFromText: (text: string) => Promise<ExtractedData>,
  assemblePdf: (data: ExtractedData) => Promise<Buffer>,
  saveReport: (jobId: string, pdf: Buffer) => Promise<void>,
): Promise<void> {
  try {
    await store.updateJob(job.id, { state: "parsing" });
    const buffer = await readFile(job.id);
    const text = await parsePdf(buffer);

    await store.updateJob(job.id, { state: "extracting" });
    const extracted = await extractFromText(text);

    // Detect non-financial uploads: no metrics and no meaningful narratives
    const hasMetrics = extracted.metrics.length > 0;
    const hasMeaningfulNarratives = extracted.narratives.some((n) => n.text.length > 50);
    if (!hasMetrics && !hasMeaningfulNarratives) {
      throw new Error("No financial data found in this document");
    }

    await store.updateJob(job.id, { state: "assembling" });
    const pdf = await assemblePdf(extracted);
    await saveReport(job.id, pdf);

    await store.updateJob(job.id, {
      state: "complete",
      extractedText: text,
      extractedJson: JSON.stringify(extracted),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateJob(job.id, { state: "failed", error: message });
  }
}
