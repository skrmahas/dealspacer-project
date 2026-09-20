import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const forCompare = searchParams.get("forCompare") === "1";

    if (forCompare) {
      const query = searchParams.get("q") ?? undefined;
      const limitParam = parseInt(searchParams.get("limit") ?? "200", 10);
      const limit = Number.isFinite(limitParam) ? limitParam : 200;
      const reports = await createReportStore().listReportsForCompare({ query, limit });
      return NextResponse.json(reports);
    }

    const reports = await createReportStore().listRecentReports(8);
    return NextResponse.json(reports);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "DATABASE_URL environment variable is required") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
