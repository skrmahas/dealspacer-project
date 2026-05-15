# Baltic Earnings Intelligence — Context

## Glossary

| Term | Definition |
|---|---|
| **Job** | A single pipeline run. One uploaded file → one job. States: `pending → parsing → extracting → translating → assembling → complete / failed / duplicate`. Jobs are transient — they can be cleaned up without losing catalog data. |
| **Pipeline** | Multi-stage AI processing: parse → classify → extract → dedupe → sanitize → translate → assemble. Produces an AI-generated summary PDF from a raw earnings filing. |
| **Company** | A Baltic listed company with a curated identity: name, ticker, exchange (Tallinn/Riga/Vilnius), and URL-friendly slug. Stored in the `companies` table. ~40 companies total. |
| **Report** | A persistent catalog entry linking a company to a fiscal year, report type (annual/q1/q2/q3/q4/semi-annual/other), language (en/et/lv/lt), and the generated PDF in S3. Created by the worker when a job completes successfully. Stored in the `reports` table. Survives job deletion. |
| **Catalog** | The browsable collection of companies and their reports. The product's persistent layer — users browse here first, then upload or compare. |
| **Comparison** | Side-by-side view of two reports' extracted metrics, sentiment, and charts. Powered by stored `extracted_json_snapshot` — no additional LLM calls. |
| **Extracted data** | Semi-structured JSON from GPT-4o: `metadata` (companyName, reportPeriod), `metrics[]`, `narratives[]`, `sentiment`, `revenueBreakdown?`, `profitabilityTrends?`. The pipeline's intermediate artifact. Snapshotted into `reports.extracted_json_snapshot`. |
| **Unmatched report** | A report whose AI-extracted company name didn't match any `companies` row (fuzzy Levenshtein < 85% confidence). Gets `company_id = null` and appears on the admin unmatched page for manual mapping. |
| **Duplicate report** | A job that, on completion, collides with an existing `reports` row on the unique constraint `(company_id, fiscal_year, report_type, language)`. The job enters `duplicate` state rather than silently overwriting. |
| **Access code** | Single shared password (`BEI_ACCESS_CODE` env var) stored in a cookie (`bei_access`). No user accounts. Middleware redirects unauthenticated users to `/access`. |

## Architecture

```
User
 │
 ├── Web (Next.js 14, packages/web)
 │   ├── /                          Company directory (landing page, sidebar)
 │   ├── /companies/:slug           Company detail (report timeline)
 │   ├── /compare                   Side-by-side comparison (primary metrics weighted 2×)
 │   ├── /reports/:reportId         Individual report view (PDF embed)
 │   ├── /reports/:jobId            Legacy redirect → report view
 │   ├── /upload                    Upload form (with optional ?company= context)
 │   ├── /admin/unmatched           Admin: map unknown reports to companies
 │   └── /access                    Access code gate
 │
 ├── Worker (Node.js, packages/worker)
 │   ├── Polls jobs table (FOR UPDATE SKIP LOCKED)
 │   ├── Pipeline: parser → classifier → extractor → deduplicator → sanitizer →
 │   │            translator → chart-renderer → assembler
 │   └── On complete: company-matcher → create reports row / detect duplicate
 │
 ├── Shared (packages/shared)
 │   ├── Types: Job, Company, Report, ExtractedData, etc.
 │   ├── DB pool + Postgres stores (jobs, companies, reports, translation cache)
 │   ├── File store (S3 auto-detect, local disk fallback)
 │   └── Migrations
 │
 ├── PostgreSQL (Railway)
 │   ├── jobs                 Transient pipeline processing
 │   ├── companies            Curated company directory
 │   ├── reports              Persistent catalog (FK → companies, FK → jobs)
 │   ├── translation_cache    Self-building metric label translations
 │   └── leads                Email capture (existing)
 │
 └── S3-compatible storage
     ├── uploads/             Raw uploaded files
     └── reports/             Generated PDF reports
```

## Data model (new tables, post-catalog)

```
companies
├── id UUID PK
├── name TEXT UNIQUE
├── ticker TEXT
├── exchange TEXT — "Tallinn" | "Riga" | "Vilnius"
├── slug TEXT UNIQUE
└── created_at TIMESTAMPTZ

reports
├── id UUID PK
├── company_id UUID FK → companies(id) — nullable (unmatched)
├── fiscal_year INTEGER
├── report_type TEXT — "annual" | "q1" | "q2" | "q3" | "q4" | "semi-annual" | "other"
├── language TEXT — "en" | "et" | "lv" | "lt"
├── job_id UUID FK → jobs(id)
├── s3_key TEXT — path to generated PDF
├── extracted_json_snapshot JSONB — copy of ExtractedData for comparison
├── created_at TIMESTAMPTZ
└── UNIQUE (company_id, fiscal_year, report_type, language)

jobs (+ new column)
└── + company_id UUID FK → companies(id) — nullable, set at upload time
```

## Key files

| File | Role |
|---|---|
| `PRD.md` | Canonical product spec. Read it before working on any issue. |
| `CONTEXT.md` | This file — domain glossary and architecture overview. |
| `packages/shared/src/index.ts` | All shared TypeScript types and interfaces. |
| `packages/shared/src/migrate.ts` | Database schema — all CREATE TABLE / INDEX statements. |
| `packages/shared/src/pg-store.ts` | Postgres store methods — CRUD for jobs, companies, reports, translation cache. |
| `packages/shared/src/db.ts` | DB pool (pg), `withClient()` helper. |
| `packages/shared/src/file-store.ts` | S3 + local disk file storage with auto-detection. |
| `packages/worker/src/orchestrator.ts` | Pipeline state machine and completion hook. |
| `packages/worker/src/index.ts` | Worker entry point — polling loop. |
| `packages/web/src/app/page.tsx` | Landing page (company directory, post-catalog). |
| `packages/web/src/app/layout.tsx` | Root layout. |
| `packages/web/middleware.ts` | Access code gate. |

## Conventions

### Branch workflow
- Create a branch from up-to-date `main` for each issue: `git checkout -b issue/NNN-short-description`
- Commit only changes for that issue
- Push and open a PR before merging
- Never commit directly to `main` unless explicitly asked

### Testing
- Vitest with jsdom for frontend, plain Vitest for worker/shared
- Tests verify behavior through public interfaces
- Mock OpenAI calls; use fixture files for pipeline tests
- Isolate DB state per test

### Code patterns
- DB access: always through `withClient()` or the store methods in `pg-store.ts`
- File storage: always through `createAutoFileStore` (S3 auto-detect)
- API routes: follow existing patterns in `packages/web/src/app/api/`
- New store methods: add to the existing `createPostgresStore()` factory

### Naming
- Use the glossary terms exactly. Don't invent synonyms.
- Database columns: `snake_case` → TypeScript: `camelCase` (mapped in row-to-type functions)
- API responses: `camelCase` JSON
- Routes: `/companies/:slug`, `/reports/:reportId`, `/compare?reportA=&reportB=`

## Out of scope (for this phase)
- User accounts / OAuth
- Sector-specific metric schemas
- Nasdaq scraping
- Email notifications
- Sparklines
- LLM-generated comparison narratives
- Batch upload via UI (CLI import handles bulk seeding)

## Related docs
- `docs/agents/triage-labels.md` — issue triage label vocabulary
- `docs/agents/issue-tracker.md` — GitHub Issues conventions
- `docs/agents/domain.md` — how agents consume domain documentation
