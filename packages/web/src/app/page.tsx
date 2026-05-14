"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ReportSummary } from "@/components/report-summary";

type JobState = "pending" | "parsing" | "extracting" | "translating" | "assembling" | "complete" | "failed";
type OutputLanguage = "en" | "et" | "lv" | "lt";

type JobInfo = {
  jobId: string;
  state: JobState;
  originalFilename?: string;
  extractedJson?: string;
  error?: string;
};

const ACCEPTED_EXTENSIONS = [".pdf", ".csv", ".html", ".htm", ".xhtml"];
const MAX_PIPELINE_MS = 9 * 60 * 1000;

const STAGES: { key: JobState; label: string }[] = [
  { key: "parsing", label: "Parsing" },
  { key: "extracting", label: "Extracting" },
  { key: "translating", label: "Translating" },
  { key: "assembling", label: "Rendering" },
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

function ProgressTracker({ state }: { state: JobState }) {
  const currentIndex = stageIndex(state);
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
                  background: complete ? "#1c7c54" : active ? "#0b7ea4" : "#d4dbe4",
                }}
              />
              <span style={{ fontSize: 12, color: complete || active ? "#244762" : "#728197", fontWeight: complete || active ? 600 : 500 }}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("en");
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const shareUrl = useMemo(() => {
    if (!job?.jobId) return null;
    return `/reports/${job.jobId}`;
  }, [job?.jobId]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    setPolling(true);
    startedAtRef.current = Date.now();

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
          return;
        }
        if (data.state === "failed") {
          setPipelineError(describeFailure(data.error));
          stopPolling();
        }
      } catch {
        // Keep polling transient network failures.
      }
    }, 1200);
  }, [stopPolling]);

  const onUpload = useCallback(async () => {
    if (!file) return;
    setPipelineError(null);

    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setJob({ jobId: "", state: "failed", error: "Only PDF, CSV, HTML, and XHTML files are accepted" });
      setPipelineError("Upload failed: unsupported file type.");
      return;
    }

    setUploading(true);
    setJob(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("outputLanguage", outputLanguage);

      const response = await fetch("/api/jobs", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        setJob({ jobId: "", state: "failed", error: payload.error || "Upload failed" });
        setPipelineError("Upload failed. Please retry.");
        return;
      }

      const created = payload as JobInfo;
      setJob(created);
      startPolling(created.jobId);
    } catch {
      setJob({ jobId: "", state: "failed", error: "Upload failed" });
      setPipelineError("Upload failed due to a network error.");
    } finally {
      setUploading(false);
    }
  }, [file, outputLanguage, startPolling]);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "36px 20px 48px",
        background: "radial-gradient(circle at 8% 0%, #ffe8d6 0%, #f4f8fb 42%, #eef2f8 100%)",
        fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Segoe UI\", sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={{ background: "#ffffffd9", backdropFilter: "blur(6px)", border: "1px solid #dae2eb", borderRadius: 16, padding: 20 }}>
          <h1 style={{ margin: 0, fontSize: 32, color: "#0f2e52", letterSpacing: 0.2 }}>Baltic Earnings Intelligence</h1>
          <p style={{ margin: "10px 0 0", color: "#566579", fontSize: 15 }}>
            Upload Baltic earnings reports and generate shareable localized PDF summaries.
          </p>
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #dae2eb", borderRadius: 16, padding: 20, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, color: "#1f2a37", fontSize: 14 }}>
              Document
              <input
                type="file"
                accept=".pdf,.csv,.html,.htm,.xhtml,application/pdf,text/csv,text/html,application/xhtml+xml"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                style={{ border: "1px solid #cfd8e3", borderRadius: 10, padding: "10px 12px", background: "#f9fbfd" }}
              />
            </label>
            <p style={{ margin: 0, color: "#6e7d90", fontSize: 13 }}>{file ? file.name : "No file selected"} · Max 50MB</p>
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
                onClick={() => setOutputLanguage(option.value as OutputLanguage)}
                style={{
                  borderRadius: 999,
                  padding: "8px 14px",
                  border: outputLanguage === option.value ? "1px solid #0b7ea4" : "1px solid #cfd8e3",
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
            disabled={!file || uploading}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 18px",
              background: !file || uploading ? "#a7b6c8" : "linear-gradient(90deg, #0b7ea4, #145f82)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: !file || uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading..." : "Start Pipeline"}
          </button>
        </section>

        {job && (
          <section style={{ background: "#ffffff", border: "1px solid #dae2eb", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, color: "#0f2e52", fontSize: 20 }}>Pipeline Status</h2>
              <span style={{ fontWeight: 700, color: job.state === "failed" ? "#a22e26" : "#28506f" }}>
                {job.state === "assembling" ? "Rendering" : job.state[0].toUpperCase() + job.state.slice(1)}
              </span>
            </div>

            <ProgressTracker state={job.state} />

            {polling && <PollingSkeleton />}

            {(pipelineError || (job.state === "failed" && job.error)) && (
              <div style={{ marginTop: 14, borderRadius: 10, border: "1px solid #ffd4cf", background: "#fff6f5", color: "#8f2f23", padding: 12, fontSize: 14 }}>
                {pipelineError || describeFailure(job.error)}
              </div>
            )}

            {shareUrl && (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#4d5d70" }}>Shareable report link</p>
                <a href={shareUrl} style={{ color: "#0b5974", fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}>
                  {shareUrl}
                </a>
              </div>
            )}

            {job.state === "complete" && (
              <>
                {job.extractedJson && <ReportSummary extractedJson={job.extractedJson} />}
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a
                    href={`/api/jobs/${job.jobId}/download`}
                    style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, textDecoration: "none", background: "#165f83", color: "#fff", fontWeight: 700 }}
                  >
                    Download PDF
                  </a>
                  {shareUrl && (
                    <a
                      href={shareUrl}
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
    </main>
  );
}
