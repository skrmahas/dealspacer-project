import http from "node:http";

/**
 * Start a minimal HTTP health check server.
 * Returns a stop function that closes the server.
 */
export function startHealthServer(port: number): () => Promise<void> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
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
