// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PRODUCTION_ACCESS_CODE_MISSING_MESSAGE } from "@/lib/access-code";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/access", () => {
  it("returns 500 in production when BEI_ACCESS_CODE is missing", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BEI_ACCESS_CODE", "");

    const { POST } = await import("./route");

    try {
      const response = await POST(makeRequest({ code: "irrelevant", next: "/" }));
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload).toEqual({ error: PRODUCTION_ACCESS_CODE_MISSING_MESSAGE });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
