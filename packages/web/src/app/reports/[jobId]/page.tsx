"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobState } from "@bei/shared";

type JobInfo = {
  jobId: string;
  state: JobState;
  originalFilename?: string;
  extractedText?: string;
  extractedJson?: string;
  error?: string;
};

const MAX_PIPELINE_MS = 9 * 60 * 1000;

function describeFailure(error: string | undefined): string {
  if (!error) return "Pipeline failed unexpectedly.";
  if (error.includes("No financial data found")) return "No financial data found in this document.";
  if (error.toLowerCase().includes("timeout")) return "Pipeline timed out before report generation completed.";
  return error;
}

export default function SharedReportPage({ params }: { params: { jobId: string } }) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const reportUrl = useMemo(() => `/api/jobs/${params.jobId}/download`, [params.jobId]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${params.jobId}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) setError("Report not found.");
        return;
      }
      const payload = await response.json() as JobInfo;
      setJob(payload);
      setLoading(false);

      if (payload.state === "failed") {
        setError(describeFailure(payload.error));
        stopPolling();
      }
      if (payload.state === "complete") {
        setError(null);
        stopPolling();
      }
    } catch {
      setError("Could not load this report.");
      setLoading(false);
    }
  }, [params.jobId, stopPolling]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    void fetchJob();
    pollTimerRef.current = setInterval(() => {
      if (Date.now() - startedAtRef.current > MAX_PIPELINE_MS) {
        setError("Pipeline timed out before report generation completed.");
        stopPolling();
        return;
      }
      void fetchJob();
    }, 1400);
    return () => stopPolling();
  }, [fetchJob, stopPolling]);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "36px 20px 48px",
        background: "radial-gradient(circle at 8% 0%, #e9f4ff 0%, #f5f7fb 42%, #eef2f8 100%)",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={{ background: "#ffffff", border: "1px solid #d5e0eb", borderRadius: 16, padding: 20 }}>
          <h1 style={{ margin: 0, color: "#0f2e52", fontSize: 28 }}>Shared Report</h1>
          <p style={{ margin: "10px 0 0", color: "#54657b", fontSize: 15 }}>
            Job ID: <code>{params.jobId}</code>
          </p>
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #d5e0eb", borderRadius: 16, padding: 20 }}>
          {loading && <p style={{ margin: 0, color: "#55677d" }}>Loading report status...</p>}
          {!loading && job && (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "#2c4f6e", fontWeight: 700 }}>
                Status: {job.state === "assembling" ? "rendering" : job.state}
              </p>
              {job.state !== "complete" && !error && (
                <p style={{ margin: 0, color: "#54657b" }}>
                  Report generation is still in progress. This page auto-refreshes.
                </p>
              )}
              {error && (
                <div style={{ borderRadius: 10, border: "1px solid #ffd4cf", background: "#fff6f5", color: "#8f2f23", padding: 12, fontSize: 14 }}>
                  {error}
                </div>
              )}
              {job.state === "complete" && (
                <>
                  <iframe
                    src={reportUrl}
                    title="Generated Report PDF"
                    style={{
                      width: "100%",
                      height: "85vh",
                      border: "1px solid #d5e0eb",
                      borderRadius: 10,
                    }}
                  />
                  <a
                    href={reportUrl}
                    download
                    style={{
                      marginTop: 12,
                      width: "fit-content",
                      textDecoration: "none",
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "#165f83",
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    Download PDF
                  </a>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
