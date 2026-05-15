import fs from "node:fs/promises";
import path from "node:path";

export interface FileStore {
  saveFile(jobId: string, buffer: Buffer): Promise<void>;
  readFile(jobId: string): Promise<Buffer>;
  saveReport(jobId: string, pdf: Buffer): Promise<void>;
  readReport(jobId: string): Promise<Buffer>;
  saveBrief?(jobId: string, pdf: Buffer): Promise<void>;
  readBrief?(jobId: string): Promise<Buffer>;
}

// ── S3-compatible object storage ────────────────────────────────────────────

interface S3Config {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;

  return {
    bucket,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || "auto",
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

let s3Module: typeof import("@aws-sdk/client-s3") | null = null;

async function getS3Module(): Promise<typeof import("@aws-sdk/client-s3")> {
  if (!s3Module) {
    s3Module = await import("@aws-sdk/client-s3");
  }
  return s3Module;
}

export function createS3FileStore(config?: Partial<S3Config>): FileStore {
  const s3Config = config ?? getS3Config();
  if (!s3Config) {
    throw new Error("S3 not configured: set S3_BUCKET environment variable");
  }

  let clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;

  async function getClient(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (!clientPromise) {
      clientPromise = getS3Module().then(({ S3Client }) =>
        new S3Client({
          endpoint: s3Config!.endpoint,
          region: s3Config!.region,
          credentials: s3Config!.accessKeyId
            ? {
                accessKeyId: s3Config!.accessKeyId,
                secretAccessKey: s3Config!.secretAccessKey ?? "",
              }
            : undefined,
          forcePathStyle: s3Config!.forcePathStyle,
        }),
      );
    }
    return clientPromise;
  }

  return {
    async saveFile(jobId, buffer) {
      const { PutObjectCommand } = await getS3Module();
      const client = await getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: s3Config!.bucket,
          Key: `${jobId}.pdf`,
          Body: buffer,
        }),
      );
    },

    async readFile(jobId) {
      const { GetObjectCommand } = await getS3Module();
      const client = await getClient();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: s3Config!.bucket,
          Key: `${jobId}.pdf`,
        }),
      );
      if (!response.Body) throw new Error(`File not found in S3: ${jobId}.pdf`);
      return Buffer.from(await response.Body.transformToByteArray());
    },

    async saveReport(jobId, pdf) {
      const { PutObjectCommand } = await getS3Module();
      const client = await getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: s3Config!.bucket,
          Key: `${jobId}-report.pdf`,
          Body: pdf,
        }),
      );
    },

    async readReport(jobId) {
      const { GetObjectCommand } = await getS3Module();
      const client = await getClient();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: s3Config!.bucket,
          Key: `${jobId}-report.pdf`,
        }),
      );
      if (!response.Body) throw new Error(`Report not found in S3: ${jobId}-report.pdf`);
      return Buffer.from(await response.Body.transformToByteArray());
    },
  };
}

// ── Disk-backed file store ──────────────────────────────────────────────────

export interface EnvFileStoreOptions {
  defaultDataDir: string;
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
    async saveBrief(jobId, pdf) {
      await ensureDir();
      await fs.writeFile(path.join(resolvedDataDir, `${jobId}-brief.pdf`), pdf);
    },
    async readBrief(jobId) {
      return fs.readFile(path.join(resolvedDataDir, `${jobId}-brief.pdf`));
    },
  };
}

export function createEnvFileStore({ defaultDataDir }: EnvFileStoreOptions): FileStore {
  const dataDir = process.env.DATA_DIR?.trim() || defaultDataDir;
  return createFileStore({ dataDir });
}

// ── Auto file store: S3 if configured, otherwise disk ───────────────────────

/**
 * Creates a file store that automatically selects S3 if S3_BUCKET is set,
 * otherwise falls back to local disk storage using DATA_DIR or the provided
 * default directory.
 */
export function createAutoFileStore(defaultDataDir?: string): FileStore {
  const s3Config = getS3Config();
  if (s3Config) {
    console.log(`[file-store] Using S3: bucket=${s3Config.bucket}, region=${s3Config.region}`);
    return createS3FileStore(s3Config);
  }

  const dataDir = process.env.DATA_DIR?.trim() || defaultDataDir || "./bei-data";
  console.log(`[file-store] Using disk: dir=${dataDir}`);
  return createFileStore({ dataDir });
}
