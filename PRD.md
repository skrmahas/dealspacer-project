# Baltic Earnings Intelligence — PRD

## Problem Statement

Investors, analysts, and IR professionals covering the Baltic exchanges (Nasdaq Tallinn, Riga, Vilnius) need to digest earnings reports from ~40 listed companies. These reports are published in multiple formats (PDF, CSV, HTML, XHTML), can be up to 200 pages long, and are often in Estonian, Latvian, or Lithuanian. Extracting key financial metrics, understanding management sentiment, and comparing performance across quarters and companies requires hours of manual work per report.

Today, every analyst manually builds their own spreadsheet of key metrics from raw filings. There is no central, browsable catalog of structured Baltic earnings data — not even a place to find which reports exist for which companies. The gap is twofold: (1) no tool automatically transforms a raw Baltic earnings filing into a clean, metric-rich summary, and (2) no persistent catalog lets analysts browse, discover, and compare reports across their coverage universe.

## Solution

A web application that serves as both a **browsable catalog** of Baltic company earnings reports and an **AI pipeline** that transforms raw filings into structured, investor-ready summaries.

**Catalog layer** (new):
1. A curated directory of Baltic listed companies, grouped by exchange (Tallinn/Riga/Vilnius)
2. A persistent `reports` table mapping each company's annual and quarterly reports to fiscal year, report type, language, and the generated summary PDF
3. Company detail pages with a chronological report timeline showing key metrics inline (revenue, free cash flow, EBITDA, net profit) so users can scan trends without clicking into every report
4. A dedicated comparison page where two reports (same company or cross-company) are rendered side-by-side with structured metrics, sentiment analysis, overlaid charts, and directional "who's doing better" callouts. Revenue, Free Cash Flow, and Guidance Sentiment are the three primary pillars weighted 2× in the comparison algorithm.
5. Admin tools for resolving reports that don't auto-match to a known company

**AI pipeline** (existing, now feeding the catalog):
1. Parses and extracts financial data into structured, machine-readable JSON
2. Classifies the document type (rejects non-financial uploads before hitting the LLM)
3. Translates metrics and narratives into English + local Baltic languages (ET/LV/LT)
4. Generates a polished PDF report with charts, key metrics, sentiment analysis, and an executive summary
5. On completion, automatically creates a `reports` row in the catalog — matching the AI-extracted company name against the curated company list, checking for duplicates, and routing unmatched reports to an admin review bucket

The output is a searchable, shareable catalog of Baltic earnings intelligence — not just a one-shot report generator.

---

## User Stories

### Catalog browsing
1. As an analyst, I want to land on a company directory grouped by exchange, so that I can immediately see which companies have reports available and drill into the ones I cover.
2. As a fund manager, I want to view a company's report timeline with key metrics (revenue, EBITDA, net profit) shown inline per report, so that I can scan performance trends without opening each report.
3. As an investor, I want to search for a company by name or ticker, so that I can jump directly to the reports I care about.

### Comparison
4. As an analyst covering multiple Baltic companies, I want to select two reports and see a side-by-side metrics comparison with delta columns and directional arrows (green ↑ / red ↓), so that I can instantly identify which company performed better across key financials.
5. As a portfolio manager, I want to compare management sentiment and outlook side-by-side between two reports, so that I can gauge confidence shifts between companies or quarters.
6. As a user, I want the comparison page to show overlaid charts (revenue breakdown, profitability trends) from both reports, so that I can visually compare segment performance and trajectory.

### Upload & pipeline (existing, now catalog-integrated)
7. As an IR professional, I want to upload a 150-page annual report PDF and receive a 4-page summary with the key financials, so that I can quickly brief my team before an investor call.
8. As a Nasdaq associate, I want the system to extract revenue, EBITDA, and net profit automatically, so that I don't have to hunt through footnotes and tables manually.
9. As a Latvian-speaking investor, I want the report in Latvian, so that I can read it in my native language without relying on machine-translated news articles.
10. As an Estonian fund manager, I want the report to show charts (revenue trend, segment breakdown, profitability), so that I can visually grasp performance at a glance.
11. As a user, I want to see sentiment analysis of management's tone and forward guidance, so that I can gauge confidence beyond the raw numbers.
12. As a user, I want confirmation that the document contains financial data and a clear error message if it doesn't, so that I don't waste time on invalid uploads.
13. As a user, I want to be told if a report I'm uploading already exists in the catalog (same company + year + type + language), so that I don't create duplicates — with the option to view the existing report or force-replace it.
14. As a user, I want to view the generated report in my browser and share it with a colleague via a link, so that we can collaborate without downloading and emailing files.

