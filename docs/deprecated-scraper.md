# Deprecated Nasdaq/OAM Scraper

The previous Nasdaq/OAM scraper workflow is paused for production imports.

Do not use scraper-driven batch uploads to seed Dealspacer reports unless the
data-source approach has been explicitly approved again. Historical scraper
imports used broad announcement searches and trusted the looped company context
when posting to `/api/jobs`, which allowed filings for related or unrelated
issuers to be cataloged under the wrong company.

If any scraper tooling is reviewed or revived later, it must meet these
minimum safeguards before production use:

- Do not send `companyId` unless the source announcement issuer is verified
  against the catalog company.
- Capture source URL, issuer, headline, publication date, attachment filename,
  and scraper confidence for each upload.
- Route mismatched extracted-company evidence to unmatched review instead of
  filing directly under a company.
- Require an explicit production confirmation flag for batch uploads.

Until then, prefer manual uploads, permissioned data feeds, or a curated import
manifest whose company/report mapping has been reviewed before processing.
