import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const report = await createReportStore().promoteReportRerunCandidate(id);
    return NextResponse.json({ promoted: true, reportId: report.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
