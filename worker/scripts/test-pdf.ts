import fs from "node:fs";
import { PDFParse } from "pdf-parse";

async function main() {
  const buf = fs.readFileSync("test-fixtures/sample.pdf");
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const parser = new PDFParse(data);
  await parser.load();
  const text = parser.getText();
  console.log("SUCCESS - extracted:", text.substring(0, 200));
  parser.destroy();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
