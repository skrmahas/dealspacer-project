import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createReportStore } from "@bei/shared";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const jobStore = createPostgresStore();
    const job = await jobStore.getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const reportStore = createReportStore();

    // Find any existing duplicate report and replace it
    let parsed: any;
    try {
      parsed = job.extractedJson ? JSON.parse(job.extractedJson) : null;
    } catch {
      return NextResponse.json({ error: "No extraction data found" }, { status: 400 });
    }

    if (!parsed?.metadata?.companyName) {
      return NextResponse.json({ error: "No company name in extraction data" }, { status: 400 });
    }

    // Find existing reports for this job's company + period
    const newJobId = id;
    // Reset job to pending so worker re-processes
    await jobStore.updateJob(id, { state: "pending" });

    // Find the existing report by job ID
    const existingReport = await reportStore.getReportByJobId(id);
    if (existingReport) {
      await reportStore.replaceReport(
        existingReport.id,
        newJobId,
        `reports/${newJobId}.pdf`,
        parsed,
      );
      return NextResponse.json({ replaced: true, reportId: existingReport.id });
    }

    return NextResponse.json({ replaced: false, message: "No existing report to replace" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
