// @vitest-environment node

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("middleware", () => {
  it("does not match the public landing page", () => {
    expect(config.matcher).not.toContain("/");
  });

  it("matches the exact app route", () => {
    expect(config.matcher).toContain("/app");
  });

  it("redirects unauthenticated app requests to access", () => {
    const response = middleware(request("/app"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/access?next=%2Fapp");
  });

  it("allows authenticated app requests", () => {
    const response = middleware(request("/app", "bei_access=granted"));
    expect(response.status).toBe(200);
  });
});
