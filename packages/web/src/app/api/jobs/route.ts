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
  const t2 = Date.now();
  const job = await store.createJob({ originalFilename: file.name, outputLanguage });
  const t3 = Date.now();

  // Fire-and-forget S3 upload: respond to client immediately, persist in
  // background. If S3 fails we mark the job as failed so the worker skips it.
  saveFile(job.id, buffer)
    .then(() => {
      const t4 = Date.now();
      console.log(`[DEBUG-a4f2] Upload timing for ${file.name} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB):`);
      console.log(`[DEBUG-a4f2]   formData parse: ${t1 - t0}ms`);
      console.log(`[DEBUG-a4f2]   arrayBuffer+convert: ${t2 - t1}ms`);
      console.log(`[DEBUG-a4f2]   createJob (DB): ${t3 - t2}ms`);
      console.log(`[DEBUG-a4f2]   saveFile (S3): ${t4 - t3}ms`);
      console.log(`[DEBUG-a4f2]   TOTAL background: ${t4 - t0}ms`);
    })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : "Unknown S3 error";
      console.error(`[DEBUG-a4f2] S3 upload failed for job ${job.id}: ${message}`);
      try {
        await store.updateJob(job.id, {
          state: "failed",
          error: `S3 upload failed: ${message}`,
        });
      } catch (updateErr) {
        console.error(`[DEBUG-a4f2] Failed to update job ${job.id} after S3 error:`, updateErr);
      }
    });

  // Respond immediately — the S3 upload continues in the background.
  const tResponse = Date.now();
  console.log(`[DEBUG-a4f2] Response sent for ${file.name} in ${tResponse - t0}ms (S3 still uploading in background)`);
  return NextResponse.json({ jobId: job.id, state: job.state }, { status: 201 });
}
