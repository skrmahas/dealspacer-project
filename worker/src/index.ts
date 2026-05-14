import { getPendingJob, completeJob, failJob } from "./db.js";
import { parsePdf } from "./parser.js";

const POLL_INTERVAL_MS = 2000;

async function processNextJob(): Promise<boolean> {
  const job = await getPendingJob();
  if (!job) return false;
  console.log(`Processing job ${job.id}: ${job.original_filename}`);
  try {
    const text = await parsePdf(job.file_path);
    await completeJob(job.id, text);
    console.log(`Job ${job.id} completed — ${text.length} chars extracted`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Job ${job.id} failed:`, message);
    await failJob(job.id, message);
    return true;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is required"); process.exit(1); }
  console.log("Worker started — polling for pending jobs...");
  while (true) {
    try {
      const processed = await processNextJob();
      if (!processed) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    } catch (err) {
      console.error("Worker loop error:", err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

main().catch((err) => { console.error("Fatal worker error:", err); process.exit(1); });
