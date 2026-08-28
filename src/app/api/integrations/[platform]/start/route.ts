import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import {
  OAUTH_STATE_COOKIE,
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
    return NextResponse.json(
      { error: "OAuth credentials are not configured on this server." },
      { status: 409 }
    );
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
