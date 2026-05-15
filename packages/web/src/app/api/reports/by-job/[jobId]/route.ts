import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const report = await createReportStore().getReportByJobId(jobId);
    if (!report) {
      return NextResponse.json({ error: "No report found for this job" }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
