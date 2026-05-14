import { getPool, closePool } from "./packages/shared/src/db.js";
const p = getPool();
try {
  const r = await p.query("SELECT id, state, original_filename, error, LEFT(extracted_text, 200) as text_preview, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;");
  console.log(JSON.stringify(r.rows, null, 2));
} finally {
  await closePool();
}
