import type { Job, ExtractedData } from "@bei/shared";
import {
  assessReportSanity,
  createCompanyStore,
  createReportStore,
  DuplicateReportError,
  formatReportSanityIssue,
} from "@bei/shared";
import { matchCompany, parseReportPeriod, pickBestMatch } from "./company-matcher.js";

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
  let mappingWarning: string | null = null;

  if (!companyId) {
    const match = await matchCompany(companyName);
    if (match) {
      companyId = match.companyId;
      log(`Matched "${companyName}" → company ${match.companyId} (confidence: ${match.confidence.toFixed(2)})`);
    } else {
      log(`No company match for "${companyName}" — creating unmatched report`);
    }
  } else {
    const companies = await createCompanyStore().listCompanies();
    const selectedCompany = companies.find((company) => company.id === companyId);
    if (!selectedCompany) {
      mappingWarning = `Selected company ${companyId} was not found; creating unmatched report for extracted company "${companyName}".`;
      log(mappingWarning);
      companyId = null;
    } else {
      const selectedMatch = pickBestMatch(companyName, [selectedCompany]);
      if (!selectedMatch || selectedMatch.companyId !== selectedCompany.id) {
        mappingWarning = `Selected company "${selectedCompany.name}" conflicts with extracted company "${companyName}"; creating unmatched report for admin review.`;
        log(mappingWarning);
        companyId = null;
      } else {
        log(`Using company ID from upload context: ${companyId} (confidence: ${selectedMatch.confidence.toFixed(2)})`);
      }
    }
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
    const history = companyId
      ? await reportStore.listReportsByCompany(companyId)
      : [];
    const sanityWarnings = assessReportSanity(data, {
      currentFiscalYear: parsed.fiscalYear,
      currentReportType: parsed.reportType,
      history: history
        .filter((report) => report.jobId !== job.id)
        .map((report) => ({
          fiscalYear: report.fiscalYear,
          reportType: report.reportType,
          extractedJsonSnapshot: report.extractedJsonSnapshot,
        })),
    }).map(formatReportSanityIssue);

    if (sanityWarnings.length > 0) {
      const message = `Report quality gate failed: ${sanityWarnings.join(" ")}`;
      log(message);
      await store.updateJob(job.id, {
        state: "failed",
        extractedJson: JSON.stringify({
          ...data,
          qualityWarnings: sanityWarnings,
        }),
        error: message,
      });
      return;
    }

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
    if (mappingWarning) {
      await store.updateJob(job.id, {
        error: mappingWarning,
      });
    }
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
