import fs from "node:fs/promises";
import path from "node:path";

export interface FileStore {
  saveFile(jobId: string, buffer: Buffer): Promise<void>;
  readFile(jobId: string): Promise<Buffer>;
  saveReport(jobId: string, pdf: Buffer): Promise<void>;
  readReport(jobId: string): Promise<Buffer>;
}

export function createFileStore({ dataDir }: { dataDir: string }): FileStore {
  const resolvedDataDir = path.resolve(dataDir);

  async function ensureDir() {
    await fs.mkdir(resolvedDataDir, { recursive: true });
  }

  return {
    async saveFile(jobId, buffer) {
      await ensureDir();
      await fs.writeFile(path.join(resolvedDataDir, `${jobId}.pdf`), buffer);
    },
    async readFile(jobId) {
      return fs.readFile(path.join(resolvedDataDir, `${jobId}.pdf`));
    },
    async saveReport(jobId, pdf) {
      await ensureDir();
      await fs.writeFile(path.join(resolvedDataDir, `${jobId}-report.pdf`), pdf);
    },
    async readReport(jobId) {
      return fs.readFile(path.join(resolvedDataDir, `${jobId}-report.pdf`));
    },
  };
}
