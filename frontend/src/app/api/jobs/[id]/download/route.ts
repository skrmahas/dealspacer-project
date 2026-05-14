import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await db.getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.state !== "complete") {
    return NextResponse.json(
      { error: "Job not yet complete", state: job.state },
      { status: 409 }
    );
  }

  return new NextResponse(job.extracted_text || "", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${job.original_filename.replace(/\.pdf$/i, "")}.txt"`,
    },
  });
}