### Admin & import
15. As an admin, I want to bulk-import a directory of pre-downloaded earnings PDFs using a CLI with a JSON manifest (mapping filenames to company, year, type, language), so that the catalog is seeded with historical reports without manual upload.
16. As an admin, I want a review page listing reports whose AI-extracted company name didn't match any catalog company, so that I can map them to the correct company (or create a new one) with a dropdown.

---

## Implementation Decisions

### Architecture

**Dual-layer: catalog + pipeline**, connected by a completion hook.

- **Catalog layer**: Persistent `companies` and `reports` tables. The catalog is the source of truth for what reports exist. It survives job deletions and re-processing.
- **Pipeline layer** (unchanged): Multi-stage AI pipeline with semi-structured JSON as the intermediate artifact. Jobs remain transient processing artifacts — they can be cleaned up without losing catalog data.

The connection between layers: when a job completes successfully, the worker's orchestrator creates a `reports` row. The AI-extracted `companyName` is fuzzy-matched against the `companies` table. If matched → report lands in the catalog. If not → report goes to `company_id = null` and appears in the admin unmatched page. If a duplicate is detected (same company + fiscal year + report type + language) → the job enters a new `duplicate` state with a user-facing message.

**Multi-stage pipeline** (unchanged from v1):

- **Stage 0 (Pre-extraction)**: Document classifier checks the first ~2k chars for auditor reports, prospectuses, legal filings, or press releases. Non-financial documents are rejected before any LLM call, saving API costs.
- **Stage 1 (Extraction)**: GPT-4o extracts financial data from parsed/OCR'd document text → English semi-structured JSON. Numbers stay as typed numbers, metrics are flexible (whatever the source contains), narrative text is translated to English.
- **Stage 1b (Cleanup)**: Metric deduplication (Levenshtein distance + Jaccard word similarity) merges near-duplicate labels. Sanitization pass drops null-value metrics, empty chart sections, and flags implausible YoY swings.
- **Stage 2 (Translation)**: GPT-4o batch-translates all metric labels and narrative text to target language. Chart renderer uses translated labels to generate localized PDF.
- **Completion hook** (new): On job `complete`, the orchestrator inserts a `reports` row with fuzzy-matched `company_id`, a snapshot of the extracted JSON, and the S3 key of the generated PDF. Duplicate detection runs before insert.

The intermediate artifact is semi-structured — a fixed JSON container shape with flexible contents. This gives Stage 2 typed, machine-readable numbers for charting (no re-extraction risk), while keeping the schema flexible enough for any Baltic company regardless of sector. The same JSON is snapshotted into `reports.extracted_json_snapshot` for powering comparison pages without re-parsing or additional LLM calls.

### Primary extraction targets

The extraction prompt explicitly prioritizes three pillars that investors track most:

| # | Metric | Statement | Why it matters |
|---|---|---|---|
| 1 | **Revenue** | Income Statement | Most fundamental and widely-tracked financial metric. Demonstrates the tool's ability to work with the core financial statement. |
| 2 | **Free Cash Flow (FCF)** | Cash Flow Statement | "Profit is an opinion, but cash is a fact." Net Profit and EBITDA can be distorted by accounting adjustments or non-cash items. FCF reflects actual cash entering the company. More complex and more valuable than income-statement-only metrics. |
| 3 | **Guidance Sentiment** | Textual (management commentary) | Shows the AI is not just a calculator — it understands textual context. The stock market is a discounting mechanism: prices are driven by future expectations, not past performance. The prompt explicitly instructs the LLM to extract forward-looking management statements and assess whether guidance is being raised, maintained, or lowered. |

Optional second-tier metrics: **EBITDA**, **P/E ratio**, **Net Profit Margin** — extracted when present but not required for a "complete" extraction.

These three pillars drive the comparison page's directional callout (Revenue, FCF, and Guidance Sentiment are weighted 2× when counting "who's doing better") and the company detail page's inline metric previews.

