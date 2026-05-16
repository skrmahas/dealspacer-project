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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const safeLimit = isNaN(limit) ? 20 : Math.min(limit, 1000);

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, state, original_filename, output_language, error, created_at, updated_at
       FROM jobs ORDER BY created_at DESC LIMIT $1`,
      [safeLimit]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  const formData = await request.formData();
  const t1 = Date.now();
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

  // 15 MB limit for all file types — prevents worker OOM crashes from
  // massive PDFs that crash pdf.js parsing in standard environments.
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "File must be under 15 MB" },
      { status: 400 },
    );
  }

  const store = createPostgresStore();
  const buffer = Buffer.from(await file.arrayBuffer());
  const t2 = Date.now();

  const companyIdValue = formData.get("companyId");
  const companyId = typeof companyIdValue === "string" && companyIdValue.length > 0
    ? companyIdValue
    : null;

  const job = await store.createJob({ originalFilename: file.name, outputLanguage, companyId });
  const t3 = Date.now();

  try {
    await saveFile(job.id, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown file storage error";
    await store.updateJob(job.id, {
      state: "failed",
      error: `File upload failed: ${message}`,
    });
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  const t4 = Date.now();
  console.log(`[upload-timing] ${file.name} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB): formData=${t1 - t0}ms arrayBuffer=${t2 - t1}ms createJob=${t3 - t2}ms saveFile=${t4 - t3}ms total=${t4 - t0}ms`);
  return NextResponse.json({ jobId: job.id, state: job.state }, { status: 201 });
}
