#!/usr/bin/env node
// Wipe upload-pipeline state for a clean dev slate.
//
// What it deletes:
//   - Postgres tables: jobs, reports, translation_cache (TRUNCATE … CASCADE)
//   - S3 bucket objects matching `*.pdf` (uploads) and `reports/*` (generated)
//   - Local DATA_DIR (./bei-data) contents, if present
//
// What it KEEPS:
//   - companies (curated reference data — reseed costs an API roundtrip)
//   - leads      (real user emails — unrelated to the upload pipeline)
//
// Usage (from repo root):
//   node --env-file=packages/worker/.env packages/shared/scripts/cleanup-storage.mjs
//
// Add --keep-translations to skip the translation_cache truncate.
// Add --dry-run to print what would happen without mutating anything.

import { Pool } from "pg";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const KEEP_TRANSLATIONS = args.has("--keep-translations");

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function shouldDeleteKey(key) {
  // Generated reports under "reports/<jobId>.pdf"
  if (key.startsWith("reports/")) return true;
  // Raw uploads at root: "<jobId>.pdf"
  if (/^[0-9a-f-]{30,}\.pdf$/i.test(key)) return true;
  return false;
}

async function truncatePostgres() {
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  try {
    const before = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM jobs)              AS jobs,
        (SELECT COUNT(*) FROM reports)           AS reports,
        (SELECT COUNT(*) FROM translation_cache) AS translations,
        (SELECT COUNT(*) FROM companies)         AS companies,
        (SELECT COUNT(*) FROM leads)             AS leads
    `);
    const counts = before.rows[0];
    console.log("[postgres] before:", counts);

    if (DRY_RUN) {
      console.log("[postgres] dry-run: skipping TRUNCATE");
      return;
    }

    // TRUNCATE jobs CASCADE also wipes reports (reports.job_id → jobs).
    // Listing reports explicitly is harmless and makes intent obvious.
    const targets = ["jobs", "reports"];
    if (!KEEP_TRANSLATIONS) targets.push("translation_cache");

    await pool.query(
      `TRUNCATE TABLE ${targets.join(", ")} RESTART IDENTITY CASCADE`,
    );

    const after = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM jobs)              AS jobs,
        (SELECT COUNT(*) FROM reports)           AS reports,
        (SELECT COUNT(*) FROM translation_cache) AS translations,
        (SELECT COUNT(*) FROM companies)         AS companies,
        (SELECT COUNT(*) FROM leads)             AS leads
    `);
    console.log("[postgres] after: ", after.rows[0]);
  } finally {
    await pool.end();
  }
}

async function purgeS3() {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    console.log("[s3] S3_BUCKET not set — skipping object storage cleanup");
    return;
  }

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || "auto",
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        }
      : undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });

  let token;
  let scanned = 0;
  let matched = 0;
  let deleted = 0;
  const matchedKeys = [];

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    const contents = page.Contents ?? [];
    scanned += contents.length;
    for (const obj of contents) {
      if (!obj.Key) continue;
      if (shouldDeleteKey(obj.Key)) {
        matched += 1;
        matchedKeys.push(obj.Key);
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  console.log(
    `[s3] scanned=${scanned} matching-keys=${matched} (uploads + reports)`,
  );

  if (matched === 0) {
    console.log("[s3] nothing to delete");
    return;
  }

  if (DRY_RUN) {
    console.log("[s3] dry-run: would delete the following keys:");
    for (const k of matchedKeys.slice(0, 20)) console.log(`  - ${k}`);
    if (matchedKeys.length > 20) {
      console.log(`  … and ${matchedKeys.length - 20} more`);
    }
    return;
  }

  // DeleteObjects accepts max 1000 keys per call.
  for (let i = 0; i < matchedKeys.length; i += 1000) {
    const slice = matchedKeys.slice(i, i + 1000);
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    deleted += slice.length;
    if (res.Errors?.length) {
      console.error(`[s3] delete errors:`, res.Errors);
    }
  }
  console.log(`[s3] deleted ${deleted} objects from bucket "${bucket}"`);
}

async function purgeLocalDataDir() {
  const dataDir = process.env.DATA_DIR?.trim();
  if (!dataDir) {
    console.log("[disk] DATA_DIR not set — skipping local disk cleanup");
    return;
  }
  const resolved = path.resolve(dataDir);
  let entries;
  try {
    entries = await fs.readdir(resolved);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`[disk] ${resolved} does not exist — skipping`);
      return;
    }
    throw err;
  }
  const pdfs = entries.filter((e) => e.toLowerCase().endsWith(".pdf"));
  console.log(`[disk] ${resolved}: ${pdfs.length} PDF file(s) found`);
  if (DRY_RUN || pdfs.length === 0) return;
  for (const f of pdfs) {
    await fs.unlink(path.join(resolved, f));
  }
  console.log(`[disk] deleted ${pdfs.length} PDF file(s)`);
}

async function main() {
  console.log(
    `\nCleanup ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} — keeping: companies, leads${KEEP_TRANSLATIONS ? ", translation_cache" : ""}\n`,
  );
  await truncatePostgres();
  await purgeS3();
  await purgeLocalDataDir();
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
