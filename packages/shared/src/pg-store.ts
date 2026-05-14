import { withClient } from "./db.js";
import type { Job, CreateJobInput, UpdateJobInput, JobStore } from "./index.js";

function rowToJob(row: Record<string, unknown>): Job {
  return row as unknown as Job;
}

export function createPostgresStore(): JobStore {
  return {
    async createJob(input: CreateJobInput): Promise<Job> {
      return withClient(async (client) => {
        const result = await client.query(
          `INSERT INTO jobs (original_filename)
           VALUES ($1)
           RETURNING *`,
          [input.originalFilename],
        );
        return rowToJob(result.rows[0]);
      });
    },

    async getJob(id: string): Promise<Job | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `SELECT * FROM jobs WHERE id = $1`,
          [id],
        );
        return result.rows.length > 0 ? rowToJob(result.rows[0]) : null;
      });
    },

    async updateJob(id: string, input: UpdateJobInput): Promise<Job> {
      return withClient(async (client) => {
        const sets: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (input.state !== undefined) {
          sets.push(`state = $` + paramIndex);
          values.push(input.state);
          paramIndex++;
        }
        if (input.extractedText !== undefined) {
          sets.push(`extracted_text = $` + paramIndex);
          values.push(input.extractedText);
          paramIndex++;
        }
        if (input.extractedJson !== undefined) {
          sets.push(`extracted_json = $` + paramIndex);
          values.push(input.extractedJson);
          paramIndex++;
        }
        if (input.error !== undefined) {
          sets.push(`error = $` + paramIndex);
          values.push(input.error);
          paramIndex++;
        }

        if (sets.length === 0) {
          const result = await client.query(
            `SELECT * FROM jobs WHERE id = $1`,
            [id],
          );
          if (result.rows.length === 0) throw new Error(`Job ${id} not found`);
          return rowToJob(result.rows[0]);
        }

        sets.push(`updated_at = NOW()`);
        values.push(id);

        const result = await client.query(
          `UPDATE jobs SET ` + sets.join(", ") + ` WHERE id = $` + paramIndex + ` RETURNING *`,
          values,
        );

        if (result.rows.length === 0) throw new Error(`Job ${id} not found`);
        return rowToJob(result.rows[0]);
      });
    },

    async pollNextPending(): Promise<Job | null> {
      return withClient(async (client) => {
        const result = await client.query(
          `UPDATE jobs
           SET state = 'parsing', updated_at = NOW()
           WHERE id = (
             SELECT id FROM jobs
             WHERE state = 'pending'
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           RETURNING *`,
        );

        if (result.rows.length > 0) {
          await client.query(
            `UPDATE jobs SET state = 'pending' WHERE id = $1`,
            [result.rows[0].id],
          );
          return rowToJob(result.rows[0]);
        }
        return null;
      });
    },
  };
}
