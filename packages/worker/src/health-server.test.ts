import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import { startHealthServer } from "./health-server.js";

function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

function httpGet(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode!, body: data });
        }
      });
    }).on("error", reject);
  });
}

describe("startHealthServer", () => {
  let stop: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (stop) {
      await stop();
      stop = null;
    }
  });

  it("responds with status ok on GET /health", async () => {
    const port = getRandomPort();
    stop = startHealthServer(port, { startTime: Date.now(), jobsProcessed: 42 });

    // Small delay for server to start
    await new Promise((r) => setTimeout(r, 100));

    const result = await httpGet(`http://localhost:${port}/`);
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty("status", "ok");
  });

  it("includes uptime, jobsProcessed, and rssMb", async () => {
    const port = getRandomPort();
    const startTime = Date.now() - 60000; // 60 seconds ago
    stop = startHealthServer(port, { startTime, jobsProcessed: 10 });

    await new Promise((r) => setTimeout(r, 100));

    const result = await httpGet(`http://localhost:${port}/`);
    const body = result.body as Record<string, unknown>;
    expect(body.jobsProcessed).toBe(10);
    expect(body.uptime).toBeGreaterThanOrEqual(58); // ~60s, allow small variance
    expect(typeof body.rssMb).toBe("number");
    expect(body.rssMb).toBeGreaterThan(0);
  });

  it("stops cleanly", async () => {
    const port = getRandomPort();
    stop = startHealthServer(port, { startTime: Date.now(), jobsProcessed: 0 });

    await new Promise((r) => setTimeout(r, 100));
    await stop();
    stop = null;

    // Server should be closed — connection should fail
    await expect(httpGet(`http://localhost:${port}/`)).rejects.toThrow();
  });
});
