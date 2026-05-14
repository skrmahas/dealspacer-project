import type { Job } from "@bei/shared";
import type { JobStore } from "./store.js";

export interface WorkerConfig {
  store: JobStore;
  processJob: (job: Job, store: JobStore) => Promise<void>;
  pollIntervalMs: number;
}

export function startWorker(config: WorkerConfig): () => void {
  let stopped = false;

  async function poll() {
    while (!stopped) {
      const job = await config.store.pollNextPending();
      if (job) {
        await config.processJob(job, config.store);
      }
      if (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
      }
    }
  }

  poll();

  return () => {
    stopped = true;
  };
}
