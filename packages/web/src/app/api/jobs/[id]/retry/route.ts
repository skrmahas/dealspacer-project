import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore } from "@bei/shared";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = createPostgresStore();
  const job = await store.getJob(params.id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.state !== "failed") {
    return NextResponse.json(
      { error: "Only failed jobs can be retried" },
      { status: 409 },
    );
  }

  const updated = await store.updateJob(params.id, {
    state: "pending",
    error: null,
    extractedText: null,
    extractedJson: null,
  });

  return NextResponse.json({
    jobId: updated.id,
    state: updated.state,
  });
}
