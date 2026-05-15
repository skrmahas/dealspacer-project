import { NextRequest, NextResponse } from "next/server";
import { createReportStore } from "@bei/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { companyId } = body;
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    const report = await createReportStore().updateReportCompany(id, companyId);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
