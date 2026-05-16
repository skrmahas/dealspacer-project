"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileUp,
  KeyRound,
  Layers,
} from "lucide-react";
import { ReportPreview, parseExtractedJson } from "@/components/report-view";
import { DealSpacerLogoLink } from "@/components/deal-spacer-logo";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { uploadFileWithProgress } from "@/lib/upload-progress";
import type { UploadProgress } from "@/lib/upload-progress";
import { cn } from "@/lib/utils";
import type { JobState, OutputLanguage } from "@bei/shared";

type JobInfo = {
  jobId: string;
  state: JobState;
  originalFilename?: string;
  extractedText?: string;
  extractedJson?: string;
  error?: string;
  createdAt?: string;
  reportId?: string | null;
};

const ACCEPTED_EXTENSIONS = [".pdf", ".csv", ".html", ".htm", ".xhtml"];
const MAX_PIPELINE_MS = 9 * 60 * 1000;
const ACTIVE_JOB_KEY = "bei_active_job";

function saveActiveJob(jobId: string, filename: string) {
  try {
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId, filename, startedAt: Date.now() }));
  } catch {}
}

function clearActiveJob() {
  try {
    localStorage.removeItem(ACTIVE_JOB_KEY);
  } catch {}
}

function loadActiveJob(): { jobId: string; filename: string; startedAt: number } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { jobId: string; filename: string; startedAt: number };
  } catch {
    return null;
  }
}

const STAGES: { key: JobState; label: string; description: string }[] = [
  { key: "parsing", label: "Parsing", description: "Reading document text and structure" },
  { key: "extracting", label: "Extracting", description: "AI analyzing financial data with GPT-4o" },
  { key: "translating", label: "Translating", description: "Translating metrics and narratives" },
  { key: "assembling", label: "Rendering", description: "Generating the final PDF report" },
];

const LANGUAGE_OPTIONS: { value: OutputLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "et", label: "Estonian" },
  { value: "lv", label: "Latvian" },
  { value: "lt", label: "Lithuanian" },
];

// `duplicate` is a terminal state set by the worker's completion hook after
// the pipeline runs in full but the report row already exists for the same
// company / fiscal year / report type / language. It is NOT in-progress.
const TERMINAL_STATES: ReadonlySet<JobState> = new Set([
  "complete",
  "failed",
  "duplicate",
]);

function isTerminalState(state: JobState): boolean {
  return TERMINAL_STATES.has(state);
}

function stageIndex(state: JobState): number {
  if (state === "pending") return -1;
  if (state === "failed") return -1;
  if (state === "duplicate") return -1;
  if (state === "complete") return STAGES.length;
  return STAGES.findIndex((stage) => stage.key === state);
}

function describeFailure(error: string | undefined): string {
  if (!error) return "Pipeline failed unexpectedly. Please retry the upload.";
  if (error.includes("No financial data found")) return "No financial data found in this document.";
  if (error.toLowerCase().includes("timeout")) return "Pipeline timed out before report generation completed.";
  return error;
}

