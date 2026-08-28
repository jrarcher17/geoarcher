import { NextRequest, NextResponse } from "next/server";
import { completeOAuth } from "@/lib/advertising/connections";
import {
  OAUTH_STATE_COOKIE,
  appBaseUrl,
  parsePlatform,
  readOAuthState,
} from "@/lib/advertising/oauth";

function redirectToIntegrations(query: Record<string, string>) {
  const url = new URL("/integrations", appBaseUrl());
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: raw } = await params;
  const platform = parsePlatform(raw);
  if (!platform) {
    return redirectToIntegrations({ error: "Unknown platform." });
  }

  const denied = request.nextUrl.searchParams.get("error");
  if (denied) {
    return redirectToIntegrations({ error: "Connection was cancelled." });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookie || cookie !== state) {
    return redirectToIntegrations({ error: "Invalid OAuth state. Try connecting again." });
  }

  const parsed = readOAuthState(state);
  if (!parsed || parsed.platform !== platform) {
    return redirectToIntegrations({ error: "OAuth state expired. Try connecting again." });
  }

  try {
    const result = await completeOAuth(parsed.userId, platform, code);
    if (!result.accountId && result.accounts.length > 1) {
      return redirectToIntegrations({ connected: platform, pick: "1" });
    }
    if (!result.accountId) {
      return redirectToIntegrations({
        connected: platform,
        error: "Connected, but no ad account was available to select.",
      });
    }
    return redirectToIntegrations({ connected: platform });
  } catch (err) {
    console.error(`[oauth] ${platform} callback:`, err);
    return redirectToIntegrations({
      error: err instanceof Error ? err.message : "Connection failed.",
    });
  }
}
