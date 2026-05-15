import http from "node:http";

export interface HealthStats {
  startTime: number;
  jobsProcessed: number;
}

/**
 * Start a minimal HTTP health check server.
 * Returns a stop function that closes the server.
 */
export function startHealthServer(port: number, stats: HealthStats): () => Promise<void> {
  const server = http.createServer((_req, res) => {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const mem = process.memoryUsage();
    const body = JSON.stringify({
      status: "ok",
      uptime,
      jobsProcessed: stats.jobsProcessed,
      rssMb: Math.round(mem.rss / (1024 * 1024)),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
  });

  server.listen(port, () => {
    console.log(`[worker] Health server listening on port ${port}`);
  });

  server.on("error", (err) => {
    console.error(`[worker] Health server error:`, err.message);
  });

  return () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
}