**Schema changes**:
- `ProfitabilityTrends` adds `freeCashFlow?: (number | null)[]` alongside `revenue`, `ebitda`, `netProfit`
- `ReportWithPreview` adds `previewFcf` and `previewGuidanceSentiment` for inline display
- `ExtractedSentiment` adds `guidanceDirection?: string` — "raised" | "maintained" | "lowered" | null

### Catalog data model

```
companies
├── id (UUID, PK)
├── name (TEXT, UNIQUE — display name, e.g. "AS Tallink Grupp")
├── ticker (TEXT — e.g. "TAL1T")
├── exchange (TEXT — "Tallinn" | "Riga" | "Vilnius")
├── slug (TEXT, UNIQUE — URL-safe identifier, e.g. "tallink-grupp")
└── created_at (TIMESTAMPTZ)

reports
├── id (UUID, PK)
├── company_id (UUID, FK → companies.id, nullable for unmatched)
├── fiscal_year (INTEGER)
├── report_type (TEXT — "annual" | "q1" | "q2" | "q3" | "q4" | "semi-annual" | "other")
├── language (TEXT — "en" | "et" | "lv" | "lt")
├── job_id (UUID, FK → jobs.id)
├── s3_key (TEXT — path to generated PDF in S3)
├── extracted_json_snapshot (JSONB — copy of the extracted data for comparison)
├── created_at (TIMESTAMPTZ)
└── UNIQUE (company_id, fiscal_year, report_type, language)
    -- NULL company_id allows multiple unmatched reports

jobs (unchanged)
├── id, state, original_filename, output_language,
│   extracted_text, extracted_json, error, created_at, updated_at
└── + company_id (UUID, nullable — optional FK for uploads with known company context)

translation_cache (unchanged)
leads (unchanged)
```

### Company matching strategy

When a job completes, the worker must associate it with a company:

1. **Upload with `company_id`** (from company detail "Add Report" button): Direct insert into `reports`. Duplicate check against `(company_id, fiscal_year, report_type, language)`. If duplicate → job enters `duplicate` state.
2. **Upload without `company_id`** (from general `/upload` page): Fuzzy-match AI-extracted `companyName` against `companies.name` and `companies.ticker` using Levenshtein distance. If a single high-confidence match (≥0.85 similarity) → insert with that `company_id`. If no match or ambiguous → insert with `company_id = null` → appears in admin unmatched page.
3. **Import with manifest**: `company_slug` is known from the manifest. Exact match. No fuzzy step.

### Duplicate detection

Unique constraint on `reports(company_id, fiscal_year, report_type, language)`. Before inserting, the orchestrator checks for an existing row. On collision:

- The job enters a new `duplicate` state (in addition to the existing `pending | parsing | extracting | translating | assembling | complete | failed` states).
- The web UI surfaces the duplicate with a message: "A report for {Company} {Year} {Type} ({Language}) already exists." Two actions: "View Existing" (links to the existing report) or "Replace" (overwrites the existing `reports` row's `job_id`, `s3_key`, and `extracted_json_snapshot` with the new job's data).

### Unmatched report admin review

Reports with `company_id = null` appear on `/admin/unmatched`. The page shows a table:

| AI-Extracted Name | Fiscal Year | Report Type | Language | Filename | Job Date | Action |
|---|---|---|---|---|---|---|
| "Tallink Grupp AS" | 2024 | annual | en | upload_abc.pdf | 2026-01-15 | [Map ▼] |

The "Map" dropdown lists all companies in the catalog, plus a "Create new company" option that opens an inline form (name, ticker, exchange, slug). On submit, the `reports` row is updated with the chosen or newly created `company_id`. The page is behind the same access code gate.

### Comparison page

**Route**: `/compare?reportA=<reportId>&reportB=<reportId>`

**Layout** (full-width, sidebar collapses):
- **Header**: Company names + fiscal year + report type for both sides, with a `vs` divider
- **Directional callout**: A summary bar showing which report scores better on more metrics. Revenue, Free Cash Flow, and Guidance Sentiment are the three **primary pillars** and each count 2× in the tally. Remaining metrics count 1×. Computed client-side from the snapshot JSONs — count weighted scores where each side is higher, rendered as green ↑ / red ↓ arrows. No LLM.
- **Metrics table**: Three columns — Report A values, Δ/% column, Report B values.
  - Each row: metric label, report A value, delta (absolute + percentage), report B value
  - Green ↑ for positive deltas (higher revenue, higher profit), red ↓ for negative
  - Filters: revenue, EBITDA, net profit, margins, and any additional metrics present in both snapshots
