import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import {
  OAUTH_STATE_COOKIE,
  appBaseUrl,
  authorizeUrl,
  createOAuthState,
  parsePlatform,
  platformConfigured,
} from "@/lib/advertising/oauth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const { platform: raw } = await params;
  const platform = parsePlatform(raw);
  if (!platform) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  }
  if (!platformConfigured(platform)) {
    const url = new URL("/integrations", appBaseUrl());
    url.searchParams.set(
      "error",
      platform === "google"
        ? "Google Ads OAuth is not configured on this server. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN, then restart."
        : "Meta Ads OAuth is not configured on this server. Set META_ADS_APP_ID and META_ADS_APP_SECRET, then restart."
    );
    return NextResponse.redirect(url);
  }

  const state = createOAuthState(access.userId, platform);
  const res = NextResponse.redirect(authorizeUrl(platform, state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
