import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from packages/worker/
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { readFile, saveReport } from "./file-store.js";
import { parseDocument } from "./parser.js";
import { extractFromText } from "./extractor.js";
import { translateExtractedData } from "./translator.js";
import { assemblePdf } from "./assembler.js";
import { processJob } from "./orchestrator.js";
import { startWorker } from "./worker.js";
import { createPostgresStore } from "@bei/shared";

const store = createPostgresStore();
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS = 30_000;
const DEFAULT_STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;

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

const stop = startWorker({
  store,
  processJob: async (job, store) => {
    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);
  },
  pollIntervalMs: readPositiveMsEnv("WORKER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
  staleJobSweepIntervalMs: readPositiveMsEnv("STALE_JOB_SWEEP_INTERVAL_MS", DEFAULT_STALE_JOB_SWEEP_INTERVAL_MS),
  staleJobThresholdMs: readPositiveMsEnv("STALE_JOB_THRESHOLD_MS", DEFAULT_STALE_JOB_THRESHOLD_MS),
});

console.log("Worker started. Polling for pending jobs...");

process.on("SIGINT", () => {
  console.log("Shutting down...");
  stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  stop();
  process.exit(0);
});
