import path from "node:path";
import { createFileStore } from "@bei/shared";

// Next.js sets CWD to packages/web/, so go up to project root
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "..", "..", "data");

export const { saveFile, readFile, saveReport, readReport } = createFileStore({ dataDir: DATA_DIR });
