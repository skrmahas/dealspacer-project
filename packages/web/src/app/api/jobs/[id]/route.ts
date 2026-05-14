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

  // Only include large payload fields when the job has reached a terminal state.
  // During active processing, these are empty anyway and waste polling bandwidth.
  if (job.state === "complete" || job.state === "failed") {
    return NextResponse.json({
      ...base,
      extractedText: job.extractedText,
      extractedJson: job.extractedJson,
    });
  }

  return NextResponse.json(base);
}
