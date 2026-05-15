"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportSummary } from "@/components/report-summary";
import { BriefSummary } from "@/components/brief-summary";
import { ErrorBoundary } from "@/components/error-boundary";
import { uploadFileWithProgress } from "@/lib/upload-progress";
import type { UploadProgress } from "@/lib/upload-progress";
import type { JobState, OutputLanguage } from "@bei/shared";

type JobInfo = {
  jobId: string;
  state: JobState;
  originalFilename?: string;
  extractedText?: string;
  extractedJson?: string;
  error?: string;
  createdAt?: string;
};

const ACCEPTED_EXTENSIONS = [".pdf", ".csv", ".html", ".htm", ".xhtml"];
const MAX_PIPELINE_MS = 9 * 60 * 1000;

const STAGES: { key: JobState; label: string; description: string }[] = [
  { key: "parsing", label: "Parsing", description: "Reading document text and structure" },
  { key: "extracting", label: "Extracting", description: "AI analyzing financial data with GPT-4o" },
  { key: "translating", label: "Translating", description: "Translating metrics and narratives" },
  { key: "assembling", label: "Rendering", description: "Generating the final PDF report" },
];

function stageIndex(state: JobState): number {
  if (state === "pending") return -1;
  if (state === "failed") return -1;
  if (state === "complete") return STAGES.length;
  return STAGES.findIndex((stage) => stage.key === state);
}

function describeFailure(error: string | undefined): string {
  if (!error) return "Pipeline failed unexpectedly. Please retry the upload.";
  if (error.includes("No financial data found")) return "No financial data found in this document.";
  if (error.toLowerCase().includes("timeout")) return "Pipeline timed out before report generation completed.";
  return error;
}

function ProgressTracker({ state, progressDescription }: { state: JobState; progressDescription?: string }) {
  const currentIndex = stageIndex(state);
  const activeStage = currentIndex >= 0 && currentIndex < STAGES.length ? STAGES[currentIndex] : null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {STAGES.map((stage, index) => {
          const complete = currentIndex > index || state === "complete";
          const active = currentIndex === index;
          return (
            <div key={stage.key} style={{ display: "grid", gap: 6 }}>
              <div
                className={active ? "pulse-stage" : ""}
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: complete ? "var(--color-success)" : active ? "var(--color-accent)" : "#d4dbe4",
                }}
              />
              <span style={{ fontSize: 12, color: complete || active ? "#244762" : "#728197", fontWeight: complete || active ? 600 : 500 }}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {activeStage && state !== "complete" && state !== "failed" && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6e7d90", fontStyle: "italic" }}>
          {progressDescription || activeStage.description}
        </p>
      )}
    </div>
  );
}

function PollingSkeleton() {
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
      <div className="pulse-bg" style={{ height: 14, borderRadius: 8 }} />
      <div className="pulse-bg" style={{ height: 14, borderRadius: 8, width: "72%" }} />
      <div className="pulse-bg" style={{ height: 62, borderRadius: 10 }} />
    </div>
  );
}

