#!/usr/bin/env npx tsx
/**
 * Bulk import CLI — reads a JSON manifest, validates entries against
 * the companies catalog, creates pending jobs, and optionally waits
 * for completion.
 *
 * Usage:
 *   npx tsx src/import.ts --dir ./reports --manifest ./manifest.json
 *
 * Options:
 *   --dir           Directory containing report files
 *   --manifest      Path to manifest JSON file
 *   --concurrency   Max parallel job creations (default: 5)
 *   --timeout       Max ms to wait for completion (default: 600000 = 10 min)
 *   --wait          Wait for all jobs to complete (default: false)
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createPostgresStore, createCompanyStore, createAutoFileStore, runMigrations } from "@bei/shared";
import type { OutputLanguage } from "@bei/shared";

interface ManifestEntry {
  file: string;
  company_slug: string;
  fiscal_year: number;
  report_type: string;
  output_language?: string;
}

const VALID_REPORT_TYPES = new Set(["annual", "q1", "q2", "q3", "q4", "semi-annual", "other"]);
const VALID_LANGUAGES = new Set(["en", "et", "lv", "lt"]);

function parseArgs(): {
  dir: string; manifest: string; concurrency: number; timeout: number; wait: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    if (i >= 0 && i + 1 < args.length) return args[i + 1];
    return undefined;
  };

  return {
    dir: path.resolve(get("--dir") || "./reports"),
    manifest: path.resolve(get("--manifest") || "./manifest.json"),
    concurrency: parseInt(get("--concurrency") || "5", 10),
    timeout: parseInt(get("--timeout") || "600000", 10),
    wait: args.includes("--wait"),
  };
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  await runMigrations();

  // Read manifest
  let manifest: ManifestEntry[];
  try {
    const raw = await fs.readFile(opts.manifest, "utf-8");
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read manifest: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error("Manifest must be a non-empty array");
    process.exit(1);
  }

  console.log(`Manifest: ${manifest.length} entries`);

  // Validate
  const companyStore = createCompanyStore();
  const companies = await companyStore.listCompanies();
  const slugMap = new Map(companies.map((c) => [c.slug, c]));

  const errors: string[] = [];
  for (const [i, entry] of manifest.entries()) {
    // Validate file exists
    const filePath = path.join(opts.dir, entry.file);
    try {
      await fs.access(filePath);
    } catch {
      errors.push(`[${i}] File not found: ${entry.file}`);
    }

    // Validate company slug
    if (!slugMap.has(entry.company_slug)) {
      errors.push(`[${i}] Unknown company slug: ${entry.company_slug}`);
    }

    // Validate report type
    if (!VALID_REPORT_TYPES.has(entry.report_type)) {
      errors.push(`[${i}] Invalid report type: ${entry.report_type}`);
    }

    // Validate language
    const lang = entry.output_language || "en";
    if (!VALID_LANGUAGES.has(lang)) {
      errors.push(`[${i}] Invalid output language: ${lang}`);
    }
  }

  if (errors.length > 0) {
    console.error("Validation errors:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log("Validation passed ✓");

  // Create jobs
  const jobStore = createPostgresStore();
  const fileStore = createAutoFileStore();
  const jobIds: string[] = [];
  let created = 0;

  for (let i = 0; i < manifest.length; i += opts.concurrency) {
    const batch = manifest.slice(i, i + opts.concurrency);
    const results = await Promise.all(
      batch.map(async (entry) => {
        const company = slugMap.get(entry.company_slug)!;
        const lang = (entry.output_language || "en") as OutputLanguage;
        const filePath = path.join(opts.dir, entry.file);

        // Save the file to storage *before* inserting the jobs row so the
        // worker poll cannot claim the job before the bytes are available.
        const buffer = await fs.readFile(filePath);
        const jobId = randomUUID();
        await fileStore.saveFile(jobId, buffer);
        const job = await jobStore.createJob({
          id: jobId,
          originalFilename: entry.file,
          outputLanguage: lang,
          companyId: company.id,
        });
        return job.id;
      }),
    );
    jobIds.push(...results);
    created += batch.length;
    console.log(`Created ${created}/${manifest.length} jobs`);
  }

  console.log(`Done — ${jobIds.length} jobs created`);

  // Optionally wait for completion
  if (opts.wait) {
    console.log(`Waiting for jobs to complete (timeout: ${opts.timeout}ms)...`);
    const start = Date.now();
    const pending = new Set(jobIds);

    while (pending.size > 0 && Date.now() - start < opts.timeout) {
      for (const id of [...pending]) {
        const job = await jobStore.getJob(id);
        if (!job || job.state === "complete" || job.state === "failed" || job.state === "duplicate") {
          pending.delete(id);
        }
      }
      if (pending.size > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (pending.size === 0) {
      console.log("All jobs completed ✓");
    } else {
      console.log(`${pending.size} jobs still pending after timeout`);
    }
  }
}

main().catch((err) => {
  console.error("Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
