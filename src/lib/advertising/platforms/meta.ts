import { decryptSecret, encryptSecret } from "@/lib/advertising/crypto";
import type { AdAccountOption, DailyInsight } from "@/lib/advertising/platforms/google";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string | null;
}

interface TokenJson {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string };
}

export async function exchangeMetaCode(code: string, redirectUri: string): Promise<MetaTokens> {
  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", process.env.META_ADS_APP_ID ?? "");
  shortUrl.searchParams.set("client_secret", process.env.META_ADS_APP_SECRET ?? "");
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortRes = await fetch(shortUrl);
  const shortJson = (await shortRes.json()) as TokenJson;
  if (!shortRes.ok || !shortJson.access_token) {
    throw new Error(shortJson.error?.message ?? "Meta token exchange failed.");
  }

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_ADS_APP_ID ?? "");
  longUrl.searchParams.set("client_secret", process.env.META_ADS_APP_SECRET ?? "");
  longUrl.searchParams.set("fb_exchange_token", shortJson.access_token);
  const longRes = await fetch(longUrl);
  const longJson = (await longRes.json()) as TokenJson;
  const accessToken = longJson.access_token ?? shortJson.access_token;
  const expiresIn = longJson.expires_in ?? shortJson.expires_in ?? 60 * 24 * 3600;

  return {
    accessToken,
    refreshToken: null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: "ads_management,ads_read",
  };
}

async function graph(
  accessToken: string,
  path: string,
  init?: RequestInit & { search?: Record<string, string> }
): Promise<unknown> {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(init?.search ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
      : init?.headers,
    body: init?.body,
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Meta API ${path} failed.`);
  }
  return json;
}

export async function listMetaAccounts(accessToken: string): Promise<AdAccountOption[]> {
  const json = (await graph(accessToken, "/me/adaccounts", {
    search: { fields: "id,name,account_status,currency", limit: "50" },
  })) as { data?: { id: string; name?: string; account_status?: number }[] };
  return (json.data ?? [])
    .filter((a) => a.account_status === 1 || a.account_status == null)
    .map((a) => ({
      id: a.id.replace(/^act_/, ""),
      name: a.name ? `${a.name} (${a.id})` : a.id,
    }));
}

export async function firstMetaPageId(accessToken: string): Promise<string | null> {
  const json = (await graph(accessToken, "/me/accounts", {
    search: { fields: "id,name", limit: "10" },
  })) as { data?: { id: string }[] };
  return json.data?.[0]?.id ?? null;
}

const META_OBJECTIVE: Record<string, string> = {
  LEADS: "OUTCOME_LEADS",
  SALES: "OUTCOME_SALES",
  TRAFFIC: "OUTCOME_TRAFFIC",
  PHONE_CALLS: "OUTCOME_TRAFFIC",
  AWARENESS: "OUTCOME_AWARENESS",
};

export interface MetaPublishInput {
  name: string;
  goal: string;
  budgetDailyCents: number;
  landingPage: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageUrl: string | null;
  adSetName: string;
}

export async function publishMetaCampaign(
  accessToken: string,
  accountId: string,
  input: MetaPublishInput
): Promise<{ campaignId: string }> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const pageId = await firstMetaPageId(accessToken);
  if (!pageId) {
    throw new Error(
      "Meta publishing needs a Facebook Page linked to this user. Connect a Page, then try again."
    );
  }

  const campaign = (await graph(accessToken, `/${act}/campaigns`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      objective: META_OBJECTIVE[input.goal] ?? "OUTCOME_TRAFFIC",
      status: "ACTIVE",
      special_ad_categories: [],
    }),
  })) as { id: string };

  const adSet = (await graph(accessToken, `/${act}/adsets`, {
    method: "POST",
    body: JSON.stringify({
      name: input.adSetName || input.name,
      campaign_id: campaign.id,
      daily_budget: Math.max(input.budgetDailyCents, 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: { geo_locations: { countries: ["US"] }, age_min: 18 },
      status: "ACTIVE",
    }),
  })) as { id: string };

  const linkData: Record<string, unknown> = {
    message: input.primaryText,
    name: input.headline,
    description: input.description || undefined,
    link: input.landingPage,
    call_to_action: { type: input.cta || "LEARN_MORE" },
  };
  if (input.imageUrl) linkData.picture = input.imageUrl;

  const creative = (await graph(accessToken, `/${act}/adcreatives`, {
    method: "POST",
    body: JSON.stringify({
      name: `${input.name} creative`,
      object_story_spec: {
        page_id: pageId,
        link_data: linkData,
      },
    }),
  })) as { id: string };

  await graph(accessToken, `/${act}/ads`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: "ACTIVE",
    }),
  });

  return { campaignId: campaign.id };
}

export async function setMetaCampaignStatus(
  accessToken: string,
  externalId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  await graph(accessToken, `/${externalId}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function fetchMetaInsights(
  accessToken: string,
  externalId: string,
  since: string,
  until: string
): Promise<DailyInsight[]> {
  const json = (await graph(accessToken, `/${externalId}/insights`, {
    search: {
      fields: "spend,impressions,clicks,actions,action_values,date_start",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "90",
    },
  })) as {
    data?: {
      spend?: string;
      impressions?: string;
      clicks?: string;
      date_start?: string;
      actions?: { action_type: string; value: string }[];
      action_values?: { action_type: string; value: string }[];
    }[];
  };

  return (json.data ?? []).map((row) => {
    const conversions = Number(
      row.actions?.find((a) =>
        ["offsite_conversion", "lead", "purchase", "omni_purchase"].includes(a.action_type)
      )?.value ?? 0
    );
    const revenue = Number(
      row.action_values?.find((a) =>
        ["offsite_conversion", "purchase", "omni_purchase"].includes(a.action_type)
      )?.value ?? 0
    );
    return {
      date: row.date_start ?? since,
      spendCents: Math.round(Number(row.spend ?? 0) * 100),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: Math.round(conversions),
      revenueCents: Math.round(revenue * 100),
    };
  });
}

export function persistMetaTokens(tokens: MetaTokens) {
  return {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: null as string | null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
  };
}

export function readMetaAccess(encrypted: string): string {
  return decryptSecret(encrypted);
}
