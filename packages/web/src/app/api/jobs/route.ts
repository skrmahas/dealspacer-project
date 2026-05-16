import { randomUUID } from "node:crypto";
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
      `SELECT j.id, j.state, j.original_filename, j.output_language, j.error, j.created_at, j.updated_at,
              r.id AS report_id
       FROM jobs j
       LEFT JOIN reports r ON r.job_id = j.id
       ORDER BY j.created_at DESC LIMIT 20`,
    );
    const jobs = result.rows.map((row) => ({
      jobId: row.id,
      state: row.state,
      originalFilename: row.original_filename,
      outputLanguage: row.output_language,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reportId: row.report_id ?? null,
    }));
    return NextResponse.json(jobs);
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

  const store = createPostgresStore();
  const buffer = Buffer.from(await file.arrayBuffer());
  const t2 = Date.now();

  const companyIdValue = formData.get("companyId");
  const companyId = typeof companyIdValue === "string" && companyIdValue.length > 0
    ? companyIdValue
    : null;

  // Pre-generate the job id and upload the file to storage *before* inserting
  // the jobs row. The worker poll picks up rows in `pending` state via
  // `pollNextPending`; if the row appeared before the file landed in S3, the
  // worker would race ahead and fail readFile with NoSuchKey. Saving first
  // makes the row only observable to the worker after the file exists.
  const jobId = randomUUID();
  try {
    await saveFile(jobId, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown file storage error";
    console.error(`[upload] saveFile failed for ${file.name}: ${message}`);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
  const t3 = Date.now();

  const job = await store.createJob({
    id: jobId,
    originalFilename: file.name,
    outputLanguage,
    companyId,
  });
  const t4 = Date.now();

  console.log(`[upload-timing] ${file.name} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB): formData=${t1 - t0}ms arrayBuffer=${t2 - t1}ms saveFile=${t3 - t2}ms createJob=${t4 - t3}ms total=${t4 - t0}ms`);
  return NextResponse.json({ jobId: job.id, state: job.state }, { status: 201 });
}
