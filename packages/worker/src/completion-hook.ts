import type { Job, ExtractedData } from "@bei/shared";
import { createReportStore, DuplicateReportError } from "@bei/shared";
import { matchCompany, parseReportPeriod } from "./company-matcher.js";

/**
 * Post-completion hook: matches AI-extracted company name to catalog,
 * parses report period, and creates a reports row.
 * Handles duplicates by setting job to 'duplicate' state.
 */
export async function onJobComplete(
  job: Job,
  data: ExtractedData,
  store: { updateJob: (id: string, input: Record<string, unknown>) => Promise<unknown>; getJob: (id: string) => Promise<Job | null> },
): Promise<void> {
  const log = (msg: string) => console.log(`[job ${job.id}] ${msg}`);

  const reportStore = createReportStore();
  const companyName = data.metadata?.companyName?.trim();
  const reportPeriod = data.metadata?.reportPeriod?.trim();

  if (!companyName || !reportPeriod) {
    log("Skipping reports creation: missing company name or report period in extracted data");
    return;
  }

  // 1. Determine company ID
  let companyId: string | null = job.companyId || null;

  if (!companyId) {
    const match = await matchCompany(companyName);
    if (match) {
      companyId = match.companyId;
      log(`Matched "${companyName}" → company ${match.companyId} (confidence: ${match.confidence.toFixed(2)})`);
    } else {
      log(`No company match for "${companyName}" — creating unmatched report`);
    }
  } else {
    log(`Using company ID from upload context: ${companyId}`);
  }

  // 2. Parse report period
  const parsed = parseReportPeriod(reportPeriod);
  if (!parsed) {
    log(`Skipping reports creation: unparseable report period "${reportPeriod}"`);
    return;
  }

  log(`Parsed period: ${parsed.fiscalYear} ${parsed.reportType}`);

  // 3. Try creating the report row
  try {
    const s3Key = `reports/${job.id}.pdf`;
    await reportStore.createReport({
      companyId,
      fiscalYear: parsed.fiscalYear,
      reportType: parsed.reportType,
      language: job.outputLanguage,
      jobId: job.id,
      s3Key,
      extractedJsonSnapshot: data,
    });
    log(`Report row created: ${parsed.fiscalYear} ${parsed.reportType}`);
  } catch (err) {
    if (err instanceof DuplicateReportError) {
      log(`Duplicate report: ${err.message}`);
      await store.updateJob(job.id, {
        state: "duplicate",
        error: err.message,
      });
    } else {
      throw err;
    }
  }
}
