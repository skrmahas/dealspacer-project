import { NextResponse } from "next/server";
import { assessPipelineHealth, getPool } from "@bei/shared";

const STALE_PENDING_SECONDS = 90;
const RECENT_ACTIVITY_MINUTES = 10;

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query<{
      stale_pending_count: string;
      recent_activity_count: string;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE state = 'pending'
             AND created_at < NOW() - ($1 * INTERVAL '1 second')
         )::text AS stale_pending_count,
         COUNT(*) FILTER (
           WHERE state IN ('parsing', 'extracting', 'translating', 'assembling')
             OR (
               state IN ('complete', 'failed', 'duplicate')
               AND updated_at > NOW() - ($2 * INTERVAL '1 minute')
             )
         )::text AS recent_activity_count
       FROM jobs`,
      [STALE_PENDING_SECONDS, RECENT_ACTIVITY_MINUTES],
    );

    const row = result.rows[0];
    const snapshot = {
      stalePendingCount: parseInt(row?.stale_pending_count ?? "0", 10),
      recentActivityCount: parseInt(row?.recent_activity_count ?? "0", 10),
    };
    const health = assessPipelineHealth(snapshot);

    return NextResponse.json({
      ok: health.ok,
      reason: health.reason ?? null,
      stalePendingCount: snapshot.stalePendingCount,
      recentActivityCount: snapshot.recentActivityCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