- **Sentiment comparison**: Side-by-side panels showing `managementTone`, `outlook`, and `riskFactors` from each report's extracted sentiment
- **Overlaid charts** (client-side chart.js):
  - Revenue breakdown (bar chart — segment or geography if present in both)
  - Profitability trends (multi-series line chart with both reports' trend data overlaid)
  - Charts reuse the same color palette and styling as the server-side PDF chart renderer for visual consistency

### Sidebar navigation

**Landing page** replaces the current upload-first page. Layout: left sidebar (280px, fixed) + main content area.

**Sidebar contents**:
- Search box at top ("Search companies..."): filters the company list in real time as the user types
- Exchange filter tabs (All / Tallinn / Riga / Vilnius): toggles which companies are shown
- Company list, grouped by exchange, each item showing:
  - Company name
  - Ticker (muted)
  - Report count badge (e.g., "4") — `COUNT(reports)` for that company
- Selected company is highlighted. Clicking a company navigates to its detail page.

### Page inventory

| Page | Route | Role |
|---|---|---|
| Access gate | `/access` | Access code entry (unchanged) |
| Marketing landing | `/` | Public landing page — hero, live stats, How it works, Features grid, Exchanges, CTA footer |
| Company catalog | `/companies` | Sidebar (search, exchange filter pills, grouped list with report-count badges) + welcome state in the main area |
| Company analytics dashboard | `/companies/:slug` | Company header, 4 KPI cards (Revenue/EBITDA/Net Profit/FCF) with YoY arrows, multi-metric trend chart, revenue breakdown donut, sentiment timeline, reports table with comparison checkboxes |
| Report view | `/reports/:reportId` | Embedded PDF viewer + extracted metrics summary + share link |
| Legacy redirect | `/reports/:jobId` | Redirects to the corresponding `/reports/:reportId` for backward compat |
| Comparison | `/compare?reportA=X&reportB=Y` | Side-by-side metrics, sentiment, and chart comparison |
| Upload | `/upload` | Canonical upload form (language selector + file input). If `?company=slug` present, pre-fills company context |
| Legacy upload redirect | `/app` | Server-side redirect to `/upload`, preserving query string (e.g. `?company=slug`) |
| Admin: unmatched | `/admin/unmatched` | Table of unmatched reports with company-mapping dropdown |
| API routes | `/api/jobs/*`, etc. | Mostly unchanged; new `/api/reports/*` and `/api/companies/*` endpoints |

### Upload flow integration

Two entry points, one pipeline:

1. **Company detail "Add Report"**: POSTs to `/api/jobs` with `companyId` in the form data. The worker receives `company_id` on the job. On completion → direct insert into `reports` (no fuzzy match), duplicate check, and a redirect back to the company's timeline.
2. **General `/upload` page**: No `companyId`. The worker fuzzy-matches the AI-extracted `companyName`. Falls through to unmatched bucket if no match.

### Import CLI

A CLI script in the worker package for bulk-seeding the catalog from pre-downloaded PDFs:

```
tsx packages/worker/src/import.ts --dir ./reports-to-import --manifest ./manifest.json
```

**Manifest format** (`manifest.json`):
```json
[
  {
    "file": "Tallink_Annual_2023.pdf",
    "company_slug": "tallink-grupp",
    "fiscal_year": 2023,
    "report_type": "annual",
    "output_language": "en"
  }
]
```

**Script behavior**:
1. Validates the manifest (all `company_slug` values exist in `companies` table)
2. For each entry: uploads the PDF to S3 → inserts a `jobs` row (with `company_id` pre-filled from the slug → ID lookup)
3. Waits for all jobs to complete (polling loop)
4. Reports results: total imported, duplicates skipped, failures

Batch parallelization: configurable concurrency (default 5 concurrent uploads) to avoid overwhelming the worker.

### Document classification (pre-LLM)

| Document type | Behavior | Example patterns |
|---|---|---|
| `financial_report` | Proceed to extraction | Revenue, EBITDA, balance sheet, annual report |
| `auditor_report` | **Reject** | "Independent Auditor's Report", "we have audited" |
| `prospectus` | **Reject** | "Prospectus", "Offering Circular", "subscription period" |
| `legal_filing` | **Reject** (≥2 hits) | "regulated information", "inside information", "pursuant to" |
| `press_release` | **Reject** (if no financial content) | "Press Release", "FOR IMMEDIATE RELEASE" |

### Language strategy

- Stage 1 extracts everything and normalizes to English in one LLM call.
- Stage 2 batch-translates all metric labels and narrative text to the target language in one LLM call per language.
- A PostgreSQL-backed translation cache (`translation_cache` table: source_text, et, lv, lt) stores metric labels after first encounter. Subsequent reports hit the cache for consistency and cost savings. No human-maintained glossary.
- If the target language is English (`en`), Stage 2 is skipped entirely — the extraction is already in English.
- PDF section labels (headings, table headers, disclaimer) are localized via hardcoded translation tables for ET/LV/LT, not via LLM calls.
- Language is part of the `reports` unique key. The same company+fiscal year+report type can exist in multiple languages as separate catalog entries.

### PDF output

(Unchanged from v1)

- Cover (company name, report period, generation date)
- Executive Summary
- Key Metrics Dashboard
- Revenue Breakdown (bar + donut charts)
- Profitability Trends (multi-series line chart)
- Business & Segment Highlights
- Sentiment Analysis
- Outlook
- AI Disclaimer (localized)

### Monorepo structure

Three npm workspace packages (unchanged):

| Package | Name | Role |
|---|---|---|
| `packages/shared` | `@bei/shared` | Types (Job, ExtractedData, Company, Report, etc.), DB pool, Postgres store (jobs, companies, reports, translation cache), S3/disk file store, migrations |
| `packages/web` | `@bei/web` | Next.js 14 frontend (company directory, company detail, comparison page, upload UI, polling, download, share pages, admin unmatched, access code gate) |
| `packages/worker` | `@bei/worker` | Node.js/TypeScript pipeline worker (parse → classify → extract → dedupe → sanitize → translate → assemble → create report) + import CLI |

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React 18, TypeScript) |
| Frontend charts | `chart.js` v4 (client-side, loaded via npm in the web package) |
| Pipeline worker | Node.js/TypeScript (`tsx` runner) |
| LLM | GPT-4o (OpenAI SDK v6) for both extraction and translation |
| File parsing | `pdfjs-dist` (digital PDFs, parallel page batches), `pdf-parse` (OCR screenshots), `csv-parse`, regex-based HTML/XHTML text extraction |
| OCR fallback | `tesseract.js` for scanned/image-only pages |
| Server-side charts | `chart.js` v4 + `canvas` (node-canvas, server-side, headless) — for PDF report charts |
| PDF rendering | `puppeteer` (Chromium HTML → PDF, with browser pre-warming and multi-attempt launch fallback) |
| Database | PostgreSQL via `pg` (jobs, companies, reports, translation cache, leads) |
| File storage | S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO) with local disk fallback. Auto-detected via `S3_BUCKET` env var. |
| Job queue | Postgres `jobs` table with `FOR UPDATE SKIP LOCKED` |
| Testing | Vitest with jsdom |

