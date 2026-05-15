import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from packages/worker/
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { parseDocument } from "./parser.js";
import { extractFromText } from "./extractor.js";
import { translateExtractedData } from "./translator.js";
import { assemblePdf, warmBrowser, checkBrowserHealth, closeBrowser } from "./assembler.js";
import { startHealthServer } from "./health-server.js";
import { processJob } from "./orchestrator.js";
import { startWorker } from "./worker.js";
import { createPostgresStore, createAutoFileStore, createPostgresFileStore, runMigrations, getPool } from "@bei/shared";

await runMigrations();

// ── Startup health check ──────────────────────────────────────────────

console.log("[worker] Running startup health checks...");

// Verify database connectivity
const pool = getPool();
try {
  const dbResult = await pool.query("SELECT 1 AS ok");
  if (dbResult.rows[0]?.ok !== 1) {
    throw new Error("Unexpected response from database");
  }
  console.log("[worker] Database connectivity: OK");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[worker] FATAL: Database connectivity check failed: ${message}`);
  process.exit(1);
}

// Verify OpenAI API key is configured
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error("[worker] FATAL: OPENAI_API_KEY environment variable is not set");
  process.exit(1);
}
console.log("[worker] OpenAI API key: configured");

// Verify file store accessibility
const fileStore = createPostgresFileStore();
try {
  const testBuffer = Buffer.from("healthcheck");
  await fileStore.saveFile("__healthcheck__", testBuffer);
  const readBack = await fileStore.readFile("__healthcheck__");
  if (readBack.toString() !== "healthcheck") {
    throw new Error("Read-back mismatch");
  }
  console.log("[worker] File store accessibility: OK");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[worker] FATAL: File store not accessible: ${message}`);
  process.exit(1);
}

console.log("[worker] Health check passed");

const store = createPostgresStore();
const { readFile, saveReport } = createAutoFileStore();
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS = 30_000;
const DEFAULT_STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;
const BROWSER_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_SHUTDOWN_GRACE_MS = 120_000;
const DEFAULT_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_JOB_RETENTION_MIN_COUNT = 50;
const DEFAULT_HEARTBEAT_MS = 60_000;
const DEFAULT_HEALTH_PORT = 3001;

const startTime = Date.now();
let jobsProcessed = 0;

function formatMemoryMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

function logMemoryUsage(): void {
  const mem = process.memoryUsage();
  const rssMb = formatMemoryMb(mem.rss);
  const heapTotalMb = formatMemoryMb(mem.heapTotal);
  const heapUsedMb = formatMemoryMb(mem.heapUsed);
  console.log(`[worker] Memory: RSS=${rssMb} MB, heap=${heapUsedMb}/${heapTotalMb} MB`);

  const maxRssMbRaw = process.env.WORKER_MAX_RSS_MB;
  if (maxRssMbRaw) {
    const maxRssMb = Number(maxRssMbRaw);
    if (Number.isFinite(maxRssMb) && mem.rss > maxRssMb * 1024 * 1024) {
      console.warn(`[worker] WARNING: RSS (${rssMb} MB) exceeds threshold (${maxRssMb} MB)`);
    }
  }
}

function readPositiveMsEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`${name} must be a positive number. Using default ${fallback}.`);
    return fallback;
  }
  return parsed;
}

// Periodic browser health check
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let stopped = false;

healthCheckTimer = setInterval(async () => {
  if (stopped) return;
  const healthy = await checkBrowserHealth();
  if (!healthy) {
    console.warn("[worker] Browser health check failed — restarting browser");
    await closeBrowser();
    await warmBrowser();
  }
}, BROWSER_HEALTH_CHECK_INTERVAL_MS);

// Periodic job retention cleanup
const retentionMs = readPositiveMsEnv("JOB_RETENTION_MS", DEFAULT_JOB_RETENTION_MS);
const retentionMinCount = Math.max(
  1,
  parseInt(process.env.JOB_RETENTION_MIN_COUNT || String(DEFAULT_JOB_RETENTION_MIN_COUNT), 10) || DEFAULT_JOB_RETENTION_MIN_COUNT,
);
let retentionTimer: ReturnType<typeof setInterval> | null = null;
if (typeof store.deleteOldJobs === "function") {
  retentionTimer = setInterval(async () => {
    if (stopped) return;
    try {
      const deleted = await store.deleteOldJobs!(retentionMs, retentionMinCount);
      if (deleted > 0) {
        console.log(`[worker] Cleaned up ${deleted} old job(s)`);
      }
    } catch (error) {
      console.error("Job retention cleanup failed:", error instanceof Error ? error.message : error);
    }
  }, readPositiveMsEnv("STALE_JOB_SWEEP_INTERVAL_MS", 30_000));
}

const stopWorker = startWorker({
  store,
  processJob: async (job, store) => {
    try {
      await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);
    } finally {
      jobsProcessed++;
      logMemoryUsage();
    }
  },
  pollIntervalMs: readPositiveMsEnv("WORKER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
  staleJobSweepIntervalMs: readPositiveMsEnv("STALE_JOB_SWEEP_INTERVAL_MS", DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS),
  staleJobThresholdMs: readPositiveMsEnv("STALE_JOB_THRESHOLD_MS", DEFAULT_STALE_JOB_THRESHOLD_MS),
});

console.log("Worker started. Polling for pending jobs...");

// Start health check HTTP server
const healthPort = parseInt(process.env.WORKER_HEALTH_PORT || String(DEFAULT_HEALTH_PORT), 10) || DEFAULT_HEALTH_PORT;
const stopHealthServer = startHealthServer(healthPort, { startTime, get jobsProcessed() { return jobsProcessed; } });

// Warm the PDF browser after polling starts. Browser startup can be slow or
// flaky on hosted runtimes; it must not prevent pending jobs from being claimed.
void warmBrowser().catch((error) => {
  console.warn("[worker] Browser warm-up failed; will retry during PDF assembly:", error instanceof Error ? error.message : error);
});

// Periodic heartbeat for external monitoring
const heartbeatMs = readPositiveMsEnv("WORKER_HEARTBEAT_MS", DEFAULT_HEARTBEAT_MS);
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
heartbeatTimer = setInterval(() => {
  if (stopped) return;
  const uptimeMin = Math.round((Date.now() - startTime) / 60000);
  const mem = process.memoryUsage();
  const rssMb = (mem.rss / (1024 * 1024)).toFixed(0);
  console.log(`[worker] Heartbeat: uptime=${uptimeMin}m, jobs=${jobsProcessed}, RSS=${rssMb} MB`);
}, heartbeatMs);

const shutdown = async () => {
  console.log("Shutting down...");
  stopped = true;
  stopWorker.stop();
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  await stopHealthServer();

  const graceMs = readPositiveMsEnv("WORKER_SHUTDOWN_GRACE_MS", DEFAULT_SHUTDOWN_GRACE_MS);
  console.log(`[worker] Shutting down gracefully — waiting up to ${graceMs}ms for current job...`);
  await stopWorker.drain(graceMs);

  await closeBrowser().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
