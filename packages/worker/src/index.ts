import { readFile, saveReport } from "./file-store.js";
import { parsePdf } from "./parser.js";
import { extractFromText } from "./extractor.js";
import { assemblePdf } from "./assembler.js";
import { processJob } from "./orchestrator.js";
import { startWorker } from "./worker.js";
import { createPostgresStore } from "@bei/shared";

const store = createPostgresStore();

const stop = startWorker({
  store,
  processJob: async (job, store) => {
    await processJob(job, store, readFile, parsePdf, extractFromText, assemblePdf, saveReport);
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