### Infrastructure

(Unchanged — Railway, as before)

```
Railway
├── Web (Next.js)              ├── Worker (Node.js)
│   ├── Company directory      │   ├── Parse + OCR
│   ├── Company detail         │   ├── Document classification
│   ├── Comparison page        │   ├── GPT-4o extraction
│   ├── Upload UI              │   ├── Metric deduplication
│   ├── Admin unmatched        │   ├── Sanitization
│   ├── Progress polling       │   ├── GPT-4o translation
│   ├── Download endpoint      │   ├── Chart generation
│   ├── Share page (PDF view)  │   ├── PDF assembly
│   └── Access code gate       │   ├── Company matching
│                              │   ├── Reports insert
│                              │   └── Import CLI (manual)
└──────────────┬───────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
Railway Postgres    S3 Bucket
 ├── jobs          ├── uploads/
 ├── companies     └── reports/
 ├── reports
 └── translation
     _cache
```

### UX

- Simple access code → cookie (no user accounts). Middleware checks `bei_access` cookie on `/app`, `/upload`, `/admin/*`, and `/reports/*`; unauthenticated visitors are redirected to `/access`. The marketing landing (`/`), the company catalog (`/companies`), the analytics dashboards (`/companies/:slug`), and the comparison view (`/compare`) are public.
- **Marketing landing** (`/`) = standalone top-nav page with hero, live aggregate stats from `/api/stats` (including processed unmatched reports as counts only), "How it works" 3-step, features grid (shadcn/ui Cards), exchanges badges, and CTAs into the catalog and upload. No sidebar.
- **Company catalog** (`/companies`) = sidebar (search box + exchange filter pills + grouped company list with `Badge` report-count chips + Upload/Access bottom links) and a welcome panel in the main content area. On mobile the sidebar collapses to a hamburger-triggered drawer.
- **Company analytics dashboard** (`/companies/:slug`) = company header (name, ticker, exchange `Badge`, "Add Report" → `/upload?company=:slug`), 4 KPI cards with YoY % deltas and arrows, multi-metric trend line chart (chart.js v4, togglable legend), revenue breakdown donut (chart.js v4, hidden when no segment/geography data exists), sentiment timeline with `raised`/`maintained`/`lowered` colored tags, and the reports table with comparison checkboxes.
- **Comparison page** = full-width split view: metrics table with deltas (green ↑ / red ↓), sentiment side-by-side, overlaid client-side charts, "who's doing better" directional callout.
- **Search** in the catalog sidebar filters the company list (by name and ticker) in real time as the user types.
- File upload with progress tracker: Parsing → Extracting → Translating → Rendering.
- **Report view**: embedded PDF via iframe + share link + download button.
- **Share page**: `/reports/:reportId` embeds the formatted PDF in-browser.
- **Legacy redirects**: `/reports/:jobId` → `/reports/:reportId`; `/app` → `/upload` (preserves `?company=slug`).
- Multiple error paths with clear user-facing messages (unsupported type, non-financial document, file too large, no data found, pipeline timeout, duplicate report).
- 100 MB file size limit for all types.
- **Mobile responsive**: catalog and analytics layouts stack below 768px; the catalog sidebar collapses to a hamburger-triggered drawer.

