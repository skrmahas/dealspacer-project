# Baltic Earnings Intelligence — PRD

## Problem Statement

Investors, analysts, and IR professionals covering the Baltic exchanges (Nasdaq Tallinn, Riga, Vilnius) need to digest earnings reports from ~40 listed companies. These reports are published in multiple formats (PDF, CSV, HTML), can be up to 200 pages long, and are often in Estonian, Latvian, or Lithuanian. Extracting key financial metrics, understanding management sentiment, and comparing performance across quarters requires hours of manual work per report. There is no tool that automatically transforms a raw Baltic earnings filing into a clean, metric-rich summary in English and local languages.

## Solution

A web application where users upload a Baltic company earnings report in any format (PDF, CSV, HTML). The system:

1. Parses and extracts financial data into structured, machine-readable format
2. Translates metrics and narratives into English + local Baltic languages (ET/LV/LT)
3. Generates a polished PDF report with charts, key metrics, sentiment analysis, and an executive summary

The output is a single, investor-ready document that can be downloaded or shared via link.

---

## User Stories

1. As an IR professional, I want to upload a 150-page annual report PDF and receive a 4-page summary with the key financials, so that I can quickly brief my team before an investor call.
2. As a Nasdaq associate, I want the system to extract revenue, EBITDA, and net profit automatically, so that I don't have to hunt through footnotes and tables manually.
3. As an analyst covering multiple Baltic companies, I want a consistent report template regardless of which company or filing format I upload, so that I can compare results across my coverage universe.
4. As a Latvian-speaking investor, I want the report in Latvian, so that I can read it in my native language without relying on machine-translated news articles.
5. As an Estonian fund manager, I want the report to show charts (revenue trend, segment breakdown, profitability), so that I can visually grasp performance at a glance.
6. As a user, I want to see sentiment analysis of management's tone and forward guidance, so that I can gauge confidence beyond the raw numbers.
7. As a user, I want confirmation that the document contains financial data and a clear error message if it doesn't, so that I don't waste time on invalid uploads.
8. As a user, I want to share the generated report with a colleague via a link, so that we can collaborate without downloading and emailing files.
9. As a demo audience member, I want the output to look professional and branded, so that I trust the product enough to try it myself.
10. As a hackathon judge, I want to see a clear pipeline and architecture, so that I understand the technical depth of the solution.

---

## Implementation Decisions

### Architecture

**Two-stage pipeline** with semi-structured JSON as the intermediate artifact:

- **Stage 1**: GPT-4o extracts financial data from parsed/OCR'd document text → English semi-structured JSON. Numbers stay as typed numbers, metrics are flexible (whatever the source contains), narrative text is translated to English.
- **Stage 2**: GPT-4o batch-translates all metric labels and narrative text to target language. Chart renderer uses translated labels to generate localized PDF.

The intermediate artifact is semi-structured — a fixed JSON container shape with flexible contents. This gives Stage 2 typed, machine-readable numbers for charting (no re-extraction risk), while keeping the schema flexible enough for any Baltic company regardless of sector.

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

Sections are omitted if the source data is insufficient.

All section labels, headings, and the disclaimer are localized to the target language (EN/ET/LV/LT) via hardcoded label tables in the assembler.

### Monorepo structure

Three npm workspace packages:

| Package | Name | Role |
|---|---|---|
| `packages/shared` | `@bei/shared` | Types (Job, ExtractedData, etc.), DB pool, Postgres store, file store |
| `packages/web` | `@bei/web` | Next.js 14 frontend (upload UI, polling, download, share links) |
| `packages/worker` | `@bei/worker` | Node.js/TypeScript pipeline worker (parse → extract → translate → assemble) |

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React 18, TypeScript) |
| Pipeline worker | Node.js/TypeScript (`tsx` runner) |
| LLM | GPT-4o (OpenAI SDK v6) for both extraction and translation |
| File parsing | `pdfjs-dist` (digital PDFs), `pdf-parse` (OCR screenshots), `csv-parse`, `cheerio` (HTML) |
| OCR fallback | `tesseract.js` for scanned/image-only pages |
| Charts | `chart.js` v4 + `canvas` (node-canvas, server-side, headless) |
| PDF rendering | `puppeteer` (Chromium HTML → PDF, with multi-attempt launch fallback) |
| Database | PostgreSQL via `pg` (job metadata, uploaded files as BYTEA, generated PDFs, translation cache) |
| Job queue | Postgres `jobs` table with `FOR UPDATE SKIP LOCKED` (worker polls for pending jobs) |
| Testing | Vitest with jsdom (unit + integration tests for all packages) |

### Infrastructure

Everything runs on **Railway**:

- **Web service**: Next.js 14 frontend (upload UI, API routes, polling, downloads, share pages)
- **Worker service**: Separate Railway service running the Node.js pipeline worker (parse → extract → translate → assemble)
- **PostgreSQL**: Railway Postgres (jobs, file storage, translation cache)

