import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import type { FileStore } from "./index.js";

function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env("S3_REGION", "auto"),
      endpoint: env("S3_ENDPOINT"),
      credentials: {
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
      },
      forcePathStyle: env("S3_FORCE_PATH_STYLE", "false") === "true",
    });
  }
  return s3Client;
}

export function createS3FileStore(): FileStore {
  const bucket = env("S3_BUCKET");

  function fileKey(jobId: string): string {
    return `uploads/${jobId}`;
  }

  function reportKey(jobId: string): string {
    return `reports/${jobId}.pdf`;
  }

  return {
    async saveFile(jobId, buffer) {
      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileKey(jobId),
          Body: buffer,
        }),
      );
    },

    async readFile(jobId) {
      const client = getS3Client();
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey(jobId),
          }),
        );
        if (!response.Body) {
          throw new Error(`File not found for job ${jobId}`);
        }
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (err) {
        if (err instanceof NoSuchKey || (err as Error).name === "NoSuchKey") {
          throw new Error(`File not found for job ${jobId}`);
        }
        throw err;
      }
    },

    async saveReport(jobId, pdf) {
      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: reportKey(jobId),
          Body: pdf,
          ContentType: "application/pdf",
        }),
      );
    },

    async readReport(jobId) {
      const client = getS3Client();
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: reportKey(jobId),
          }),
        );
        if (!response.Body) {
          throw new Error(`Report not found for job ${jobId}`);
        }
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (err) {
        if (err instanceof NoSuchKey || (err as Error).name === "NoSuchKey") {
          throw new Error(`Report not found for job ${jobId}`);
        }
        throw err;
      }
    },
  };
}
