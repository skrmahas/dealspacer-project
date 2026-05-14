/**
 * Lightweight document-type classification that runs BEFORE GPT-4o extraction.
 * Uses keyword/pattern matching on the first ~2k chars to detect non-financial
 * documents and save API costs on invalid uploads.
 */

export type DocClass = "financial_report" | "auditor_report" | "legal_filing" | "prospectus" | "press_release" | "unknown";

export interface ClassificationResult {
  docClass: DocClass;
  shouldReject: boolean;
  rejectionMessage?: string;
}

const CLASSIFY_CHARS = 2000;

const AUDITOR_PATTERNS = [
  "Independent Auditor's Report",
  "We have audited the",
  "we have audited the",
  "in our opinion",
  "In our opinion",
  "audit opinion",
  "financial statements present fairly",
  "consolidated financial statements give a true and fair view",
  "we conducted our audit in accordance",
  "International Standards on Auditing",
];

const PROSPECTUS_PATTERNS = [
  "Prospectus",
  "Offering Circular",
  "offering memorandum",
  "offering of securities",
  "offering of shares",
  "subscription period",
  "final terms",
  "base prospectus",
];

const LEGAL_PATTERNS = [
  "Securities and Exchange Commission",
  "regulatory filing",
  "hereby notifies",
  "hereby announces that",
  "pursuant to",
  "stock exchange release",
  "regulated information",
  "inside information",
  "this is a translation",
  "official translation",
];

const PRESS_RELEASE_PATTERNS = [
  "Press Release",
  "FOR IMMEDIATE RELEASE",
  "press release",
  "media release",
];

/**
 * Classify a document based on its first ~2k characters.
 * Returns whether the document should be rejected (not a financial report)
 * and an appropriate user-facing message if so.
 */
export function classifyDocument(text: string): ClassificationResult {
  const sample = text.slice(0, CLASSIFY_CHARS);

  // Count pattern matches for each category
  const auditorHits = AUDITOR_PATTERNS.filter((p) => sample.includes(p)).length;
  const prospectusHits = PROSPECTUS_PATTERNS.filter((p) => sample.includes(p)).length;
  const legalHits = LEGAL_PATTERNS.filter((p) => sample.includes(p)).length;
  const pressHits = PRESS_RELEASE_PATTERNS.filter((p) => sample.includes(p)).length;

  // Auditor reports have distinctive phrases — even 1 strong hit is enough
  // "Independent Auditor's Report" or "we have audited" are dead giveaways
  if (auditorHits >= 1) {
    return auditorReportRejection();
  }

  // Prospectus: need at least 1 hit
  if (prospectusHits >= 1) {
    return prospectusRejection();
  }

  // Legal filings: need at least 2 hits (some overlap with normal financial docs)
  if (legalHits >= 2) {
    return legalFilingRejection();
  }

  // Press releases: only reject if very clearly a PR (multiple hits) and no financial content detected
  if (pressHits >= 2 && !hasFinancialContent(sample)) {
    return pressReleaseRejection();
  }

  return { docClass: "financial_report", shouldReject: false };
}

/**
 * Quick check for financial content in the sample text.
 */
function hasFinancialContent(text: string): boolean {
  const financialTerms = /(revenue|EBITDA|net profit|operating profit|balance sheet|income statement|cash flow|earnings per share|dividend|financial statements?|annual report|quarterly report|interim report|consolidated financial|management report|group turnover|turnover)/i;
  return financialTerms.test(text);
}

function auditorReportRejection(): ClassificationResult {
  return {
    docClass: "auditor_report",
    shouldReject: true,
    rejectionMessage:
      "This appears to be an auditor's report, not a financial earnings document. Please upload an earnings report, annual report, or investor presentation.",
  };
}

function prospectusRejection(): ClassificationResult {
  return {
    docClass: "prospectus",
    shouldReject: true,
    rejectionMessage:
      "This appears to be a prospectus or securities offering document. Please upload an earnings report, annual report, or investor presentation instead.",
  };
}

function legalFilingRejection(): ClassificationResult {
  return {
    docClass: "legal_filing",
    shouldReject: true,
    rejectionMessage:
      "This appears to be a regulatory filing or stock exchange notice. Please upload an earnings report, annual report, or investor presentation.",
  };
}

function pressReleaseRejection(): ClassificationResult {
  return {
    docClass: "press_release",
    shouldReject: true,
    rejectionMessage:
      "This appears to be a press release. Please upload an earnings report, annual report, or investor presentation for structured financial extraction.",
  };
}
