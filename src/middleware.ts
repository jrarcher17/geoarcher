import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isProtectedAppPath, loginUrlWithReturn } from "@/lib/auth-guard";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedAppPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = getSessionCookie(request);
  if (!sessionToken) {
    const loginPath = loginUrlWithReturn(pathname, search);
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sites/:path*",
    "/scans/:path*",
    "/scan/:path*",
    "/visibility/:path*",
    "/recommendations/:path*",
    "/opportunities/:path*",
    "/competitors/:path*",
    "/seo/:path*",
    "/seo",
    "/leads/:path*",
    "/leads",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
