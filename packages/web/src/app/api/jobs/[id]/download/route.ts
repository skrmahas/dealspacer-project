import { NextRequest, NextResponse } from "next/server";
import { createPostgresStore, createAutoFileStore } from "@bei/shared";

const { readReport } = createAutoFileStore();

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_\.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function buildDownloadFilename(originalFilename: string, extractedJson: string | null): string {
  if (extractedJson) {
    try {
      const data = JSON.parse(extractedJson) as { metadata?: { companyName?: string; reportPeriod?: string } };
      const company = data.metadata?.companyName?.trim();
      const period = data.metadata?.reportPeriod?.trim();
      if (company) {
        const parts = [company];
        if (period) parts.push(period);
        parts.push("report");
        return sanitizeFilename(parts.join("-")) + ".pdf";
      }
    } catch {
      // Fall through to default name
    }
  }
  return sanitizeFilename(originalFilename.replace(/\.(pdf|csv|html|htm|xhtml)$/i, "")) + "-report.pdf";
}

/**
 * Parse an HTTP Range header value.
 * Supports "bytes=start-end" and "bytes=start-" formats.
 * Returns null if the range is invalid or not parseable.
 */
function parseRange(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const endRaw = match[2];

  if (start >= fileSize) return null;

  let end: number;
  if (endRaw === "") {
    // "bytes=500-" → from start to end of file
    end = fileSize - 1;
  } else {
    end = parseInt(endRaw, 10);
    if (end >= fileSize) end = fileSize - 1;
  }

  if (start > end) return null;

  return { start, end };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = createPostgresStore();
  const job = await store.getJob(params.id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.state !== "complete") {
    return NextResponse.json(
      { error: "Job not complete yet" },
      { status: 409 },
    );
  }

  try {
    const fileBuffer = Buffer.from(await readReport(job.id));
    const fileSize = fileBuffer.length;
    const filename = buildDownloadFilename(job.originalFilename, job.extractedJson);

    const rangeHeader = request.headers.get("range");

    // Handle range request
    if (rangeHeader) {
      const range = parseRange(rangeHeader, fileSize);
      if (!range) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const { start, end } = range;
      const chunk = fileBuffer.subarray(start, end + 1);

      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunk.length),
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Full file response
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Report PDF not found" },
      { status: 404 },
    );
  }
}