function getExtractionProgress(job: JobInfo): string | undefined {
  if (job.state !== "extracting" || !job.extractedJson) return undefined;
  try {
    const data = JSON.parse(job.extractedJson);
    if (data._extractionProgress) {
      const { completed, total } = data._extractionProgress;
      return `Processing chunk ${completed}/${total} — AI analyzing financial data with GPT-4o`;
    }
  } catch {}
  return undefined;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("en");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recentJobs, setRecentJobs] = useState<JobInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState(false);
  const dragCounterRef = useRef(0);
  const abortUploadRef = useRef<(() => void) | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shareUrl = useMemo(() => {
    if (!job?.jobId) return null;
    return `/reports/${job.jobId}`;
  }, [job?.jobId]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setPolling(false);
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    setPolling(true);
    startedAtRef.current = Date.now();
    setElapsed("0s");

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

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - startedAtRef.current > MAX_PIPELINE_MS) {
        stopPolling();
        setPipelineError("Pipeline timed out before report generation completed.");
        setJob((prev) => prev ? { ...prev, state: "failed", error: "Pipeline timeout" } : prev);
        return;
      }

      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as JobInfo;
        setJob(data);
        if (data.state === "complete") {
          setPipelineError(null);
          stopPolling();
          void fetchRecentJobs();
          return;
        }
        if (data.state === "failed") {
          setPipelineError(describeFailure(data.error));
          stopPolling();
          void fetchRecentJobs();
        }
      } catch {
        // Keep polling transient network failures.
      }
    }, 1200);
  }, [stopPolling]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
      setDragError(false);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
      setDragError(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    const valid = ACCEPTED_EXTENSIONS.some((ext) =>
      droppedFile.name.toLowerCase().endsWith(ext),
    );
    if (!valid) {
      setDragError(true);
      setTimeout(() => setDragError(false), 2500);
      return;
    }

    setFile(droppedFile);
    setPipelineError(null);
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────────

  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json() as JobInfo[];
        setRecentJobs(data);
      }
    } catch {
      // Silently fail — recent jobs are non-critical
    }
  }, []);

  // Fetch recent jobs on mount
  useEffect(() => {
    void fetchRecentJobs();
  }, [fetchRecentJobs]);

  const onUpload = useCallback(async () => {
    if (!file) return;
    setPipelineError(null);

    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setJob({ jobId: "", state: "failed", error: "Only PDF, CSV, HTML, and XHTML files are accepted" });
      setPipelineError("Unsupported file type. Please upload a PDF, CSV, or HTML document.");
      return;
    }

    setUploading(true);
    setUploadProgress(null);
    setJob(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("outputLanguage", outputLanguage);

      abortUploadRef.current = null;
      const created = await uploadFileWithProgress(
        "/api/jobs",
        form,
        (progress) => setUploadProgress(progress),
        200,
        undefined,
        abortUploadRef,
      );

      setJob({ jobId: created.jobId, state: created.state as JobState });
      startPolling(created.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setJob({ jobId: "", state: "failed", error: message });
      setPipelineError(message || "Upload failed. Please retry.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [file, outputLanguage, startPolling]);

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
        <section style={{ background: "var(--color-bg-tint)", backdropFilter: "blur(6px)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {process.env.NEXT_PUBLIC_BEI_BRAND_LOGO_URL && (
              <img
                src={process.env.NEXT_PUBLIC_BEI_BRAND_LOGO_URL}
                alt="DealSpacer"
                style={{ maxHeight: 48, maxWidth: 180, objectFit: "contain" }}
              />
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: 32, color: "var(--color-heading)", letterSpacing: 0.2 }}>DealSpacer</h1>
              <p style={{ margin: "10px 0 0", color: "var(--color-text-muted)", fontSize: 15 }}>
                Upload Baltic earnings reports and generate shareable localized PDF summaries.
              </p>
            </div>
          </div>
        </section>

        <section
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            background: isDragging ? "#e8f4fd" : dragError ? "var(--color-error-bg)" : "#ffffff",
            border: dragError
              ? "2px dashed #e8887a"
              : isDragging
                ? "2px dashed var(--color-accent)"
                : "1px solid #dae2eb",
            borderRadius: 16,
            padding: 20,
            display: "grid",
            gap: 16,
            transition: "background 0.15s, border 0.15s",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, color: "var(--color-text)", fontSize: 14 }}>
              Document
              <input
                type="file"
                aria-label="Upload document"
                accept=".pdf,.csv,.html,.htm,.xhtml,application/pdf,text/csv,text/html,application/xhtml+xml"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                style={{ border: "1px solid #cfd8e3", borderRadius: 10, padding: "10px 12px", background: "#f9fbfd" }}
              />
            </label>
            <p style={{ margin: 0, color: "#6e7d90", fontSize: 13 }}>{file ? `${file.name} (${formatFileSize(file.size)})` : "No file selected"} · Max 1GB · Drop zone</p>
            {isDragging && !dragError && (
              <p style={{ margin: 0, color: "#0b5974", fontSize: 13, fontWeight: 600 }}>
                Drop your file here
              </p>
            )}
            {dragError && (
              <p style={{ margin: 0, color: "var(--color-error-text)", fontSize: 13, fontWeight: 600 }}>
                Only PDF, CSV, and HTML files are accepted
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { value: "en", label: "English" },
              { value: "et", label: "Estonian" },
              { value: "lv", label: "Latvian" },
              { value: "lt", label: "Lithuanian" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={outputLanguage === option.value}
                onClick={() => setOutputLanguage(option.value as OutputLanguage)}
                style={{
                  borderRadius: 999,
                  padding: "8px 14px",
                  border: outputLanguage === option.value ? "1px solid var(--color-accent)" : "1px solid #cfd8e3",
                  background: outputLanguage === option.value ? "#e8f7fc" : "#f7f9fc",
                  color: outputLanguage === option.value ? "#0b5974" : "#4f5f73",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={onUpload}
            aria-label={!file ? "Select a file to upload" : uploading ? "Uploading file" : "Start pipeline"}
            disabled={!file || uploading}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 18px",
              background: !file || uploading ? "#a7b6c8" : "linear-gradient(90deg, var(--color-accent), var(--color-accent-dark))",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: !file || uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading && uploadProgress
              ? `Uploading… ${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`
              : uploading
                ? "Uploading..."
                : "Start Pipeline"}
          </button>

          {uploading && abortUploadRef.current && (
            <button
              type="button"
              onClick={() => {
                abortUploadRef.current?.();
                setUploading(false);
                setUploadProgress(null);
                setPipelineError("Upload cancelled.");
              }}
              style={{
                border: "1px solid var(--color-error-text)",
                borderRadius: 10,
                padding: "8px 14px",
                background: "transparent",
                color: "var(--color-error-text)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          {uploading && uploadProgress && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "#d4dbe4",
                  overflow: "hidden",
                }}
              >
                <div
                  className="upload-progress-fill"
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-dark))",
                    width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`,
                    transition: "width 150ms ease-out",
                  }}
                />
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6e7d90" }}>
                {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          )}
        </section>

        {job && (
          <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, color: "var(--color-heading)", fontSize: 20 }}>Pipeline Status</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {elapsed && (job.state !== "complete" && job.state !== "failed") && (
                  <span style={{ color: "#6e7d90", fontSize: 13 }}>{elapsed}</span>
                )}
                {elapsed && job.state === "complete" && (
                  <span style={{ color: "#6e7d90", fontSize: 13 }}>Completed in {elapsed}</span>
                )}
                {elapsed && job.state === "failed" && (
                  <span style={{ color: "#6e7d90", fontSize: 13 }}>Failed after {elapsed}</span>
                )}
                <span style={{ fontWeight: 700, color: job.state === "failed" ? "#a22e26" : "#28506f" }}>
                  {job.state === "assembling" ? "Rendering" : job.state[0].toUpperCase() + job.state.slice(1)}
                </span>
              </div>
            </div>

            <ProgressTracker state={job.state} progressDescription={getExtractionProgress(job)} />

            {job.jobId && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#8899aa" }}>
                Job ID: {job.jobId}
              </p>
            )}

            {polling && <PollingSkeleton />}

            {(pipelineError || (job.state === "failed" && job.error)) && (
              <div style={{ marginTop: 14, borderRadius: 10, border: "1px solid var(--color-error-border)", background: "var(--color-error-bg)", color: "var(--color-error-text)", padding: 12, fontSize: 14 }}>
                {pipelineError || describeFailure(job.error)}
              </div>
            )}

            {job.state === "failed" && job.jobId && (
              <button
                type="button"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  try {
                    const res = await fetch(`/api/jobs/${job.jobId}/retry`, { method: "POST" });
                    if (res.ok) {
                      const data = await res.json() as JobInfo;
                      setJob(data);
                      setPipelineError(null);
                      startPolling(data.jobId);
                    }
                  } catch {
                    setPipelineError("Retry failed. Please try again.");
                  } finally {
                    setRetrying(false);
                  }
                }}
                style={{
                  marginTop: 8,
                  border: "1px solid var(--color-accent)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  background: "transparent",
                  color: "var(--color-accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: retrying ? "not-allowed" : "pointer",
                }}
              >
                {retrying ? "Retrying..." : "Retry Job"}
              </button>
            )}

            {shareUrl && (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#4d5d70" }}>Shareable report link</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={shareUrl} style={{ color: "#0b5974", fontWeight: 700, textDecoration: "none", wordBreak: "break-all", flex: 1 }}>
                    {shareUrl}
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(window.location.origin + shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        // Clipboard API may not be available
                      }
                    }}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      background: copied ? "var(--color-success)" : "transparent",
                      color: copied ? "#fff" : "var(--color-text-muted)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            )}

            {job.state === "complete" && (
              <>
                {job.extractedJson && <BriefSummary extractedJson={job.extractedJson} />}
                {job.extractedJson && <ReportSummary extractedJson={job.extractedJson} />}
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a
                    href={`/api/jobs/${job.jobId}/download`}
                    aria-label="Download PDF report"
                    style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, textDecoration: "none", background: "#165f83", color: "#fff", fontWeight: 700 }}
                  >
                    Download PDF
                  </a>
                  {shareUrl && (
                    <a
                      href={shareUrl}
                      aria-label="Open shareable report page"
                      style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, textDecoration: "none", border: "1px solid #c8d4e0", color: "#2d4f6d", fontWeight: 700, background: "#f8fbff" }}
                    >
                      Open Share Page
                    </a>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <style jsx>{`
        @keyframes pulseStage {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .pulse-stage {
          animation: pulseStage 1.4s ease-in-out infinite;
        }
        .pulse-bg {
          background: linear-gradient(90deg, #edf2f7 20%, #f8fbff 50%, #edf2f7 80%);
          background-size: 220% 100%;
          animation: pulseStage 1.4s ease-in-out infinite;
        }
      `}</style>

      {(recentJobs.length > 0 && (!job || job.state === "complete" || job.state === "failed")) && (
        <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
          <h2 style={{ margin: "0 0 12px", color: "var(--color-heading)", fontSize: 18 }}>Recent Reports</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {recentJobs.slice(0, 8).map((j) => (
              <div
                key={j.jobId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--color-bg-tint)",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <span style={{ color: j.state === "failed" ? "var(--color-error-text)" : "var(--color-success)", fontWeight: 700, fontSize: 11 }}>
                    {j.state === "complete" ? "✓" : j.state === "failed" ? "✗" : "○"}
                  </span>
                  <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.originalFilename || "Untitled"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                    {new Date(j.createdAt || "").toLocaleDateString()}
                  </span>
                  {j.state === "complete" && (
                    <a href={`/reports/${j.jobId}`} style={{ color: "var(--color-accent)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
    </ErrorBoundary>
  );
}
