import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = createPostgresStore();
  const job = await store.getJob(params.id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const base = {
    jobId: job.id,
    state: job.state,
    originalFilename: job.originalFilename,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  // Include large payload fields for terminal states, or progress data during extraction
  const hasProgress = job.extractedJson?.includes("_extractionProgress");
  if (job.state === "complete" || job.state === "failed" || (job.state === "extracting" && hasProgress)) {
    return NextResponse.json({
      ...base,
      extractedText: job.extractedText,
      extractedJson: job.extractedJson,
    });
  }

  return NextResponse.json(base);
}
