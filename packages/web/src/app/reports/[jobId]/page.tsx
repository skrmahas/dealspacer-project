"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
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
  const [elapsed, setElapsed] = useState<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reportUrl = useMemo(() => `/api/jobs/${params.jobId}/download`, [params.jobId]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
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
    setElapsed("0s");
    void fetchJob();

    // Update elapsed time every second
    elapsedTimerRef.current = setInterval(() => {
      const diff = Date.now() - startedAtRef.current;
      const secs = Math.floor(diff / 1000);
      if (secs < 60) {
        setElapsed(`${secs}s`);
      } else {
        const mins = Math.floor(secs / 60);
        const remainSecs = secs % 60;
        setElapsed(`${mins}m ${remainSecs}s`);
      }
    }, 1000);

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
    <ErrorBoundary>
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "36px 20px 48px",
        background: "radial-gradient(circle at 8% 0%, var(--color-gradient-start) 0%, var(--color-gradient-mid) 42%, var(--color-gradient-end) 100%)",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
          <h1 style={{ margin: 0, color: "var(--color-heading)", fontSize: 28 }}>Shared Report</h1>
          <p style={{ margin: "10px 0 0", color: "var(--color-text-muted)", fontSize: 15 }}>
            Job ID: <code>{params.jobId}</code>
          </p>
        </section>

        <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
          {loading && <p style={{ margin: 0, color: "#55677d" }}>Loading report status...</p>}
          {!loading && job && (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "var(--color-heading)", fontWeight: 700 }}>
                Status: {job.state === "assembling" ? "rendering" : job.state}
                {elapsed && job.state !== "complete" && job.state !== "failed" && (
                  <span style={{ marginLeft: 10, color: "#6e7d90", fontWeight: 400, fontSize: 13 }}>{elapsed}</span>
                )}
                {elapsed && job.state === "complete" && (
                  <span style={{ marginLeft: 10, color: "#6e7d90", fontWeight: 400, fontSize: 13 }}>Completed in {elapsed}</span>
                )}
                {elapsed && job.state === "failed" && (
                  <span style={{ marginLeft: 10, color: "#6e7d90", fontWeight: 400, fontSize: 13 }}>Failed after {elapsed}</span>
                )}
              </p>
              {job.state !== "complete" && !error && (
                <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                  Report generation is still in progress. This page auto-refreshes.
                </p>
              )}
              {error && (
                <div style={{ borderRadius: 10, border: "1px solid var(--color-error-border)", background: "var(--color-error-bg)", color: "var(--color-error-text)", padding: 12, fontSize: 14 }}>
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
                      border: "1px solid var(--color-border)",
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
                      background: "var(--color-accent-dark)",
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
    </ErrorBoundary>
  );
}
