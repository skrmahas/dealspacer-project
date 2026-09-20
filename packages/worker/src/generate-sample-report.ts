import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ExtractedData } from "@bei/shared";
import { assemblePdf, closeBrowser } from "./assembler.js";

const dataUrl = new URL("./__fixtures__/sample-report-data.json", import.meta.url);
const outputUrl = new URL("../../web/assets/sample-report.pdf", import.meta.url);

try {
  const data = JSON.parse(await fs.readFile(dataUrl, "utf8")) as ExtractedData;
  const pdf = await assemblePdf(data);
  const outputPath = fileURLToPath(outputUrl);

  await fs.mkdir(new URL("../../web/assets/", import.meta.url), { recursive: true });
  await fs.writeFile(outputPath, pdf);

  console.log(`[sample-report] Wrote ${outputPath} (${Math.round(pdf.length / 1024)}KB)`);
} finally {
  await closeBrowser();
}
