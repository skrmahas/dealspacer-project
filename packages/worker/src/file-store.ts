import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveFile(jobId: string, buffer: Buffer): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, `${jobId}.pdf`), buffer);
}

export async function readFile(jobId: string): Promise<Buffer> {
  return fs.readFile(path.join(DATA_DIR, `${jobId}.pdf`));
}

export async function saveReport(jobId: string, pdf: Buffer): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, `${jobId}-report.pdf`), pdf);
}

export async function readReport(jobId: string): Promise<Buffer> {
  return fs.readFile(path.join(DATA_DIR, `${jobId}-report.pdf`));
}
