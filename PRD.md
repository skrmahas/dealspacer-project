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
- A self-building translation cache stores metric labels after first encounter. Subsequent reports hit the cache for consistency and cost savings. No human-maintained glossary.

### PDF output

Generic template with data-driven sections:

- Cover (company logo, title, date)
- Executive Summary (3-4 paragraph narrative)
- Key Metrics Dashboard (Revenue, EBITDA, Net Profit + YoY change + sparklines)
- Revenue Breakdown (charts by segment/geography if present in source)
- Profitability Trends (line/bar charts over time)
- Balance Sheet Highlights (key ratios, whatever the source contains)
- Sentiment Analysis (management tone, outlook, risk factors)
- Source Attribution + AI disclaimer

Sections are omitted if the source data is insufficient.

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (Vercel Pro) |
| Pipeline worker | Node.js/TypeScript (Railway Hobby, $5/mo) |
| LLM | GPT-4o for both extraction and translation |
| File parsing | `pdf-parse` (digital PDFs), `csv-parse`, `cheerio` (HTML) |
| OCR fallback | `tesseract.js` for scanned/image-only pages |
| Charts | `chart.js` + `canvas` (server-side, headless) |
| PDF rendering | `puppeteer` (HTML → PDF) |
| Database | Railway Postgres (job status, translation cache) |
| Job queue | Postgres `jobs` table (worker polls for pending jobs) |

### Infrastructure

```
Vercel Pro (Next.js)           Railway Hobby (Pipeline Worker)
├── Upload UI                  ├── Parse + OCR
├── Progress tracker (polling) ├── GPT-4o extraction
├── Download endpoint          ├── GPT-4o translation
├── Shareable links            ├── Chart generation
└── Access code gate           ├── PDF assembly
                               └── Postgres (shared)
```

### UX

- Simple access code → cookie (no user accounts for MVP/hackathon)
- File upload with progress tracker: Parsing → Extracting → Translating → Rendering
- Company name extracted automatically by the LLM from the document
- Download button + shareable link (`/reports/:jobId`)
- Single error path: "No financial data found in this document" for non-financial uploads

### Modules

1. **File Parser** — extracts text from PDF/CSV/HTML; OCR fallback for image pages
2. **Extraction Engine** — GPT-4o prompt + semi-structured JSON schema → typed financial data
3. **Translation Engine** — GPT-4o batch translation + self-building cache
4. **Chart Renderer** — chart.js → chart images with localized labels
5. **PDF Assembler** — puppeteer HTML template → polished PDF
6. **Job Orchestrator** — Postgres-backed job state machine
7. **Web Frontend** — Next.js upload, polling, download UI

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

- Use fixture files (example Baltic earnings reports) as test inputs
- Assert on output JSON structure, not exact LLM output (LLM responses have natural variation)
- Run chart/PDF tests as snapshot tests (compare pixel output or text extraction from generated PDF)
- Mock OpenAI API calls in unit tests; use a cached response for integration tests

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
- Requires Railway account (Hobby plan) for the pipeline worker
- Requires Vercel Pro for frontend hosting
- The `puppeteer` dependency ships a Chromium binary (~300MB) — acceptable on Railway but increases cold start time

### Risk areas

1. **LLM hallucination**: GPT-4o may fabricate numbers. Mitigation: prominent "AI-generated" disclaimer on every report page.
2. **OCR quality on poor scans**: tesseract.js may produce garbage on low-quality scanned pages. Mitigation: detect OCR failure by measuring text coherence; fail gracefully.
3. **Pipeline timeout on Railway**: extremely large documents may approach memory limits. Mitigation: page-level processing, not whole-document-in-memory.
4. **Translation consistency across calls**: self-building cache mitigates this, but first-call translations for rare metrics may vary. Acceptable for MVP.

### Post-hackathon roadmap

1. Company name confirmation step (AI suggests, user confirms/corrects)
2. Sector-specific metric schemas (banking, shipping, retail, etc.)
3. Comparison mode (QoQ, YoY)
4. User accounts and history
5. Nasdaq associate validation workflow
6. Multi-report batch processing
7. Email delivery
