import fs from "node:fs";

// Generate a minimal but well-formed PDF with financial content
const text = `Baltic Earnings Report - Q4 2025
Revenue: EUR 142.3M
EBITDA: EUR 38.7M
Net Profit: EUR 21.4M
Total Assets: EUR 892.1M
Total Liabilities: EUR 453.6M`;

// Build PDF content stream with Tj operators
const contentLines = text.split("\n").map((line, i) => {
  const y = 750 - i * 18;
  return `BT /F1 12 Tf 50 ${y} Td (${line.replace(/[()\\]/g, "\\$&")}) Tj ET`;
});
const contentStream = contentLines.join("\n") + "\n";

const objects: string[] = [];

// Object 1: Catalog
objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

// Object 2: Pages
objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

// Object 3: Page
objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj");

// Object 4: Content stream
objects.push(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`);

// Object 5: Font
objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

// Calculate xref offsets
let offset = 0;
const offsets: number[] = [];
const header = "%PDF-1.4\n";
offset += header.length;
for (const obj of objects) {
  offsets.push(offset);
  offset += obj.length + 1; // +1 for newline
}
const xrefStart = offset;

// Build xref table
let xref = "xref\n";
xref += `0 ${objects.length + 1}\n`;
xref += "0000000000 65535 f \n";
for (const off of offsets) {
  xref += `${String(off).padStart(10, "0")} 00000 n \n`;
}

// Build trailer
const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

const pdf = header + objects.join("\n") + "\n" + xref + trailer;

fs.writeFileSync("test-fixtures/sample.pdf", pdf);
console.log(`Created sample.pdf (${pdf.length} bytes, ${text.length} chars of content)`);