### Modules

| # | Module | File | Role |
|---|---|---|---|
| 1 | **File Parser** | `packages/worker/src/parser.ts` | Extracts text from PDF (pdfjs-dist with parallel batch processing, pdf-parse OCR), CSV (csv-parse), HTML/XHTML (regex-based tag stripping). OCR fallback with tesseract.js. Text coherence check. |
| 2 | **Document Classifier** | `packages/worker/src/classifier.ts` | Pre-LLM screen using keyword/pattern matching on first ~2k chars. Rejects auditor reports, prospectuses, legal filings, and press releases. |
| 3 | **Extraction Engine** | `packages/worker/src/extractor.ts` | GPT-4o prompt + structured JSON output → typed financial data, narratives, sentiment, revenue breakdown, profitability trends. |
| 4 | **Metric Deduplicator** | `packages/worker/src/deduplicator.ts` | Post-extraction merge of near-duplicate metric labels using Levenshtein distance (≤3) and Jaccard word similarity (≥0.85). |
| 5 | **Sanitizer** | `packages/worker/src/sanitizer.ts` | Structural validation: drops null-value metrics, duplicate labels, charts with insufficient data (<2 segments/periods), flags implausible YoY swings (>500%). |
| 6 | **Translation Engine** | `packages/worker/src/translator.ts` | GPT-4o batch translation + PostgreSQL-backed self-building cache. Skips entirely for English output. |
| 7 | **Chart Renderer** | `packages/worker/src/chart-renderer.ts` | chart.js + node-canvas → PNG images with localized labels, YoY computation with clipping thresholds. Server-side, for PDF report generation. |
| 8 | **PDF Assembler** | `packages/worker/src/assembler.ts` | puppeteer HTML template → polished A4 PDF. Browser pre-warming on startup, multi-attempt launch fallback. Supports remote browser via `PUPPETEER_BROWSER_WS_ENDPOINT`. |
| 9 | **Job Orchestrator** | `packages/worker/src/orchestrator.ts` | Postgres-backed job state machine: pending → parsing → extracting → translating → assembling → complete/failed/duplicate. **New**: completion hook creates `reports` row with company matching and duplicate detection. |
| 10 | **Worker Loop** | `packages/worker/src/worker.ts` + `index.ts` | Polling loop with stale-job recovery sweep. Env-driven config. |
| 11 | **Company Matcher** | `packages/worker/src/company-matcher.ts` | Fuzzy-matches AI-extracted company names against `companies` table using Levenshtein distance. Returns best match + confidence score. |
| 12 | **Import CLI** | `packages/worker/src/import.ts` | Batch-import reports from a local directory using a JSON manifest. Uploads to S3, creates jobs, waits for completion, reports results. |
| 13 | **Company Store** | `packages/shared/src/pg-store.ts` | CRUD for `companies` table: list (with report counts), get by slug, create, update. |
| 14 | **Report Store** | `packages/shared/src/pg-store.ts` | CRUD for `reports` table: list by company (chronological, with extracted metric previews), get by id, create, replace, list unmatched, list recent. Duplicate check. |
| 15 | **Web Frontend** | `packages/web/` | Next.js 14 App Router: company directory (landing page with sidebar), company detail (report timeline + inline metrics + comparison selection), comparison page (side-by-side structured view with client-side charts), upload form (general + company-contextual), admin unmatched page, report view (PDF embed), access code gate, search. |
| 16 | **Shared Package** | `packages/shared/` | DB pool (`pg`), Postgres-backed stores (jobs, companies, reports, translation cache), S3/disk file store (auto-detect), migrations, shared types. |

