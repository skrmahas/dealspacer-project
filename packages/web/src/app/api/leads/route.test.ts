// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPoolQuery } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
}));

vi.mock("@bei/shared", () => ({
  getPool: vi.fn(() => ({
    query: mockPoolQuery,
  })),
}));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("stores a valid email lead", async () => {
    const request = makeRequest(
      { email: "TEST@Example.com", source: " landing_hero " },
      {
        "user-agent": "vitest",
        referer: "http://localhost/",
        "x-forwarded-for": "203.0.113.9",
      },
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery.mock.calls[0][1]).toEqual([
      "test@example.com",
      "landing_hero",
      "vitest",
      "http://localhost/",
      "203.0.113.9",
    ]);
  });

  it("returns 400 for invalid email", async () => {
    const request = makeRequest({ email: "not-an-email" });
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("valid email");
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});
