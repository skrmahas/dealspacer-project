import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createPostgresFileStore, type OutputLanguage } from "@bei/shared";

const ACCEPTED_EXTENSIONS = new Set([".pdf", ".csv", ".html", ".htm", ".xhtml"]);
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/csv",
  "text/html",
  "application/xhtml+xml",
  "",
]);
const OUTPUT_LANGUAGES = new Set<OutputLanguage>(["en", "et", "lv", "lt"]);
const { saveFile } = createPostgresFileStore();

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const outputLanguageValue = formData.get("outputLanguage");
  const outputLanguage = typeof outputLanguageValue === "string" && OUTPUT_LANGUAGES.has(outputLanguageValue as OutputLanguage)
    ? outputLanguageValue as OutputLanguage
    : "en";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const dotIndex = file.name.lastIndexOf(".");
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.has(extension) && !ACCEPTED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, CSV, HTML, and XHTML files are accepted" },
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
  const job = await store.createJob({ originalFilename: file.name, outputLanguage });
  console.log("Job created:", job.id);
  await saveFile(job.id, buffer);
  console.log("File saved for job:", job.id);

  return NextResponse.json({ jobId: job.id, state: job.state }, { status: 201 });
}
