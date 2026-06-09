import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const candidate = await createReportStore().getReportRerunCandidateForReview(id);
    if (!candidate) {
      return NextResponse.json({ error: "Report rerun candidate not found" }, { status: 404 });
    }
    return NextResponse.json(candidate);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
