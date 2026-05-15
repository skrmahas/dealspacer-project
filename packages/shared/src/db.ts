import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new Pool({
      connectionString,
      max: readPositiveIntEnv("DATABASE_POOL_MAX", 5),
      idleTimeoutMillis: readPositiveIntEnv("DATABASE_POOL_IDLE_TIMEOUT_MS", 10000),
      connectionTimeoutMillis: readPositiveIntEnv("DATABASE_POOL_CONNECTION_TIMEOUT_MS", 5000),
    });
  }
  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// For tests: override with a mock/underlying pool
export function setPool(p: Pool): void {
  pool = p;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
