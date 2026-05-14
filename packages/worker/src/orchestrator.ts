import type { Job, JobStore, ExtractedData } from "@bei/shared";
import { classifyDocument } from "./classifier.js";
import { deduplicateMetrics } from "./deduplicator.js";

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
  const log = (msg: string) => console.log(`[job ${job.id}] ${msg}`);
  try {
    log(`Starting: ${job.originalFilename} (${job.outputLanguage})`);

    await store.updateJob(job.id, { state: "parsing" });
    const buffer = await readFile(job.id);
    log(`File loaded: ${(buffer.length / 1024).toFixed(0)} KB`);
    const text = await parseDocument(buffer, job.originalFilename);
    log(`Parsed: ${text.length} chars`);

    // Classify document type BEFORE GPT-4o extraction (saves API cost on invalid uploads)
    const classification = classifyDocument(text);
    if (classification.shouldReject) {
      log(`Rejected: ${classification.docClass} — "${classification.rejectionMessage}"`);
      throw new Error(classification.rejectionMessage);
    }

    await store.updateJob(job.id, { state: "extracting" });
    const extracted = await extractFromText(text);
    log(`Extracted: ${extracted.metrics.length} metrics, ${extracted.narratives.length} narratives`);

    // Deduplicate near-duplicate metrics before further processing
    const dedupedMetrics = deduplicateMetrics(extracted.metrics);
    if (dedupedMetrics.length !== extracted.metrics.length) {
      log(`Deduped metrics: ${extracted.metrics.length} → ${dedupedMetrics.length}`);
    }
    extracted.metrics = dedupedMetrics;

    // Detect non-financial uploads: no metrics and no meaningful narratives
    const hasMetrics = extracted.metrics.length > 0;
    const hasMeaningfulNarratives = extracted.narratives.some((n) => n.text.length > 50);
    if (!hasMetrics && !hasMeaningfulNarratives) {
      throw new Error("No financial data found in this document");
    }

    await store.updateJob(job.id, { state: "translating" });
    const translated = await translateExtractedData(extracted, job.outputLanguage, store);
    log("Translation complete");

    await store.updateJob(job.id, { state: "assembling" });
    const pdf = await assemblePdf(translated);
    await saveReport(job.id, pdf);
    log(`Report PDF: ${(pdf.length / 1024).toFixed(0)} KB`);

    await store.updateJob(job.id, {
      state: "complete",
      extractedText: text,
      extractedJson: JSON.stringify(translated),
    });
    log("Done!");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log(`FAILED: ${message}`);
    await store.updateJob(job.id, { state: "failed", error: message });
  }
}
