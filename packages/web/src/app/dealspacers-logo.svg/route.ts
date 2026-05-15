import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

async function readPublicAsset(filename: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "assets", filename));
}

export async function GET() {
  const logo = await readPublicAsset("dealspacer-logo.svg");

  return new NextResponse(new Uint8Array(logo), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
