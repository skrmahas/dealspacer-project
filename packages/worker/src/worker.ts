import type { Job, JobStore } from "@bei/shared";

export interface WorkerConfig {
  store: JobStore;
  processJob: (job: Job, store: JobStore) => Promise<void>;
  pollIntervalMs: number;
  staleJobSweepIntervalMs?: number;
  staleJobThresholdMs?: number;
}

export function startWorker(config: WorkerConfig) {
  let stopped = false;
  let staleSweepInFlight = false;
  let staleSweepTimer: ReturnType<typeof setInterval> | null = null;
  let jobsInFlight = 0;
  let drainResolve: (() => void) | null = null;

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

  function checkDrain() {
    if (jobsInFlight === 0 && drainResolve) {
      drainResolve();
      drainResolve = null;
    }
  }

  async function poll() {
    while (!stopped) {
      const job = await config.store.pollNextPending();
      if (job) {
        jobsInFlight++;
        try {
          await config.processJob(job, config.store);
        } finally {
          jobsInFlight--;
          checkDrain();
        }
      }
      if (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
      }
    }
  }

  void poll().catch((err) => {
    console.error("[worker] Fatal poll error:", err);
    stopped = true;
    process.exit(1);
  });

  const stop = () => {
    stopped = true;
    if (staleSweepTimer) {
      clearInterval(staleSweepTimer);
      staleSweepTimer = null;
    }
  };

  const drain = (graceMs: number): Promise<void> => {
    return new Promise((resolve) => {
      if (jobsInFlight === 0) {
        resolve();
        return;
      }

      drainResolve = resolve;

      // Safety: force resolve after grace period
      if (graceMs > 0) {
        setTimeout(() => {
          if (drainResolve) {
            console.warn(`[worker] Shutdown grace period (${graceMs}ms) expired with ${jobsInFlight} job(s) still in-flight — forcing exit`);
            drainResolve();
            drainResolve = null;
          }
        }, graceMs);
      }
    });
  };

  return { stop, drain };
}
