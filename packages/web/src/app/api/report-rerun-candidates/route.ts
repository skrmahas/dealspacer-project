import { NextRequest, NextResponse } from "next/server";
import { createReportStore, type ReportRerunCandidateStatus } from "@bei/shared";

const REVIEW_STATUSES: ReportRerunCandidateStatus[] = ["pending_review", "failed_quality"];

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const statuses = status
      ? status.split(",").filter((value): value is ReportRerunCandidateStatus =>
        value === "pending_review" ||
        value === "failed_quality" ||
        value === "approved" ||
        value === "rejected")
      : REVIEW_STATUSES;
    const candidates = await createReportStore().listReportRerunCandidates(statuses);
    return NextResponse.json(candidates);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
