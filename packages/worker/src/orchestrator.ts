import type { Job, JobStore, ExtractedData } from "@bei/shared";
import { classifyDocument } from "./classifier.js";
import { deduplicateMetrics } from "./deduplicator.js";
import { sanitizeExtractedData } from "./sanitizer.js";
import { prefilterDocumentText } from "./prefilter.js";
import type { OpenAIClient } from "./extractor.js";
import { assessReportQuality, buildQualityGateFailureMessage } from "./quality-gate.js";

export async function processJob(
  job: Job,
  store: JobStore,
  readFile: (jobId: string) => Promise<Buffer>,
  parseDocument: (buffer: Buffer, filename: string) => Promise<string>,
  extractFromText: (text: string, apiClient?: OpenAIClient, partialResults?: ExtractedData[], onProgress?: (completed: number, total: number) => void) => Promise<ExtractedData>,
  translateExtractedData: (data: ExtractedData, language: Job["outputLanguage"], store: JobStore) => Promise<ExtractedData>,
  assemblePdf: (data: ExtractedData) => Promise<Buffer>,
  saveReport: (jobId: string, pdf: Buffer) => Promise<void>,
  saveBrief?: (jobId: string, pdf: Buffer) => Promise<void>,
  onJobComplete?: (job: Job, data: ExtractedData) => Promise<void>,
): Promise<void> {
  const log = (msg: string) => console.log(`[job ${job.id}] ${msg}`);
  const t0 = Date.now();
  let tParse = t0, tClassify = t0, tPrefilter = t0, tExtract = t0, tTranslate = t0, tAssemble = t0;
  try {
    log(`Starting: ${job.originalFilename} (${job.outputLanguage})`);

    await store.updateJob(job.id, { state: "parsing" });
    const buffer = await readFile(job.id);
    log(`File loaded: ${(buffer.length / 1024).toFixed(0)} KB`);
    const text = await parseDocument(buffer, job.originalFilename);
    tParse = Date.now();
    log(`Parsed: ${text.length} chars (${tParse - t0}ms)`);

    // Classify document type BEFORE GPT-4o extraction (saves API cost on invalid uploads)
    const classification = classifyDocument(text);
    if (classification.shouldReject) {
      log(`Rejected: ${classification.docClass} — "${classification.rejectionMessage}"`);
      throw new Error(classification.rejectionMessage);
    }
    tClassify = Date.now();

    await store.updateJob(job.id, { state: "extracting" });

    // Prefilter boilerplate text to reduce GPT-4o token usage
    const filteredText = prefilterDocumentText(text);
    if (filteredText.length < text.length) {
      log(`Prefiltered: ${text.length} → ${filteredText.length} chars`);
    }
    tPrefilter = Date.now();

    const extracted = await extractFromText(filteredText, undefined, undefined, async (completed: number, total: number) => {
      // Update job with progress info so frontend can display it
      try {
        await store.updateJob(job.id, {
          extractedJson: JSON.stringify({ _extractionProgress: { completed, total } }),
        });
      } catch {
        // Progress update failure is non-critical
      }
    });
    log(`Extracted: ${extracted.metrics.length} metrics, ${extracted.narratives.length} narratives`);
    tExtract = Date.now();

    // Deduplicate near-duplicate metrics before further processing
    const dedupedMetrics = deduplicateMetrics(extracted.metrics);
    if (dedupedMetrics.length !== extracted.metrics.length) {
      log(`Deduped metrics: ${extracted.metrics.length} → ${dedupedMetrics.length}`);
    }
    extracted.metrics = dedupedMetrics;

    // Sanitize: validate structural coherence, drop broken sections
    const { data: sanitized, warnings } = sanitizeExtractedData(extracted);
    if (warnings.duplicateLabels.length > 0) {
      log(`Sanitizer: ${warnings.duplicateLabels.length} duplicate label(s) dropped`);
    }
    if (warnings.droppedNullMetrics > 0) {
      log(`Sanitizer: ${warnings.droppedNullMetrics} null-value metric(s) dropped`);
    }
    if (warnings.revenueBreakdownDropped) log("Sanitizer: revenue breakdown dropped");
    if (warnings.profitabilityTrendsDropped) log("Sanitizer: profitability trends dropped");

    // Detect non-financial uploads: no metrics and no meaningful narratives
    const hasMetrics = sanitized.metrics.length > 0;
    const hasMeaningfulNarratives = sanitized.narratives.some((n) => n.text.length > 50);
    if (!hasMetrics && !hasMeaningfulNarratives) {
      throw new Error("No financial data found in this document");
    }

    const quality = assessReportQuality(sanitized, warnings);
    if (!quality.passed) {
      const message = buildQualityGateFailureMessage(quality.warnings);
      log(message);
      await store.updateJob(job.id, {
        state: "failed",
        extractedText: text,
        extractedJson: JSON.stringify({
          ...sanitized,
          qualityWarnings: quality.warnings,
        }),
        error: message,
      });
      return;
    }

    await store.updateJob(job.id, { state: "translating" });
    const translated = await translateExtractedData(sanitized, job.outputLanguage, store);
    log("Translation complete");
    tTranslate = Date.now();

    await store.updateJob(job.id, { state: "assembling" });
    const pdf = await assemblePdf(translated);
    await saveReport(job.id, pdf);
    log(`Report PDF: ${(pdf.length / 1024).toFixed(0)} KB`);
    tAssemble = Date.now();

    // Generate executive brief as a second output (non-fatal if it fails)
    if (saveBrief) {
      try {
        const { assembleBriefPdf } = await import("./assembler.js");
        const brief = await assembleBriefPdf(translated);
        await saveBrief(job.id, brief);
        log(`Brief PDF: ${(brief.length / 1024).toFixed(0)} KB`);
      } catch (err) {
        log(`Brief PDF generation failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      }
    }

    await store.updateJob(job.id, {
      state: "complete",
      extractedText: text,
      extractedJson: JSON.stringify(translated),
      error: null,
    });

    // Post-completion hook: company matching + reports row creation
    if (onJobComplete) {
      try {
        await onJobComplete(job, translated);
      } catch (err) {
        log(`Completion hook error (non-fatal): ${err instanceof Error ? err.message : err}`);
      }
    }

    log("Done!");
    log(`Timing: parse=${tParse - t0}ms classify=${tClassify - tParse}ms prefilter=${tPrefilter - tClassify}ms extract=${tExtract - tPrefilter}ms translate=${tTranslate - tExtract}ms assemble=${tAssemble - tTranslate}ms total=${tAssemble - t0}ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log(`FAILED: ${message}`);
    await store.updateJob(job.id, { state: "failed", error: message, extractedJson: null });
  }
}
