import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createAutoFileStore } from "@bei/shared";

const { readBrief } = createAutoFileStore();

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
    const pdf = await readBrief!(job.id);
    const fileBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${job.originalFilename.replace(/\.(pdf|csv|html|htm|xhtml)$/i, "")}-brief.pdf"`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Brief report not found. Try the full report instead." },
      { status: 404 },
    );
  }
}
