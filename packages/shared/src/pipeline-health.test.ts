import { describe, expect, it } from "vitest";
import { assessPipelineHealth } from "./pipeline-health.js";

describe("assessPipelineHealth", () => {
  it("is healthy when there are no stale pending jobs", () => {
    expect(assessPipelineHealth({ stalePendingCount: 0, recentActivityCount: 0 })).toEqual({
      ok: true,
    });
  });

  it("is healthy when stale pending exists but worker recently processed jobs", () => {
    expect(assessPipelineHealth({ stalePendingCount: 5, recentActivityCount: 1 })).toEqual({
      ok: true,
    });
  });

  it("is unhealthy when stale pending exists with no recent worker activity", () => {
    expect(assessPipelineHealth({ stalePendingCount: 3, recentActivityCount: 0 })).toEqual({
      ok: false,
      reason: "worker_offline",
    });
  });
});