```
Railway
├── Web (Next.js)              ├── Worker (Node.js)
│   ├── Upload UI              │   ├── Parse + OCR
│   ├── API routes             │   ├── GPT-4o extraction
│   ├── Progress polling       │   ├── GPT-4o translation
│   ├── Download endpoint      │   ├── Chart generation
│   └── Access code gate       │   ├── PDF assembly
│                              │   └── DB connection
└──────────────────┬───────────┘
                   │
           Railway Postgres
      ├── jobs (metadata + state)
      ├── files & reports (BYTEA)
      └── translation_cache
```

### UX

- Simple access code → cookie (no user accounts for MVP/hackathon)
- File upload with progress tracker: Parsing → Extracting → Translating → Rendering
- Company name extracted automatically by the LLM from the document
- Download button + shareable link (`/reports/:jobId`)
- Single error path: "No financial data found in this document" for non-financial uploads

### Modules

1. **File Parser** (`packages/worker/src/parser.ts`) — extracts text from PDF (pdfjs-dist, pdf-parse OCR), CSV, HTML; OCR fallback with tesseract.js
2. **Extraction Engine** (`packages/worker/src/extractor.ts`) — GPT-4o prompt + structured JSON output → typed financial data
3. **Translation Engine** (`packages/worker/src/translator.ts`) — GPT-4o batch translation + PostgreSQL-backed self-building cache
4. **Chart Renderer** (`packages/worker/src/chart-renderer.ts`) — chart.js + node-canvas → PNG images with localized labels, sparklines, YoY computation
5. **PDF Assembler** (`packages/worker/src/assembler.ts`) — puppeteer HTML template → polished A4 PDF with multi-attempt browser launch
6. **Job Orchestrator** (`packages/worker/src/orchestrator.ts`) — Postgres-backed job state machine (pending → parsing → extracting → translating → assembling → complete/failed)
7. **Worker Loop** (`packages/worker/src/worker.ts` + `index.ts`) — polling loop with stale-job recovery sweep, env-driven config
8. **Web Frontend** (`packages/web/`) — Next.js 14 App Router: upload form, polling progress tracker, download endpoint, share page
9. **Shared Package** (`packages/shared/`) — DB pool (`pg`), Postgres-backed job store + file store + translation cache, migrations, shared types

---

## Testing Decisions

### What makes a good test

Tests should verify behavior through public interfaces, not implementation details. Focus on integration-style tests that exercise real code paths.

### Modules to test

- **Extraction Engine**: verify correctly extracted metrics from known good PDF inputs (fixture file + expected JSON output)
- **Translation Engine**: verify translation cache builds and hits correctly; verify batch translation produces consistent labels
- **PDF Assembler**: verify output PDF contains expected sections when given a complete JSON input; verify sections are omitted when data is missing
- **Job Orchestrator**: verify state transitions (pending → parsing → extracting → translating → rendering → complete)

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
- Full error taxonomy beyond "no financial data found"
- Sector-specific metric schemas (banks vs shipping vs retail)
- Comparison vs prior quarters (v2)
- Automated scraping of exchange websites
- Email notifications for completed reports
- Batch upload of multiple reports
- Nasdaq associate validation workflow (post-hackathon)
- Usage quotas or billing

---

## Further Notes

### Dependencies

- Requires OpenAI API key with GPT-4o access
- Requires Railway account with Postgres, web service, and worker service
- Worker service needs Chromium for PDF generation (puppeteer bundled binary or remote browser via `PUPPETEER_BROWSER_URL`)

### Risk areas

1. **LLM hallucination**: GPT-4o may fabricate numbers. Mitigation: prominent "AI-generated" disclaimer on every report page (localized to target language).
2. **OCR quality on poor scans**: tesseract.js may produce garbage on low-quality scanned pages. Mitigation: text coherence detection (alpha ratio ≥ 0.45, ≥ 3 words of 3+ letters); fail gracefully with "No financial data found".
3. **Pipeline timeout**: extremely large documents may approach memory limits on worker host. Mitigation: text truncated to 60k chars before LLM call; client-side 9-minute polling timeout.
4. **Translation consistency across calls**: PostgreSQL-backed translation cache (`translation_cache` table) mitigates this, but first-call translations for rare metrics may vary. Acceptable for MVP.
5. **Stale jobs**: worker crashes while processing leave jobs stuck in intermediate states. Mitigation: stale-job sweep resets jobs in parsing/extracting/translating/assembling back to `pending` after a configurable threshold (default 30 min).

### Post-hackathon roadmap

1. Company name confirmation step (AI suggests, user confirms/corrects)
2. Sector-specific metric schemas (banking, shipping, retail, etc.)
3. Comparison mode (QoQ, YoY)
4. User accounts and history
5. Nasdaq associate validation workflow
6. Multi-report batch processing
7. Email delivery
