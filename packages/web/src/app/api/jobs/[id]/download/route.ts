import { NextRequest, NextResponse } from "next/server";
import { readReport } from "@/lib/file-store";
import { createPostgresStore } from "@bei/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = createPostgresStore();
  const job = await store.getJob(params.id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.state !== "complete") {
    return NextResponse.json(
      { error: "Job not complete yet" },
      { status: 409 },
    );
  }

  try {
    const pdf = await readReport(job.id);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${job.originalFilename.replace(/\.pdf$/i, "")}-report.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Report PDF not found" },
      { status: 404 },
    );
  }
}
