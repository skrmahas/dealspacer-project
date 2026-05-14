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
import { processJob } from "./orchestrator.js";
import { startWorker } from "./worker.js";
import { createPostgresStore, createPostgresFileStore, runMigrations } from "@bei/shared";

await runMigrations();

// Pre-warm the Puppeteer browser at startup to avoid cold-start latency on first job
await warmBrowser();

const store = createPostgresStore();
const { readFile, saveReport } = createPostgresFileStore();
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS = 30_000;
const DEFAULT_STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;
const BROWSER_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_SHUTDOWN_GRACE_MS = 120_000;

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

const stopWorker = startWorker({
  store,
  processJob: async (job, store) => {
    try {
      await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);
    } finally {
      logMemoryUsage();
    }
  },
  pollIntervalMs: readPositiveMsEnv("WORKER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
  staleJobSweepIntervalMs: readPositiveMsEnv("STALE_JOB_SWEEP_INTERVAL_MS", DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS),
  staleJobThresholdMs: readPositiveMsEnv("STALE_JOB_THRESHOLD_MS", DEFAULT_STALE_JOB_THRESHOLD_MS),
});

console.log("Worker started. Polling for pending jobs...");

const shutdown = async () => {
  console.log("Shutting down...");
  stopped = true;
  stopWorker.stop();
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }

  const graceMs = readPositiveMsEnv("WORKER_SHUTDOWN_GRACE_MS", DEFAULT_SHUTDOWN_GRACE_MS);
  console.log(`[worker] Shutting down gracefully — waiting up to ${graceMs}ms for current job...`);
  await stopWorker.drain(graceMs);

  await closeBrowser().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
