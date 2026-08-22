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
    "/dashboard",
    "/dashboard/:path*",
    "/sites",
    "/sites/:path*",
    "/scans",
    "/scans/:path*",
    "/scan/:path*",
    "/visibility",
    "/visibility/:path*",
    "/recommendations",
    "/recommendations/:path*",
    "/opportunities",
    "/opportunities/:path*",
    "/competitors",
    "/competitors/:path*",
    "/seo",
    "/seo/:path*",
    "/leads",
    "/leads/:path*",
    "/reports",
    "/reports/:path*",
    "/settings",
    "/settings/:path*",
  ],
};
