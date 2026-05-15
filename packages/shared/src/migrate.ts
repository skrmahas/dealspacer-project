import { getPool, closePool } from "./db";

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state TEXT NOT NULL DEFAULT 'pending',
        original_filename TEXT NOT NULL,
        output_language TEXT NOT NULL DEFAULT 'en',
        extracted_text TEXT,
        extracted_json TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_poll ON jobs(state, created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        source_text TEXT PRIMARY KEY,
        et TEXT,
        lv TEXT,
        lt TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        source TEXT,
        user_agent TEXT,
        referrer TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        ticker TEXT,
        exchange TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        country TEXT,
        sector TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companies_exchange ON companies(exchange);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        fiscal_year INTEGER NOT NULL,
        report_type TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'en',
        job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
        s3_key TEXT NOT NULL,
        extracted_json_snapshot JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (company_id, fiscal_year, report_type, language)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_company_id ON reports(company_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_job_id ON reports(job_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    `);

    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
    `);

    console.log("Migration complete: jobs, translation cache, leads, companies, reports ready.");
  } finally {
    client.release();
  }
}

// Exported for programmatic use (does NOT close the pool)
export async function runMigrations(): Promise<void> {
  await migrate();
}

// Standalone CLI usage
const isMain = process.argv[1]?.includes("migrate");
if (isMain) {
  migrate()
    .then(() => closePool())
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
