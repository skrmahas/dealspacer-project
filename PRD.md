# Baltic Earnings Intelligence — PRD

## Problem Statement

Investors, analysts, and IR professionals covering the Baltic exchanges (Nasdaq Tallinn, Riga, Vilnius) need to digest earnings reports from ~40 listed companies. These reports are published in multiple formats (PDF, CSV, HTML, XHTML), can be up to 200 pages long, and are often in Estonian, Latvian, or Lithuanian. Extracting key financial metrics, understanding management sentiment, and comparing performance across quarters requires hours of manual work per report. There is no tool that automatically transforms a raw Baltic earnings filing into a clean, metric-rich summary in English and local languages.

## Solution

A web application where users upload a Baltic company earnings report in any format (PDF, CSV, HTML, XHTML). The system:

1. Parses and extracts financial data into structured, machine-readable format
2. Classifies the document type (rejects non-financial uploads before hitting the LLM)
3. Translates metrics and narratives into English + local Baltic languages (ET/LV/LT)
4. Generates a polished PDF report with charts, key metrics, sentiment analysis, and an executive summary

The output is a single, investor-ready document that can be viewed in-browser or downloaded. A shareable link (`/reports/:jobId`) embeds the formatted PDF directly.

---

## User Stories

1. As an IR professional, I want to upload a 150-page annual report PDF and receive a 4-page summary with the key financials, so that I can quickly brief my team before an investor call.
2. As a Nasdaq associate, I want the system to extract revenue, EBITDA, and net profit automatically, so that I don't have to hunt through footnotes and tables manually.
3. As an analyst covering multiple Baltic companies, I want a consistent report template regardless of which company or filing format I upload, so that I can compare results across my coverage universe.
4. As a Latvian-speaking investor, I want the report in Latvian, so that I can read it in my native language without relying on machine-translated news articles.
5. As an Estonian fund manager, I want the report to show charts (revenue trend, segment breakdown, profitability), so that I can visually grasp performance at a glance.
6. As a user, I want to see sentiment analysis of management's tone and forward guidance, so that I can gauge confidence beyond the raw numbers.
7. As a user, I want confirmation that the document contains financial data and a clear error message if it doesn't, so that I don't waste time on invalid uploads.
8. As a user, I want to view the generated report in my browser and share it with a colleague via a link, so that we can collaborate without downloading and emailing files.
9. As a demo audience member, I want the output to look professional and branded, so that I trust the product enough to try it myself.
10. As a hackathon judge, I want to see a clear pipeline and architecture, so that I understand the technical depth of the solution.

---

## Implementation Decisions

### Architecture

**Multi-stage pipeline** with semi-structured JSON as the intermediate artifact:

- **Stage 0 (Pre-extraction)**: Document classifier checks the first ~2k chars for auditor reports, prospectuses, legal filings, or press releases. Non-financial documents are rejected before any LLM call, saving API costs.
- **Stage 1 (Extraction)**: GPT-4o extracts financial data from parsed/OCR'd document text → English semi-structured JSON. Numbers stay as typed numbers, metrics are flexible (whatever the source contains), narrative text is translated to English.
- **Stage 1b (Cleanup)**: Metric deduplication (Levenshtein distance + Jaccard word similarity) merges near-duplicate labels. Sanitization pass drops null-value metrics, empty chart sections, and flags implausible YoY swings.
- **Stage 2 (Translation)**: GPT-4o batch-translates all metric labels and narrative text to target language. Chart renderer uses translated labels to generate localized PDF.

The intermediate artifact is semi-structured — a fixed JSON container shape with flexible contents. This gives Stage 2 typed, machine-readable numbers for charting (no re-extraction risk), while keeping the schema flexible enough for any Baltic company regardless of sector.

### Document classification (pre-LLM)

The classifier (`classifier.ts`) runs keyword/pattern matching on the first ~2k characters before any GPT-4o call:

| Document type | Behavior | Example patterns |
|---|---|---|
| `financial_report` | Proceed to extraction | Revenue, EBITDA, balance sheet, annual report |
| `auditor_report` | **Reject** | "Independent Auditor's Report", "we have audited" |
| `prospectus` | **Reject** | "Prospectus", "Offering Circular", "subscription period" |
| `legal_filing` | **Reject** (≥2 hits) | "regulated information", "inside information", "pursuant to" |
| `press_release` | **Reject** (if no financial content) | "Press Release", "FOR IMMEDIATE RELEASE" |