---

## Testing Decisions

### What makes a good test

Tests should verify behavior through public interfaces, not implementation details. Focus on integration-style tests that exercise real code paths.

### Modules with tests

**Existing (unchanged):**
- Document Classifier: verify all rejection categories and false-positive guard
- Metric Deduplicator: verify Levenshtein and Jaccard merging
- Sanitizer: verify null metrics dropped, chart data thresholds, implausible YoY
- Extraction Engine: verify correctly extracted metrics from fixture files
- Translation Engine: verify translation cache builds and hits
- PDF Assembler: verify output PDF contains expected sections; sections omitted when data missing
- Chart Renderer: verify server-side chart rendering thresholds
- Job Orchestrator: verify state transitions, stale-job recovery
- Worker Loop: verify stale-job sweep logic

**New:**
- **Company Matcher**: verify fuzzy matching with known names (exact, typo, different word order, abbreviation) and no-match edge cases; threshold calibration
- **Company Store**: verify list, get-by-slug, create, duplicate-name rejection
- **Report Store**: verify create, list-by-company (chronological order, metric previews), duplicate detection (same company+year+type+language), unmatched listing
- **Completion Hook**: verify that job `complete` → `reports` row created; verify duplicate → job set to `duplicate`; verify unmatched → `company_id = null`
- **Import CLI**: verify manifest validation, job creation, completion polling, result reporting
- **Comparison Page**: verify metrics table rendering with deltas; verify sentiment side-by-side; verify chart data passed to client-side renderer
- **Company Detail Page**: verify timeline order, inline metric previews, checkbox selection for comparison
- **Admin Unmatched Page**: verify unmatched reports listed, mapping dropdown populates correctly, mapping updates `company_id`
- **Duplicate flow**: verify upload with duplicate company+year+type+language → job enters `duplicate` state, user sees message with "View Existing" and "Replace" actions

### Test approach

- Vitest with jsdom for frontend tests, plain Vitest for worker/shared tests
- Use fixture files (example Baltic earnings reports) as test inputs
- Assert on output JSON structure, not exact LLM output
- Mock OpenAI API calls; use cached responses for integration tests
- Isolate DB state per test with test-specific fixtures or transaction rollbacks

---

## Out of Scope

- User accounts, OAuth, multi-tenancy
- Sector-specific metric schemas (banks vs shipping vs retail)
- Automated scraping of exchange websites
- Email notifications for completed reports
- Nasdaq associate validation workflow
- Usage quotas or billing
- Sparklines on company detail timeline
- LLM-generated comparison narratives ("Company X outperformed Y because...")
- Batch upload of multiple reports via UI (CLI import handles batch seeding)

---

## Environment Variables

### Required
| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | web, worker | PostgreSQL connection string |
| `OPENAI_API_KEY` | worker | GPT-4o API key |

### Optional — S3 file storage
| Variable | Default | Description |
|---|---|---|
| `S3_BUCKET` | _(none)_ | S3 bucket name. If unset, falls back to local disk. |
| `S3_ENDPOINT` | _(none)_ | S3-compatible endpoint URL |
| `S3_REGION` | `auto` | S3 region |
| `S3_ACCESS_KEY_ID` | _(none)_ | S3 access key |
| `S3_SECRET_ACCESS_KEY` | _(none)_ | S3 secret key |
| `S3_FORCE_PATH_STYLE` | `false` | Use path-style addressing (required for R2, MinIO) |

