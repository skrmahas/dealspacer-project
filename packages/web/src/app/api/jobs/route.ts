import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createAutoFileStore, getPool, type OutputLanguage } from "@bei/shared";

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
const { saveFile } = createAutoFileStore();

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, state, original_filename, output_language, error, created_at, updated_at
       FROM jobs ORDER BY created_at DESC LIMIT 20`,
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

  // 100 MB limit for all file types — prevents worker OOM crashes from
  // large XHTML/HTML files that balloon during DOM/text parsing.
  const maxBytes = 100 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "File must be under 100 MB" },
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
