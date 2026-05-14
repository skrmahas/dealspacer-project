"use client";

import { useState, useCallback, useRef } from "react";

type JobState = "pending" | "parsing" | "extracting" | "assembling" | "complete" | "failed";

interface JobInfo {
  jobId: string;
  state: JobState;
  originalFilename?: string;
  extractedJson?: string;
  error?: string;
}

function StatusEmoji({ state }: { state: JobState }) {
  switch (state) {
    case "pending":
      return "⏳";
    case "parsing":
      return "🔍";
    case "extracting":
      return "🤖";
    case "assembling":
      return "📄";
    case "complete":
      return "✅";
    case "failed":
      return "❌";
  }
}

function ExtractionSummary({ extractedJson }: { extractedJson: string }) {
  try {
    const data = JSON.parse(extractedJson);
    const hasData =
      data.metadata?.companyName ||
      data.metrics?.length > 0 ||
      data.narratives?.length > 0;

    if (!hasData) return null;

    return (
      <div
        style={{
          marginTop: 16,
          padding: 16,
          background: "#f9f9f9",
          borderRadius: 8,
        }}
      >
        {data.metadata?.companyName && (
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            📊 {data.metadata.companyName} — {data.metadata.reportPeriod}
          </p>
        )}

        {data.metrics?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Key Metrics</p>
            {data.metrics.map(
              (m: { label: string; value: number | null; unit?: string }) => (
                <div
                  key={m.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    padding: "2px 0",
                  }}
                >
                  <span>{m.label}</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {m.value != null
                      ? `${m.value.toLocaleString()} ${m.unit ?? ""}`
                      : "—"}
                  </span>
                </div>
              ),
            )}
          </div>
        )}

        {data.sentiment && (
          <div>
            <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Sentiment</p>
            <p style={{ fontSize: 14, margin: "2px 0" }}>
              Management tone:{" "}
              <span style={{ textTransform: "capitalize" }}>
                {data.sentiment.managementTone}
              </span>
            </p>
            {data.sentiment.outlook && (
              <p style={{ fontSize: 14, margin: "2px 0", color: "#555" }}>
                {data.sentiment.outlook}
              </p>
            )}
          </div>
        )}
      </div>
    );
  } catch {
    return null;
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobInfo | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  const startPolling = useCallback((jobId: string) => {
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data);

      if (data.state === "complete" || data.state === "failed") {
        clearInterval(pollingRef.current);
      }
    }, 1000);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setJob(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setJob({ jobId: "", state: "failed", error: err.error });
        return;
      }

      const data = await res.json();
      setJob(data);
      startPolling(data.jobId);
    } catch {
      setJob({ jobId: "", state: "failed", error: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }, [file, startPolling]);

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "80px auto",
        padding: "0 20px",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Baltic Earnings Intelligence
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Upload a Baltic company earnings report PDF and extract its text.
      </p>

      <div
        style={{
          border: "2px dashed #ccc",
          borderRadius: 12,
          padding: 40,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 16 }}
        />
        <p style={{ color: "#999", fontSize: 14, margin: "8px 0" }}>
          {file ? file.name : "No file selected"}
        </p>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            padding: "12px 32px",
            fontSize: 16,
            borderRadius: 6,
            border: "none",
            background: !file || uploading ? "#ccc" : "#0070f3",
            color: "white",
            cursor: !file || uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading..." : "Upload & Parse"}
        </button>
      </div>

      {job && (
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Job Status</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusEmoji state={job.state} />
            <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
              {job.state}
            </span>
          </div>

          {job.error && (
            <p style={{ color: "#e00", marginTop: 8 }}>{job.error}</p>
          )}

          {job.state === "complete" && (
            <>
              {job.extractedJson && (
                <ExtractionSummary extractedJson={job.extractedJson} />
              )}
              <a
                href={`/api/jobs/${job.jobId}/download`}
                download
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  padding: "10px 24px",
                  background: "#0070f3",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: 6,
                }}
              >
                ⬇ Download PDF Report
              </a>
            </>
          )}
        </div>
      )}
    </main>
  );
}
