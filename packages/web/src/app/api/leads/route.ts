import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@bei/shared";

interface LeadPayload {
  email?: string;
  company?: string;
  role?: string;
  useCase?: string;
  message?: string | null;
  source?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  pageReferrer?: string | null;
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

function normalizeShortText(input: unknown, maxChars = 160): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
}

function normalizeLongText(input: unknown, maxChars = 2000): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
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
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  const company = normalizeShortText(body.company, 200);
  const role = normalizeShortText(body.role, 200);
  const useCase = normalizeShortText(body.useCase, 120);

  const note = normalizeLongText(body.message, 2000);
  const source = normalizeSource(body.source);
  const utmSource = normalizeSource(body.utmSource);
  const utmMedium = normalizeSource(body.utmMedium);
  const utmCampaign = normalizeSource(body.utmCampaign);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const explicitReferrer = normalizeLongText(body.pageReferrer, 500);
  const headerReferrer = request.headers.get("referer")?.slice(0, 500) ?? null;
  const referrer = explicitReferrer || headerReferrer;
  const ipAddress = getClientIp(request);

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO leads (
         email, company, role, use_case, message, source, utm_source, utm_medium, utm_campaign, user_agent, referrer, ip_address
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (email) DO UPDATE SET
         company = EXCLUDED.company,
         role = EXCLUDED.role,
         use_case = EXCLUDED.use_case,
         message = COALESCE(EXCLUDED.message, leads.message),
         source = COALESCE(EXCLUDED.source, leads.source),
         utm_source = COALESCE(EXCLUDED.utm_source, leads.utm_source),
         utm_medium = COALESCE(EXCLUDED.utm_medium, leads.utm_medium),
         utm_campaign = COALESCE(EXCLUDED.utm_campaign, leads.utm_campaign),
         user_agent = EXCLUDED.user_agent,
         referrer = EXCLUDED.referrer,
         ip_address = EXCLUDED.ip_address,
         updated_at = NOW()`,
      [
        rawEmail,
        company,
        role,
        useCase,
        note,
        source,
        utmSource,
        utmMedium,
        utmCampaign,
        userAgent,
        referrer,
        ipAddress,
      ],
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
