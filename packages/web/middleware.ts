import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "bei_access";
const ACCESS_COOKIE_VALUE = "granted";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/access") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (token === ACCESS_COOKIE_VALUE) {
    return NextResponse.next();
  }

  const target = `${request.nextUrl.pathname}${request.nextUrl.search || ""}`;
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/access";
  redirectUrl.searchParams.set("next", target);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/", "/reports/:path*"],
};
