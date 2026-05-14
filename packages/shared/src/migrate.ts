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
      CREATE TABLE IF NOT EXISTS translation_cache (
        source_text TEXT PRIMARY KEY,
        et TEXT,
        lv TEXT,
        lt TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Migration complete: jobs and translation cache ready.");
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
