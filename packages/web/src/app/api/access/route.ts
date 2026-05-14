import { NextRequest, NextResponse } from "next/server";
import {
  PRODUCTION_ACCESS_CODE_MISSING_MESSAGE,
  resolveExpectedAccessCode,
} from "@/lib/access-code";

const ACCESS_COOKIE_NAME = "bei_access";
const ACCESS_COOKIE_VALUE = "granted";
const ACCESS_COOKIE_AGE_SECONDS = 60 * 60 * 24 * 30;

function normalizedPath(path: string): string {
  if (!path || !path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";
  return path;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as { code?: string; next?: string }));
  const code = (body.code ?? "").trim();
  const next = normalizedPath(body.next ?? "/");
  const expected = resolveExpectedAccessCode();

  if (!expected) {
    return NextResponse.json({ error: PRODUCTION_ACCESS_CODE_MISSING_MESSAGE }, { status: 500 });
  }

  if (!code || code !== expected) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, next });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: ACCESS_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_AGE_SECONDS,
  });
  return response;
}
