import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@bei/shared";

interface LeadPayload {
  email?: string;
  source?: string;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSource(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 120);
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 120);
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as LeadPayload));
  const rawEmail = (body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const source = normalizeSource(body.source);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const referrer = request.headers.get("referer")?.slice(0, 500) ?? null;
  const ipAddress = getClientIp(request);

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO leads (email, source, user_agent, referrer, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         source = COALESCE(EXCLUDED.source, leads.source),
         user_agent = EXCLUDED.user_agent,
         referrer = EXCLUDED.referrer,
         ip_address = EXCLUDED.ip_address,
         updated_at = NOW()`,
      [rawEmail, source, userAgent, referrer, ipAddress],
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