### Optional — local disk fallback
| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./bei-data` | Local directory for file storage (used when S3 is not configured) |

### Optional — worker tuning
| Variable | Default | Description |
|---|---|---|
| `WORKER_POLL_INTERVAL_MS` | `2000` | How often the worker polls for new jobs |
| `WORKER_PDF_BATCH_SIZE` | `8` | Number of PDF pages processed in parallel |
| `STALE_JOB_SWEEP_INTERVAL_MS` | `30000` | How often the stale job sweep runs |
| `STALE_JOB_THRESHOLD_MS` | `1800000` (30 min) | How long a job can be stuck before reset to pending |

### Optional — Puppeteer / PDF
| Variable | Description |
|---|---|
| `PUPPETEER_BROWSER_WS_ENDPOINT` | WebSocket endpoint for remote browser |
| `PUPPETEER_BROWSER_URL` | HTTP endpoint for remote browser |
| `PUPPETEER_EXECUTABLE_PATH` | Custom Chromium executable path |
| `PUPPETEER_DEBUG` | Set to `"1"` for verbose browser launch logging |

### Optional — access control
| Variable | Description |
|---|---|
| `BEI_ACCESS_CODE` | Access code for the web app. Required in production; auto-generated fallback in development. |

---

## Further Notes

### Dependencies

- Requires OpenAI API key with GPT-4o access
- Requires Railway account with Postgres, web service, and worker service
- Requires S3-compatible bucket for cross-service file sharing (or shared disk for local dev)
- Worker service needs Chromium for PDF generation (puppeteer bundled binary, system Chrome, or remote browser)
- **New**: Requires a pre-populated `companies` table with the Baltic listed companies (name, ticker, exchange, slug) — seeded via migration or a small seed script

### Risk areas

1. **LLM hallucination**: GPT-4o may fabricate numbers. Mitigation: prominent "AI-generated" disclaimer on every report page (localized to target language).
2. **OCR quality on poor scans**: tesseract.js may produce garbage on low-quality scanned pages. Mitigation: text coherence detection; fail gracefully with "No financial data found".
3. **Pipeline timeout**: extremely large documents may approach memory limits. Mitigation: text truncated to 60k chars before LLM call; client-side 9-minute polling timeout; 100 MB file size limit.
4. **Translation consistency**: PostgreSQL-backed translation cache mitigates this, but first-call translations for rare metrics may vary. Acceptable for MVP.
5. **Stale jobs**: worker crashes while processing leave jobs stuck. Mitigation: stale-job sweep resets stuck jobs after 30 min.
6. **Large XHTML/HTML files**: DOM-based parsers balloon memory. Mitigation: regex-based extraction; 100 MB file size limit.
7. **Cross-service file access**: Web and worker have separate filesystems on Railway. Mitigation: S3-compatible object storage as canonical file store.
8. **Company matching accuracy**: AI-extracted `companyName` may not match the curated catalog exactly (typos, abbreviations, alternate legal names). Mitigation: Levenshtein fuzzy matching with a confidence threshold; unmatched reports go to admin review, not to the void.
9. **Duplicate report fragmentation**: If users upload the same report in different languages, the unique constraint `(company_id, fiscal_year, report_type, language)` keeps them as separate catalog entries — intentional design. The duplicate state only triggers on an exact four-field match.
10. **Catalog staleness**: Reports are permanent; no automatic refresh. If a company restates earnings, the old report stays. Mitigation: "Replace" action on duplicates allows admin re-upload of corrected reports.

### Post-MVP roadmap

1. User accounts and history
2. Sector-specific metric schemas (banking, shipping, retail, etc.)
3. LLM-generated comparison narratives ("Company X's revenue growth outpaced Y's due to...")
4. Company name confirmation step on upload (AI suggests, user confirms/corrects)
5. Nasdaq associate validation workflow
6. Multi-report batch upload via UI
7. Email delivery
8. Automated scraping of exchange websites for new filings
9. Sparklines on company detail timeline
10. PDF side-by-side viewer on comparison page (in addition to structured comparison)
