import path from "node:path";
import { createFileStore } from "@bei/shared";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(import.meta.dirname, "..", "..", "data");

export const { saveFile, readFile, saveReport, readReport } = createFileStore({ dataDir: DATA_DIR });
