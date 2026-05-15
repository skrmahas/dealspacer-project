import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

async function readPublicAsset(filename: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "assets", filename));
}

export async function GET() {
  const report = await readPublicAsset("sample-report.pdf");

  return new NextResponse(new Uint8Array(report), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="sample-report.pdf"',
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
