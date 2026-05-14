import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Job, JobState, CreateJobInput, UpdateJobInput, JobStore } from "@bei/shared";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJobs(): Promise<Job[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "jobs.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJobs(jobs: Job[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, "jobs.json"),
    JSON.stringify(jobs, null, 2),
    "utf-8",
  );
}

export function createFileStore(): JobStore {
  return {
    async createJob(input: CreateJobInput): Promise<Job> {
      const jobs = await readJobs();
      const job: Job = {
        id: randomUUID(),
        state: "pending",
        originalFilename: input.originalFilename,
        extractedText: null,
        extractedJson: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.push(job);
      await writeJobs(jobs);
      return job;
    },

    async getJob(id: string): Promise<Job | null> {
      const jobs = await readJobs();
      return jobs.find((j) => j.id === id) ?? null;
    },

    async updateJob(id: string, input: UpdateJobInput): Promise<Job> {
      const jobs = await readJobs();
      const idx = jobs.findIndex((j) => j.id === id);
      if (idx === -1) throw new Error(`Job ${id} not found`);
      jobs[idx] = { ...jobs[idx], ...input, updatedAt: new Date().toISOString() };
      await writeJobs(jobs);
      return jobs[idx];
    },

    async pollNextPending(): Promise<Job | null> {
      const jobs = await readJobs();
      return jobs.find((j) => j.state === "pending") ?? null;
    },
  };
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
