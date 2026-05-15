import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "bei_access";
const ACCESS_COOKIE_VALUE = "granted";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

if (process.env.NODE_ENV === "production") {
  SECURITY_HEADERS["Strict-Transport-Security"] =
    "max-age=63072000; includeSubDomains; preload";
}

function applySecurityHeaders(
  response: NextResponse,
  isSharePage: boolean,
): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Share pages allow iframe embedding for PDF preview; everything else is DENY
  response.headers.set(
    "X-Frame-Options",
    isSharePage ? "SAMEORIGIN" : "DENY",
  );

  return response;
}

export function middleware(request: NextRequest) {
  const isSharePage = request.nextUrl.pathname.startsWith("/reports/");

  if (request.nextUrl.pathname === "/access") {
    return applySecurityHeaders(NextResponse.next(), isSharePage);
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (token === ACCESS_COOKIE_VALUE) {
    return applySecurityHeaders(NextResponse.next(), isSharePage);
  }

  const target = `${request.nextUrl.pathname}${request.nextUrl.search || ""}`;
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/access";
  redirectUrl.searchParams.set("next", target);
  const response = NextResponse.redirect(redirectUrl);
  // Security headers on redirect responses too
  return applySecurityHeaders(response, false);
}

export const config = {
  matcher: ["/", "/reports/:path*"],
};
