import { NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function GET() {
  try {
    const reports = await createReportStore().listUnmatchedReports();
    return NextResponse.json(reports);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
