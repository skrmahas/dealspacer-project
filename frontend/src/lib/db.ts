import { Pool, QueryResultRow } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]) =>
    pool.query<T>(text, params),

  createJob: async (originalFilename: string, filePath: string) => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO jobs (original_filename, file_path, state)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [originalFilename, filePath]
    );
    return result.rows[0];
  },

  getJob: async (id: string) => {
    const result = await pool.query(
      `SELECT id, state, original_filename, extracted_text, error_message, created_at, updated_at
       FROM jobs WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  },
};
