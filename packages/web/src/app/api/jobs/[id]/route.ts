import { NextRequest, NextResponse } from "next/server";
import { createFileStore } from "@/lib/file-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = createFileStore();
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
