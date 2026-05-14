import { getPool, closePool } from "./packages/shared/src/db";

const pool = getPool();
const r = await pool.query("SELECT id, state, original_filename, error, extracted_text, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;");
console.log(JSON.stringify(r.rows, null, 2));
await closePool();
