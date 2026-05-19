# Dealspacer

> **Baltic Earnings Intelligence** — AI-powered pipeline that transforms raw Baltic earnings filings into structured, investor-ready summaries with a browsable company catalog and report comparison.

This monorepo (npm workspaces) provides a web application and background worker that parse, extract, translate, and summarise earnings reports from ~40 listed companies across Nasdaq Tallinn, Riga, and Vilnius.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React 18, TypeScript), Tailwind CSS, chart.js |
| Worker | Node.js / TypeScript (tsx runner) |
| LLM | OpenAI GPT-4o (extraction, translation) |
| Database | PostgreSQL (via `pg`) |
| File storage | S3-compatible object storage (auto-detect) or local disk fallback |
| PDF rendering | Puppeteer (Chromium) + node-canvas + chart.js |
| File parsing | pdfjs-dist, pdf-parse, tesseract.js, csv-parse |
| Testing | Vitest |

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** (workspaces-enabled)
- **PostgreSQL** – local or remote (e.g. Railway, or the provided `docker-compose.yml`)
- **OpenAI API key** with GPT-4o access
- **S3-compatible bucket** (optional — falls back to local disk)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd dealspacer
npm install
```

### 2. Configure environment

Copy the example env files and fill in your values:

```bash
cp packages/web/.env.example packages/web/.env
cp packages/worker/.env.example packages/worker/.env
```

**Required variables:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/bei`) |
| `OPENAI_API_KEY` | OpenAI API key with GPT-4o access |

See `packages/web/.env.example` and `packages/worker/.env.example` for all optional settings (S3, worker tuning, Puppeteer, access code, etc.).

### 3. Start PostgreSQL (local dev)

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container with database `bei`, user `bei`, password `bei`.

### 4. Run database migrations

```bash
npm run db:migrate
```

Optionally seed the company catalog:

```bash
npm run db:seed
```

## How to Run

### Start the web app

```bash
npm run dev:web
```

Opens at [http://localhost:3000](http://localhost:3000).

### Start the background worker

In a separate terminal:

```bash
npm run dev:worker
```

The worker polls the `jobs` table and processes uploaded earnings reports through the pipeline (parse → classify → extract → dedupe → sanitize → translate → assemble → publish).

### Build for production

```bash
npm run build
npm start
```

## Project Structure

```
packages/
├── shared/       # @bei/shared — Types, DB pool, Postgres stores, S3/disk file store, migrations
├── web/          # @bei/web    — Next.js 14 frontend (catalog, upload, comparison, admin)
└── worker/       # @bei/worker — Background pipeline worker + import CLI
```

## Environment Variables

See each package's `.env.example` for the full list. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — GPT-4o API key
- `BEI_ACCESS_CODE` — Access code for protected routes (auto-generated in dev if unset)
- `S3_BUCKET` — S3 bucket name (optional; falls back to local disk)
- `PUPPETEER_BROWSER_WS_ENDPOINT` — Remote browser endpoint (optional)
