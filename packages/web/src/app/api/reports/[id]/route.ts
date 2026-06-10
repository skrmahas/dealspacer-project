import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // The upload page builds share URLs as `/reports/${jobId}`, so accept either
    // a report ID or a job ID here. Try report ID first to preserve existing semantics.
    const store = createReportStore();
    const report = (await store.getReportById(id)) ?? (await store.getReportByJobId(id));
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
