import { NextRequest, NextResponse } from "next/server";
import { createReportStore, createAutoFileStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const report = await createReportStore().getReportById(id);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const fileStore = createAutoFileStore();
    const buffer = await fileStore.readReport(report.id);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${report.fiscalYear}-${report.reportType}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
