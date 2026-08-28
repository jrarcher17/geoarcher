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
    "/ai-search",
    "/ai-search/:path*",
    "/recommendations",
    "/recommendations/:path*",
    "/optimize",
    "/opportunities",
    "/opportunities/:path*",
    "/competitors",
    "/competitors/:path*",
    "/autopilot",
    "/autopilot/:path*",
    "/seo",
    "/seo/:path*",
    "/traffic",
    "/citations",
    "/backlinks",
    "/leads",
    "/leads/:path*",
    "/reports",
    "/reports/:path*",
    "/settings",
    "/settings/:path*",
    "/ad-studio",
    "/ad-studio/:path*",
    "/campaigns",
    "/campaigns/:path*",
    "/analytics",
    "/assistant",
    "/integrations",
  ],
};
