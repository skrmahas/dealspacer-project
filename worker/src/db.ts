import pg from "pg";

let pool: pg.Pool;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000 });
    pool.on("error", (err) => console.error("Unexpected Postgres pool error:", err));
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function getPendingJob(): Promise<{ id: string; original_filename: string; file_path: string } | null> {
  const result = await query<{ id: string; original_filename: string; file_path: string }>(
    `UPDATE jobs SET state = 'parsing', updated_at = NOW()
     WHERE id = (SELECT id FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING id, original_filename, file_path`
  );
  return result.rows[0] ?? null;
}

export async function completeJob(id: string, extractedText: string): Promise<void> {
  await query(`UPDATE jobs SET state = 'complete', extracted_text = $2, updated_at = NOW(), completed_at = NOW() WHERE id = $1`, [id, extractedText]);
}

export async function failJob(id: string, error: string): Promise<void> {
  await query(`UPDATE jobs SET state = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, [id, error]);
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
}