function formatStateLabel(state: JobState): string {
  if (state === "assembling") return "Rendering";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function ProgressTracker({ state }: { state: JobState }) {
  const currentIndex = stageIndex(state);
  const activeStage = currentIndex >= 0 && currentIndex < STAGES.length ? STAGES[currentIndex] : null;

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
        {STAGES.map((stage, index) => {
          const complete = currentIndex > index || state === "complete";
          const active = currentIndex === index;
          return (
            <div key={stage.key} className="grid gap-2">
              <motion.div
                className={cn(
                  "h-1.5",
                  complete && "bg-[#6db88a]",
                  active && !complete && "upload-pulse-stage bg-[#2b79db]",
                  !complete && !active && "bg-[#2a3544]",
                )}
              />
              <span
                className={cn(
                  "font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em]",
                  complete || active ? "text-[#e8ecf2]" : "text-[#6b7d92]",
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {activeStage && state !== "complete" && state !== "failed" && (
        <p className="mt-3 text-sm italic text-[#8b9aad]">{activeStage.description}</p>
      )}
    </div>
  );
}

function PollingSkeleton() {
  return (
    <div className="mt-5 grid gap-2.5">
      <div className="upload-pulse-bg h-3.5 rounded-none" />
      <div className="upload-pulse-bg h-3.5 w-[72%] rounded-none" />
      <div className="upload-pulse-bg h-16 rounded-none" />
    </div>
  );
}

type HomeClientProps = {
  initialCompanySlug: string | null;
};

export default function Home({ initialCompanySlug }: HomeClientProps) {
  const router = useRouter();
  const companySlug = initialCompanySlug;
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
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

  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = (await res.json()) as JobInfo[];
        setRecentJobs(data);
      }
    } catch {
      // non-critical
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      setPolling(true);
      startedAtRef.current = Date.now();
      setElapsed("0s");

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
          clearActiveJob();
          stopPolling();
          setPipelineError("Pipeline timed out before report generation completed.");
          setJob((prev) => (prev ? { ...prev, state: "failed", error: "Pipeline timeout" } : prev));
          return;
        }

        try {
          const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
          if (!response.ok) return;
          const data = (await response.json()) as JobInfo;
          setJob(data);
          if (data.state === "complete") {
            setPipelineError(null);
            clearActiveJob();
            stopPolling();
            void fetchRecentJobs();
            return;
          }
          if (data.state === "failed") {
            setPipelineError(describeFailure(data.error));
            clearActiveJob();
            stopPolling();
            void fetchRecentJobs();
            return;
          }
          if (data.state === "duplicate") {
            // Worker finished but the report row already exists. Halt polling
            // and let the UI render the View Existing / Replace controls.
            setPipelineError(null);
            clearActiveJob();
            stopPolling();
            void fetchRecentJobs();
          }
        } catch {
          // keep polling
        }
      }, 1200);
    },
    [stopPolling, fetchRecentJobs],
  );

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

  useEffect(() => {
    if (!companySlug) return;
    fetch("/api/companies")
      .then((r) => r.json())
      .then((companies: { id: string; slug: string; name: string }[]) => {
        const found = companies.find((c) => c.slug === companySlug);
        if (found) {
          setCompanyId(found.id);
          setCompanyName(found.name);
        }
      })
      .catch(() => {});
  }, [companySlug]);

  useEffect(() => {
    void fetchRecentJobs();
  }, [fetchRecentJobs]);

  // Rehydrate an in-progress job if the user left and came back
  useEffect(() => {
    const saved = loadActiveJob();
    if (!saved) return;

    const sinceStart = Date.now() - saved.startedAt;
    if (sinceStart > MAX_PIPELINE_MS) {
      clearActiveJob();
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${saved.jobId}`, { cache: "no-store" });
        if (!res.ok) { clearActiveJob(); return; }
        const data = (await res.json()) as JobInfo;
        const restored: JobInfo = {
          ...data,
          originalFilename: data.originalFilename ?? saved.filename,
        };

        if (isTerminalState(data.state)) {
          // Job is already done (complete / failed / duplicate). Restore the
          // panel so the user sees the outcome — including View Existing /
          // Replace for duplicates — but do NOT restart polling.
          setJob(restored);
          if (data.state === "failed") {
            setPipelineError(describeFailure(data.error));
          }
          // Reflect the real wall-clock so "Completed in / Failed after / etc"
          // shows a meaningful number instead of "0s".
          const secs = Math.max(0, Math.floor(sinceStart / 1000));
          setElapsed(
            secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`,
          );
          clearActiveJob();
          void fetchRecentJobs();
          return;
        }

        // Still mid-pipeline — restore state and resume polling
        setJob(restored);
        // Adjust startedAt so elapsed timer reflects true time since job was created
        startedAtRef.current = saved.startedAt;
        startPolling(saved.jobId);
      } catch {
        clearActiveJob();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (companyId) form.set("companyId", companyId);

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
      saveActiveJob(created.jobId, file.name);
      startPolling(created.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setJob({ jobId: "", state: "failed", error: message });
      setPipelineError(message || "Upload failed. Please retry.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [file, outputLanguage, companyId, startPolling]);

  const visibleRecentJobs = recentJobs.filter((j) => j.jobId !== job?.jobId);
  const showRecent = visibleRecentJobs.length > 0;

  return (
    <ErrorBoundary>
      <div
        className={cn(
          "relative min-h-screen bg-[#080b10] text-[#e8ecf2]",
          "font-[family-name:var(--font-body)]",
        )}
      >
        <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
        <div className="landing-aurora pointer-events-none fixed inset-0 z-0" aria-hidden />

        <div className="relative z-10 mx-auto max-w-[920px] px-6 py-10 md:px-10 md:py-14">
          <UploadHeader companyName={companyName} />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 grid gap-6"
          >
            <section
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "relative border bg-[#0c1018] p-6 transition-colors md:p-8",
                dragError && "border-[#9e4a5a]/60 bg-[#9e4a5a]/8",
                isDragging && !dragError && "border-[#2b79db]/50 bg-[#2b79db]/5",
                !isDragging && !dragError && "border-[#2a3544]",
              )}
            >
              <CornerMarks />

              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center border border-[#2a3544] bg-[#080b10] text-[#2b79db]">
                  <FileUp className="size-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
                    Upload filing
                  </h2>
                  <p className="mt-1 text-sm text-[#8b9aad]">
                    PDF, CSV, or HTML · max 1GB · drag and drop supported
                  </p>
                </div>
              </div>

              <label className="mt-6 grid gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
                  Document
                </span>
                <input
                  type="file"
                  aria-label="Upload document"
                  accept=".pdf,.csv,.html,.htm,.xhtml,application/pdf,text/csv,text/html,application/xhtml+xml"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="w-full border border-[#2a3544] bg-[#080b10] px-3 py-2.5 text-sm text-[#e8ecf2] file:mr-3 file:border-0 file:bg-[#2b79db]/15 file:px-3 file:py-1 file:font-[family-name:var(--font-mono)] file:text-[10px] file:uppercase file:tracking-wider file:text-[#b8d4f5]"
                />
              </label>

              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                {file ? file.name : "No file selected"}
              </p>

              {isDragging && !dragError && (
                <p className="mt-2 text-sm font-medium text-[#2b79db]">Drop your file here</p>
              )}
              {dragError && (
                <p className="mt-2 text-sm font-medium text-[#e8a0a8]">
                  Only PDF, CSV, and HTML files are accepted
                </p>
              )}

              <div className="mt-6">
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
                  Output language
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {LANGUAGE_OPTIONS.map((option) => {
                    const active = outputLanguage === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setOutputLanguage(option.value)}
                        className={cn(
                          "border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] transition",
                          active
                            ? "border-[#2b79db]/50 bg-[#2b79db]/12 text-[#b8d4f5]"
                            : "border-[#2a3544] text-[#6b7d92] hover:border-[#3d4d62] hover:text-[#9aa8bc]",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  onClick={onUpload}
                  aria-label={!file ? "Select a file to upload" : uploading ? "Uploading file" : "Start pipeline"}
                  disabled={!file || uploading}
                  className="h-11 rounded-none border-0 bg-[#2b79db] px-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#3d8de8] disabled:bg-[#3d4d62] disabled:text-[#6b7d92]"
                >
                  {uploading && uploadProgress
                    ? `Uploading… ${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`
                    : uploading
                      ? "Uploading..."
                      : "Start Pipeline"}
                </Button>

                {uploading && abortUploadRef.current && (
                  <button
                    type="button"
                    onClick={() => {
                      abortUploadRef.current?.();
                      setUploading(false);
                      setUploadProgress(null);
                      clearActiveJob();
                      setPipelineError("Upload cancelled.");
                    }}
                    className="border border-[#9e4a5a]/50 px-4 py-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#e8a0a8] transition hover:bg-[#9e4a5a]/10"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {uploading && uploadProgress && (
                <div className="mt-5">
                  <div className="h-1.5 overflow-hidden bg-[#2a3544]">
                    <div
                      className="h-full bg-gradient-to-r from-[#5a8f8f] to-[#2b79db] transition-[width] duration-150 ease-out"
                      style={{
                        width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                    {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB /{" "}
                    {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              )}
            </section>

            {job && (
              <section className="relative border border-[#2a3544] bg-[#0c1018] p-6 md:p-8">
                <CornerMarks variant="teal" />

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Layers className="size-5 text-[#5a8f8f]" />
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
                      Pipeline Status
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {elapsed && !isTerminalState(job.state) && (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                        {elapsed}
                      </span>
                    )}
                    {elapsed && job.state === "complete" && (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                        Completed in {elapsed}
                      </span>
                    )}
                    {elapsed && job.state === "failed" && (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                        Failed after {elapsed}
                      </span>
                    )}
                    {elapsed && job.state === "duplicate" && (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#6b7d92]">
                        Halted after {elapsed}
                      </span>
                    )}
                    <span
                      className={cn(
                        "font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.12em]",
                        job.state === "failed" && "text-[#e8a0a8]",
                        job.state === "duplicate" && "text-[#d4a35a]",
                        job.state !== "failed" && job.state !== "duplicate" && "text-[#2b79db]",
                      )}
                    >
                      {formatStateLabel(job.state)}
                    </span>
                  </div>
                </div>

                <ProgressTracker state={job.state} />

                {job.jobId && (
                  <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] text-[#6b7d92]">
                    Job ID: {job.jobId}
                  </p>
                )}

                {polling && <PollingSkeleton />}

                {(pipelineError || ((job.state === "failed" || job.state === "duplicate") && job.error)) && (
                  <div
                    className={cn(
                      "mt-5 border px-4 py-3 text-sm",
                      job.state === "duplicate"
                        ? "border-[#d4a35a]/40 bg-[#d4a35a]/10 text-[#e8c98a]"
                        : "border-[#9e4a5a]/40 bg-[#9e4a5a]/10 text-[#e8a0a8]",
                    )}
                  >
                    {job.state === "duplicate" && (
                      <p className="mb-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#d4a35a]">
                        Already on file
                      </p>
                    )}
                    {pipelineError || describeFailure(job.error)}
                    {job.state === "duplicate" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <PipelineActionButton
                          label="View Existing"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/reports/by-job/${job.jobId}`);
                              if (res.ok) {
                                const report = await res.json();
                                if (report?.id) router.push(`/reports/${report.id}`);
                              }
                            } catch {}
                          }}
                        />
                        <PipelineActionButton
                          label={retrying ? "Replacing..." : "Replace"}
                          disabled={retrying}
                          onClick={async () => {
                            setRetrying(true);
                            try {
                              const res = await fetch(`/api/jobs/${job.jobId}/replace`, { method: "POST" });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.reportId) router.push(`/reports/${data.reportId}`);
                              }
                            } catch {
                            } finally {
                              setRetrying(false);
                            }
                          }}
                          variant="danger"
                        />
                      </div>
                    )}
                  </div>
                )}

                {job.state === "failed" && job.jobId && (
                  <PipelineActionButton
                    className="mt-4"
                    label={retrying ? "Retrying..." : "Retry Job"}
                    disabled={retrying}
                    onClick={async () => {
                      setRetrying(true);
                      try {
                        const res = await fetch(`/api/jobs/${job.jobId}/retry`, { method: "POST" });
                        if (res.ok) {
                          const data = (await res.json()) as JobInfo;
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
                  />
                )}

                {shareUrl && (
                  <div className="mt-6 grid gap-2">
                    <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#5a8f8f]">
                      Shareable report link
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={shareUrl}
                        className="min-w-0 flex-1 break-all text-sm font-medium text-[#2b79db] hover:underline"
                      >
                        {shareUrl}
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(window.location.origin + shareUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {}
                        }}
                        className={cn(
                          "shrink-0 border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] transition",
                          copied
                            ? "border-[#6db88a]/50 bg-[#6db88a]/15 text-[#6db88a]"
                            : "border-[#2a3544] text-[#9aa8bc] hover:border-[#3d4d62]",
                        )}
                      >
                        {copied ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                )}

                {job.state === "complete" && (
                  <>
                    {job.extractedJson && (
                      <div className="mt-6">
                        <ReportPreview extracted={parseExtractedJson(job.extractedJson)} />
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <DownloadLink
                        href={`/api/jobs/${job.jobId}/download`}
                        aria-label="Download PDF report"
                        primary
                        download
                      >
                        Download PDF
                      </DownloadLink>
                      <DownloadLink
                        href={`/api/jobs/${job.jobId}/download-brief`}
                        aria-label="Download executive brief"
                        download
                      >
                        Brief (1-2p)
                      </DownloadLink>
                      {shareUrl && (
                        <DownloadLink href={shareUrl} aria-label="Open shareable report page">
                          Open Share Page
                        </DownloadLink>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {showRecent && (
              <section className="border border-[#2a3544] bg-[#0c1018]/60 p-6 md:p-8">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[#f4f6f9]">
                  Recent Jobs
                </h2>
                <ul className="mt-4 grid gap-1">
                  {visibleRecentJobs.slice(0, 8).map((j) => {
                    const inProgress = !isTerminalState(j.state);
                    const isDup = j.state === "duplicate";
                    return (
                      <li
                        key={j.jobId}
                        className="flex items-center justify-between gap-3 border border-transparent px-3 py-2.5 transition hover:border-[#2a3544] hover:bg-[#080b10]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "font-[family-name:var(--font-mono)] text-[10px] font-medium",
                              j.state === "complete" && "text-[#6db88a]",
                              j.state === "failed" && "text-[#e8a0a8]",
                              isDup && "text-[#d4a35a]",
                              inProgress && "upload-pulse-stage text-[#2b79db]",
                            )}
                          >
                            {j.state === "complete"
                              ? "✓"
                              : j.state === "failed"
                                ? "✗"
                                : isDup
                                  ? "⊘"
                                  : "●"}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-sm text-[#c5d0de]">
                              {j.originalFilename || "Untitled"}
                            </span>
                            {inProgress && (
                              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#2b79db]">
                                {formatStateLabel(j.state)}
                              </span>
                            )}
                            {isDup && (
                              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#d4a35a]">
                                Duplicate
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6b7d92]">
                            {new Date(j.createdAt || "").toLocaleDateString()}
                          </span>
                          {j.state === "complete" && j.reportId && (
                            <Link
                              href={`/reports/${j.reportId}`}
                              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#2b79db] hover:underline"
                            >
                              View
                            </Link>
                          )}
                          {isDup && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/reports/by-job/${j.jobId}`);
                                  if (res.ok) {
                                    const report = await res.json();
                                    if (report?.id) {
                                      router.push(`/reports/${report.id}`);
                                      return;
                                    }
                                  }
                                } catch {}
                                // Fall back to surfacing the duplicate panel inline
                                setJob(j);
                              }}
                              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#d4a35a] hover:underline"
                            >
                              Open
                            </button>
                          )}
                          {inProgress && (
                            <button
                              type="button"
                              onClick={() => {
                                setJob(j);
                                startedAtRef.current = j.createdAt ? new Date(j.createdAt).getTime() : Date.now();
                                startPolling(j.jobId);
                                saveActiveJob(j.jobId, j.originalFilename ?? "");
                              }}
                              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#2b79db] hover:underline"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function UploadHeader({ companyName }: { companyName: string | null }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#1e2733] pb-8">
      <div>
        <DealSpacerLogoLink />

        <h1 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight tracking-tight text-[#f4f6f9]">
          {companyName ? `Report upload · ${companyName}` : "Upload workspace"}
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-[#8b9aad] md:text-base">
          {companyName
            ? `Uploading a report for ${companyName}`
            : "Upload Baltic earnings reports and generate shareable localized PDF summaries."}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em]">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 border border-[#2a3544] px-3 py-2 text-[#9aa8bc] transition hover:border-[#3d4d62] hover:text-[#e8ecf2]"
        >
          <Building2 className="size-3.5" />
          Catalog
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 border border-[#2a3544] px-3 py-2 text-[#9aa8bc] transition hover:border-[#3d4d62] hover:text-[#e8ecf2]"
        >
          <ArrowLeft className="size-3.5" />
          Home
        </Link>
        <Link
          href="/access"
          className="inline-flex items-center gap-1.5 border border-[#2a3544] px-3 py-2 text-[#6b7d92] transition hover:border-[#3d4d62] hover:text-[#e8ecf2]"
        >
          <KeyRound className="size-3.5" />
          Access
        </Link>
      </nav>
    </header>
  );
}

function CornerMarks({ variant = "brand" }: { variant?: "brand" | "teal" }) {
  const primary = variant === "brand" ? "border-[#2b79db]" : "border-[#5a8f8f]";
  const secondary = variant === "brand" ? "border-[#5a8f8f]" : "border-[#2b79db]";

  return (
    <>
      <span className={cn("pointer-events-none absolute -left-px -top-px block size-2 border-l-2 border-t-2", primary)} />
      <span className={cn("pointer-events-none absolute -right-px -top-px block size-2 border-r-2 border-t-2", primary)} />
      <span className={cn("pointer-events-none absolute -bottom-px -left-px block size-2 border-b-2 border-l-2", secondary)} />
      <span className={cn("pointer-events-none absolute -bottom-px -right-px block size-2 border-b-2 border-r-2", secondary)} />
    </>
  );
}

function PipelineActionButton({
  label,
  onClick,
  disabled,
  variant = "default",
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] transition disabled:opacity-50",
        variant === "danger"
          ? "border-[#9e4a5a]/50 text-[#e8a0a8] hover:bg-[#9e4a5a]/10"
          : "border-[#2b79db]/40 text-[#b8d4f5] hover:bg-[#2b79db]/10",
        className,
      )}
    >
      {label}
    </button>
  );
}

function DownloadLink({
  href,
  children,
  "aria-label": ariaLabel,
  primary,
  download,
}: {
  href: string;
  children: React.ReactNode;
  "aria-label": string;
  primary?: boolean;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target="_blank"
      rel="noopener noreferrer"
      {...(download ? { download: true } : {})}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] transition",
        primary
          ? "bg-[#2b79db] text-[#ffffff] hover:bg-[#3d8de8]"
          : "border border-[#3d4d62] text-[#c5d0de] hover:border-[#5a8f8f]/50 hover:bg-[#5a8f8f]/8",
      )}
    >
      {children}
      {primary && <ArrowRight className="size-3.5" />}
    </a>
  );
}
