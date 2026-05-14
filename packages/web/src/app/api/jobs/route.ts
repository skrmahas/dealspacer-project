import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/file-store";
import { createPostgresStore } from "@bei/shared";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 },
    );
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 50MB" },
      { status: 400 },
    );
  }

  const store = createPostgresStore();
  const buffer = Buffer.from(await file.arrayBuffer());
  console.log("Creating job for:", file.name, "size:", buffer.length);
  const job = await store.createJob({ originalFilename: file.name });
  console.log("Job created:", job.id);
  await saveFile(job.id, buffer);
  console.log("File saved for job:", job.id);

  return NextResponse.json({ jobId: job.id, state: job.state }, { status: 201 });
}
