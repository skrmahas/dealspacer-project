import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createReportStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const reportStore = createReportStore();
    const direct = await reportStore.getReportByJobId(jobId);
    if (direct) return NextResponse.json(direct);

    // Duplicate jobs have no report row of their own. The worker stashes the
    // existing report's ID in extractedJson so "View Existing" can find it.
    const job = await createPostgresStore().getJob(jobId);
    if (job?.state === "duplicate") {
      if (job.extractedJson) {
        try {
          const parsed = JSON.parse(job.extractedJson) as { duplicateOfReportId?: string };
          if (parsed.duplicateOfReportId) {
            const linked = await reportStore.getReportById(parsed.duplicateOfReportId);
            if (linked) return NextResponse.json(linked);
          }
        } catch {
          // Fall through to error-message parsing.
        }
      }

      // Fallback for jobs created before the worker started stashing
      // duplicateOfReportId: parse the duplicate criteria out of the error
      // message ("Duplicate report: company=<id>, year=<n>, type=<t>, lang=<l>").
      const match = job.error?.match(
        /company=([^,]+), year=(\d+), type=([^,]+), lang=(\w+)/,
      );
      if (match) {
        const [, companyRaw, year, type, lang] = match;
        const companyId = companyRaw === "unmatched" ? null : companyRaw;
        const linked = await reportStore.getReportByMatch(
          companyId,
          Number(year),
          type as "annual" | "q1" | "q2" | "q3" | "q4" | "semi-annual" | "other",
          lang as "en" | "et" | "lv" | "lt",
        );
        if (linked) return NextResponse.json(linked);
      }
    }

    return NextResponse.json({ error: "No report found for this job" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