Rejected documents get a user-facing message explaining why and what to upload instead.

### Language strategy

- Stage 1 extracts everything and normalizes to English in one LLM call.
- Stage 2 batch-translates all metric labels and narrative text to the target language in one LLM call per language.
- A PostgreSQL-backed translation cache (`translation_cache` table: source_text, et, lv, lt) stores metric labels after first encounter. Subsequent reports hit the cache for consistency and cost savings. No human-maintained glossary.
- If the target language is English (`en`), Stage 2 is skipped entirely — the extraction is already in English.
- PDF section labels (headings, table headers, disclaimer) are localized via hardcoded translation tables for ET/LV/LT, not via LLM calls.

### PDF output

Generic template with data-driven sections:

- Cover (company name, report period, generation date)
- Executive Summary (merged from executive_summary + management_commentary narratives)
- Key Metrics Dashboard (metrics table + YoY badges + sparklines for key metrics)
- Revenue Breakdown (bar + donut charts by segment or geography if present)
- Profitability Trends (multi-series line chart over time)
- Business & Segment Highlights (merged from business_overview + segment_performance narratives)
- Sentiment Analysis (management tone badge, outlook text, risk factors list)
- Outlook (standalone outlook narrative section)
- AI Disclaimer (localized disclaimer footer on every report)

Sections are omitted if the source data is insufficient or the sanitizer drops them (e.g., <2 segments for revenue breakdown, <2 periods for profitability trends).

All section labels, headings, and the disclaimer are localized to the target language (EN/ET/LV/LT) via hardcoded label tables in the assembler.

### Monorepo structure

Three npm workspace packages:

| Package | Name | Role |
|---|---|---|
| `packages/shared` | `@bei/shared` | Types (Job, ExtractedData, etc.), DB pool, Postgres store, S3/disk file store, migrations |
| `packages/web` | `@bei/web` | Next.js 14 frontend (upload UI, polling, download, share pages, access code gate) |
| `packages/worker` | `@bei/worker` | Node.js/TypeScript pipeline worker (parse → classify → extract → dedupe → sanitize → translate → assemble) |

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React 18, TypeScript) |
| Pipeline worker | Node.js/TypeScript (`tsx` runner) |
| LLM | GPT-4o (OpenAI SDK v6) for both extraction and translation |
| File parsing | `pdfjs-dist` (digital PDFs, parallel page batches), `pdf-parse` (OCR screenshots), `csv-parse`, regex-based HTML/XHTML text extraction |
| OCR fallback | `tesseract.js` for scanned/image-only pages |
| Charts | `chart.js` v4 + `canvas` (node-canvas, server-side, headless) |
| PDF rendering | `puppeteer` (Chromium HTML → PDF, with browser pre-warming and multi-attempt launch fallback) |
| Database | PostgreSQL via `pg` (job metadata, translation cache) |
| File storage | **S3-compatible object storage** (AWS S3, Cloudflare R2, Backblaze B2, MinIO) with local disk fallback. Auto-detected via `S3_BUCKET` env var. |
| Job queue | Postgres `jobs` table with `FOR UPDATE SKIP LOCKED` (worker polls for pending jobs) |
| Testing | Vitest with jsdom (unit + integration tests for all packages) |

### Infrastructure

Everything runs on **Railway**:

- **Web service**: Next.js 14 frontend (upload UI, API routes, polling, downloads, share pages, access code gate)
- **Worker service**: Separate Railway service running the Node.js pipeline worker (parse → classify → extract → dedupe → sanitize → translate → assemble)
- **PostgreSQL**: Railway Postgres (jobs, translation cache)
- **S3 storage**: External S3-compatible bucket for uploaded files and generated reports (shared between web and worker services)

