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

  return NextResponse.json({
    jobId: job.id,
    state: job.state,
    originalFilename: job.originalFilename,
    extractedText: job.extractedText,
    extractedJson: job.extractedJson,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
