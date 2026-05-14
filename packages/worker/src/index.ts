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

const stop = startWorker({
  store,
  processJob: async (job, store) => {
    await processJob(job, store, readFile, parseDocument, extractFromText, translateExtractedData, assemblePdf, saveReport);
  },
  pollIntervalMs: 2000,
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
