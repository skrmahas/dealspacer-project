import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function parsePdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse(data);
  try {
    await parser.load();
    return parser.getText();
  } finally {
    parser.destroy();
  }
}