```
Railway
├── Web (Next.js)              ├── Worker (Node.js)
│   ├── Upload UI              │   ├── Parse + OCR
│   ├── API routes             │   ├── Document classification
│   ├── Progress polling       │   ├── GPT-4o extraction
│   ├── Download endpoint      │   ├── Metric deduplication
│   ├── Share page (PDF view)  │   ├── Sanitization
│   └── Access code gate       │   ├── GPT-4o translation
│                              │   ├── Chart generation
│                              │   ├── PDF assembly
│                              │   └── DB connection
└──────────────┬───────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
Railway Postgres    S3 Bucket
 ├── jobs          ├── uploads/
 └── translation   └── reports/
     _cache
```

### File storage architecture

Web and worker services on Railway have separate filesystems — disk-based storage cannot work across services. The file store uses an **auto-detection pattern**:

- If `S3_BUCKET` env var is set → uses the S3 file store (`@aws-sdk/client-s3`)
- Otherwise → falls back to local disk (`./bei-data/` or `DATA_DIR`)

Both services inherit the same env vars from Railway, so they both talk to the same S3 bucket. This means files uploaded by the web service are immediately readable by the worker.

S3 env vars: `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`

### UX

- Simple access code → cookie (no user accounts for MVP/hackathon). Middleware checks `bei_access` cookie; unauthenticated users are redirected to `/access`.
- File upload with progress tracker: Parsing → Extracting → Translating → Rendering
- Company name extracted automatically by the LLM from the document
- **Share page** (`/reports/:jobId`): embeds the formatted PDF in-browser via iframe. Includes a Download button that forces file save.
- **PDF links** use `Content-Disposition: inline` — opening the URL displays the PDF in the browser's native viewer.
- Multiple error paths with clear user-facing messages (unsupported type, non-financial document, file too large, no data found, pipeline timeout)
- 100 MB file size limit for all types

### Modules

| # | Module | File | Role |
|---|---|---|---|
| 1 | **File Parser** | `packages/worker/src/parser.ts` | Extracts text from PDF (pdfjs-dist with parallel batch processing, pdf-parse OCR), CSV (csv-parse), HTML/XHTML (regex-based tag stripping). OCR fallback with tesseract.js. Text coherence check. |
| 2 | **Document Classifier** | `packages/worker/src/classifier.ts` | Pre-LLM screen using keyword/pattern matching on first ~2k chars. Rejects auditor reports, prospectuses, legal filings, and press releases. |
| 3 | **Extraction Engine** | `packages/worker/src/extractor.ts` | GPT-4o prompt + structured JSON output → typed financial data, narratives, sentiment, revenue breakdown, profitability trends. |
| 4 | **Metric Deduplicator** | `packages/worker/src/deduplicator.ts` | Post-extraction merge of near-duplicate metric labels using Levenshtein distance (≤3) and Jaccard word similarity (≥0.85). |
| 5 | **Sanitizer** | `packages/worker/src/sanitizer.ts` | Structural validation: drops null-value metrics, duplicate labels, charts with insufficient data (<2 segments/periods), flags implausible YoY swings (>500%). |
| 6 | **Translation Engine** | `packages/worker/src/translator.ts` | GPT-4o batch translation + PostgreSQL-backed self-building cache. Skips entirely for English output. |
| 7 | **Chart Renderer** | `packages/worker/src/chart-renderer.ts` | chart.js + node-canvas → PNG images with localized labels, sparklines, YoY computation with clipping thresholds. |
| 8 | **PDF Assembler** | `packages/worker/src/assembler.ts` | puppeteer HTML template → polished A4 PDF. Browser pre-warming on startup, multi-attempt launch fallback (macOS: chrome stable → bundled → shell). Supports remote browser via `PUPPETEER_BROWSER_WS_ENDPOINT` or `PUPPETEER_BROWSER_URL`. |
| 9 | **Job Orchestrator** | `packages/worker/src/orchestrator.ts` | Postgres-backed job state machine: pending → parsing → extracting → translating → assembling → complete/failed. |
| 10 | **Worker Loop** | `packages/worker/src/worker.ts` + `index.ts` | Polling loop with stale-job recovery sweep (resets stuck jobs after configurable threshold, default 30 min). Env-driven config for poll interval, batch size, sweep settings. |
| 11 | **Web Frontend** | `packages/web/` | Next.js 14 App Router: upload form with language selector, polling progress tracker (4-stage progress bar), download endpoint (inline PDF), share page (embedded PDF iframe), access code gate with middleware. |
| 12 | **Shared Package** | `packages/shared/` | DB pool (`pg`), Postgres-backed job store + translation cache, S3/disk file store (auto-detect), migrations, shared types. |

