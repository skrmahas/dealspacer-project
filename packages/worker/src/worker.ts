import type { Job, JobStore } from "@bei/shared";

export interface WorkerConfig {
  store: JobStore;
  processJob: (job: Job, store: JobStore) => Promise<void>;
  pollIntervalMs: number;
  staleJobSweepIntervalMs?: number;
  staleJobThresholdMs?: number;
}

export function startWorker(config: WorkerConfig): () => void {
  let stopped = false;
  let staleSweepInFlight = false;
  let staleSweepTimer: ReturnType<typeof setInterval> | null = null;

  const shouldRunSweep = config.staleJobSweepIntervalMs !== undefined
    && config.staleJobSweepIntervalMs > 0
    && config.staleJobThresholdMs !== undefined
    && config.staleJobThresholdMs > 0
    && typeof config.store.resetStaleJobs === "function";

  if (shouldRunSweep) {
    staleSweepTimer = setInterval(async () => {
      if (stopped || staleSweepInFlight) return;
      staleSweepInFlight = true;
      try {
        await config.store.resetStaleJobs!(config.staleJobThresholdMs!);
      } catch (error) {
        console.error("Stale-job sweep failed:", error);
      } finally {
        staleSweepInFlight = false;
      }
    }, config.staleJobSweepIntervalMs);
  }

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
    if (staleSweepTimer) {
      clearInterval(staleSweepTimer);
      staleSweepTimer = null;
    }
  };
}
