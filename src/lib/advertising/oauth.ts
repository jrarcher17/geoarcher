import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type AdOAuthPlatform = "google" | "meta";

export const OAUTH_STATE_COOKIE = "ga_ad_oauth";

export function appBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function googleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  );
}

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_ADS_APP_ID && process.env.META_ADS_APP_SECRET);
}

export function platformConfigured(platform: AdOAuthPlatform): boolean {
  return platform === "google" ? googleAdsConfigured() : metaAdsConfigured();
}

export function callbackUrl(platform: AdOAuthPlatform): string {
  return `${appBaseUrl()}/api/integrations/${platform}/callback`;
}

function stateSecret(): string {
  const raw =
    process.env.AD_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();
  if (!raw) throw new Error("Missing BETTER_AUTH_SECRET for OAuth state signing.");
  return raw;
}

export function createOAuthState(userId: string, platform: AdOAuthPlatform): string {
  const payload = {
    userId,
    platform,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readOAuthState(
  state: string
): { userId: string; platform: AdOAuthPlatform } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId: string;
      platform: AdOAuthPlatform;
      exp: number;
    };
    if (payload.exp < Date.now()) return null;
    if (payload.platform !== "google" && payload.platform !== "meta") return null;
    return { userId: payload.userId, platform: payload.platform };
  } catch {
    return null;
  }
}

export function googleAuthorizeUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_ADS_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", callbackUrl("google"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function metaAuthorizeUrl(state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_ADS_APP_ID ?? "");
  url.searchParams.set("redirect_uri", callbackUrl("meta"));
  url.searchParams.set(
    "scope",
    "ads_management,ads_read,business_management,pages_show_list,pages_read_engagement"
  );
  url.searchParams.set("state", state);
  return url.toString();
}

export function authorizeUrl(platform: AdOAuthPlatform, state: string): string {
  return platform === "google" ? googleAuthorizeUrl(state) : metaAuthorizeUrl(state);
}

export function parsePlatform(value: string): AdOAuthPlatform | null {
  if (value === "google" || value === "meta") return value;
  return null;
}

export function toDbPlatform(platform: AdOAuthPlatform): "GOOGLE" | "META" {
  return platform === "google" ? "GOOGLE" : "META";
}