---

## Testing Decisions

### What makes a good test

Tests should verify behavior through public interfaces, not implementation details. Focus on integration-style tests that exercise real code paths.

### Modules with tests

- **Document Classifier**: verify all rejection categories (auditor reports, prospectuses, legal filings, press releases) and false-positive guard for financial content in press releases
- **Metric Deduplicator**: verify Levenshtein and Jaccard merging of near-duplicate metrics
- **Sanitizer**: verify null metrics dropped, charts dropped when data insufficient, implausible YoY detection
- **Extraction Engine**: verify correctly extracted metrics from known good inputs (fixture file + expected JSON output)
- **Translation Engine**: verify translation cache builds and hits correctly; verify batch translation produces consistent labels
- **PDF Assembler**: verify output PDF contains expected sections when given a complete JSON input; verify sections are omitted when data is missing
- **Chart Renderer**: verify sparkline thresholds, YoY clipping, profitability trend rendering
- **Job Orchestrator**: verify state transitions (pending → parsing → extracting → translating → assembling → complete/failed)
- **Worker Loop**: verify stale-job sweep logic

### Test approach

- Vitest with jsdom for frontend tests, plain Vitest for worker/shared tests
- Use fixture files (example Baltic earnings reports) as test inputs
- Assert on output JSON structure, not exact LLM output (LLM responses have natural variation)
- Run chart/PDF tests as snapshot tests (compare pixel output or text extraction from generated PDF)
- Mock OpenAI API calls in unit tests via `setClient`/`setTranslationClient`; use cached responses for integration tests
- Worker tests exercise the full pipeline with mocked external dependencies

---

## Out of Scope

- User accounts, OAuth, multi-tenancy
- Company name confirmation step (AI extracts, no user input)
- Sector-specific metric schemas (banks vs shipping vs retail)
- Comparison vs prior quarters (v2)
- Automated scraping of exchange websites
- Email notifications for completed reports
- Batch upload of multiple reports
- Nasdaq associate validation workflow (post-hackathon)
- Usage quotas or billing

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

### Risk areas

1. **LLM hallucination**: GPT-4o may fabricate numbers. Mitigation: prominent "AI-generated" disclaimer on every report page (localized to target language).
2. **OCR quality on poor scans**: tesseract.js may produce garbage on low-quality scanned pages. Mitigation: text coherence detection (alpha ratio ≥ 0.45, ≥ 3 words of 3+ letters); fail gracefully with "No financial data found".
3. **Pipeline timeout**: extremely large documents may approach memory limits on worker host. Mitigation: text truncated to 60k chars before LLM call; client-side 9-minute polling timeout; 100 MB file size limit.
4. **Translation consistency across calls**: PostgreSQL-backed translation cache (`translation_cache` table) mitigates this, but first-call translations for rare metrics may vary. Acceptable for MVP.
5. **Stale jobs**: worker crashes while processing leave jobs stuck in intermediate states. Mitigation: stale-job sweep resets jobs in parsing/extracting/translating/assembling back to `pending` after a configurable threshold (default 30 min).
6. **Large XHTML/HTML files**: DOM-based parsers (cheerio) balloon memory 5-10x on large files, crashing the worker with OOM. Mitigation: regex-based HTML text extraction uses O(n) memory; 100 MB file size limit catches oversized files before the worker.
7. **Cross-service file access**: Web and worker have separate filesystems on Railway. Mitigation: S3-compatible object storage as the canonical file store, auto-detected via `S3_BUCKET` env var.

### Post-hackathon roadmap

1. Company name confirmation step (AI suggests, user confirms/corrects)
2. Sector-specific metric schemas (banking, shipping, retail, etc.)
3. Comparison mode (QoQ, YoY)
4. User accounts and history
5. Nasdaq associate validation workflow
6. Multi-report batch processing
7. Email delivery
