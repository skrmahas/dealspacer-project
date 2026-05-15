import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFileStore, createAutoFileStore } from "./file-store.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bei-file-store-test-"));
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
});

describe("createFileStore", () => {
  let fileStore: ReturnType<typeof createFileStore>;

  beforeAll(() => {
    fileStore = createFileStore({ dataDir: tempDir });
  });

  it("saves and reads a file", async () => {
    const buffer = Buffer.from("test file content");
    await fileStore.saveFile("test-job-1", buffer);

    const result = await fileStore.readFile("test-job-1");
    expect(result.toString()).toBe("test file content");
  });

  it("saves and reads a report", async () => {
    const pdf = Buffer.from("fake pdf content");
    await fileStore.saveReport("test-job-2", pdf);

    const result = await fileStore.readReport("test-job-2");
    expect(result.toString()).toBe("fake pdf content");
  });

  it("writes files as .pdf in the data directory", async () => {
    const buffer = Buffer.from("another file");
    await fileStore.saveFile("test-job-3", buffer);

    const filePath = path.join(tempDir, "test-job-3.pdf");
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);

    const onDisk = await fs.readFile(filePath);
    expect(onDisk.toString()).toBe("another file");
  });

  it("writes reports with -report suffix", async () => {
    const pdf = Buffer.from("report data");
    await fileStore.saveReport("test-job-4", pdf);

    const filePath = path.join(tempDir, "test-job-4-report.pdf");
    const onDisk = await fs.readFile(filePath);
    expect(onDisk.toString()).toBe("report data");
  });

  it("throws when reading a non-existent file", async () => {
    await expect(fileStore.readFile("nonexistent")).rejects.toThrow();
  });

  it("throws when reading a non-existent report", async () => {
    await expect(fileStore.readReport("nonexistent")).rejects.toThrow();
  });
});

describe("createAutoFileStore", () => {
  it("picks disk mode when S3_BUCKET is not set", async () => {
    // Ensure S3_BUCKET is unset
    const oldBucket = process.env.S3_BUCKET;
    delete process.env.S3_BUCKET;
    process.env.DATA_DIR = tempDir;

    try {
      const store = createAutoFileStore();
      const buffer = Buffer.from("auto file store test");
      await store.saveFile("auto-test", buffer);

      const result = await store.readFile("auto-test");
      expect(result.toString()).toBe("auto file store test");
    } finally {
      if (oldBucket) process.env.S3_BUCKET = oldBucket;
      delete process.env.DATA_DIR;
    }
  });
});
