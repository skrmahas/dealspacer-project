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
    // Derive the key ID from the stored s3Key ("reports/{id}.pdf") rather than
    // falling back to report.id when jobId is null — the fallback constructs
    // the wrong S3 path if the file was saved under the job UUID.
    const keyId = report.s3Key
      ? report.s3Key.replace(/^reports\//, "").replace(/\.pdf$/, "")
      : (report.jobId ?? report.id);
    const buffer = Buffer.from(await fileStore.readReport(keyId));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${report.fiscalYear}-${report.reportType}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
