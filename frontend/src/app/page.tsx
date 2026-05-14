"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type JobState = "pending" | "parsing" | "extracting" | "translating" | "rendering" | "complete" | "failed";

interface JobStatus {
  id: string;
  state: JobState;
  original_filename?: string;
  error_message?: string;
}

const STATE_LABELS: Record<JobState, string> = {
  pending: "Queued", parsing: "Parsing PDF", extracting: "Extracting data",
  translating: "Translating", rendering: "Rendering PDF", complete: "Complete", failed: "Failed",
};

export default function Home() {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback((jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJob(data);
        if (data.state === "complete" || data.state === "failed") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null); setUploading(true);
    if (!file.name.endsWith(".pdf")) { setError("Only PDF files are accepted."); setUploading(false); return; }
    if (file.size > 50 * 1024 * 1024) { setError("File exceeds 50MB limit."); setUploading(false); return; }
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Upload failed"); }
      const data = await res.json();
      setJob({ id: data.id, state: "pending" });
      startPolling(data.id);
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); }
  }, [startPolling]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight text-center mb-2">Baltic Earnings Intelligence</h1>
        <p className="text-zinc-400 text-center mb-10 text-sm">Upload an earnings report — get a structured financial summary.</p>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"} ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <input type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
          {uploading ? (
            <div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /><span className="text-zinc-400 text-sm">Uploading…</span></div>
          ) : (
            <><svg className="w-10 h-10 text-zinc-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg><span className="text-zinc-400 text-sm">Drop a PDF here or click to browse</span><span className="text-zinc-600 text-xs mt-1">PDF only · Max 50MB</span></>
          )}
        </label>
        {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
        {job && (
          <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-200">{job.original_filename || job.id}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${job.state === "complete" ? "bg-green-500/10 text-green-400" : job.state === "failed" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>{STATE_LABELS[job.state] || job.state}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(["parsing","extracting","translating","rendering"] as JobState[]).map((stage) => {
                const stages = ["pending","parsing","extracting","translating","rendering","complete"] as JobState[];
                const si = stages.indexOf(stage), ci = stages.indexOf(job.state);
                const done = job.state === "complete" || ci > si, active = ci === si;
                return <div key={stage} className={`flex-1 h-1 rounded-full ${done ? "bg-green-500" : active ? "bg-blue-500 animate-pulse" : "bg-zinc-700"}`} />;
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-zinc-600"><span>Parse</span><span>Extract</span><span>Translate</span><span>Render</span></div>
            {job.state === "failed" && job.error_message && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{job.error_message}</div>}
            {job.state === "complete" && (
              <a href={`/api/jobs/${job.id}/download`} className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download extracted text (.txt)
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
