/** Input from a DB snapshot of job activity. */
export type PipelineHealthSnapshot = {
  stalePendingCount: number;
  recentActivityCount: number;
};

/**
 * Returns whether the pipeline worker is likely running.
 * Stale pending = jobs still in `pending` long after upload (worker never claimed them).
 */
export function assessPipelineHealth(snapshot: PipelineHealthSnapshot): {
  ok: boolean;
  reason?: "worker_offline";
} {
  if (snapshot.stalePendingCount === 0) {
    return { ok: true };
  }
  if (snapshot.recentActivityCount > 0) {
    return { ok: true };
  }
  return { ok: false, reason: "worker_offline" };
}
