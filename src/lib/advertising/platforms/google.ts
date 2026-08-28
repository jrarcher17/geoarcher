import { decryptSecret, encryptSecret } from "@/lib/advertising/crypto";

const ADS_VERSION = "v18";
const ADS = `https://googleads.googleapis.com/${ADS_VERSION}`;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string | null;
}

export interface AdAccountOption {
  id: string;
  name: string;
}

interface TokenJson {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

function developerToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not set.");
  return token;
}

function loginCustomerHeader(): Record<string, string> {
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "").trim();
  return mcc ? { "login-customer-id": mcc } : {};
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenJson;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google token exchange failed.");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scopes: json.scope ?? "https://www.googleapis.com/auth/adwords",
  };
}

export async function refreshGoogleAccess(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenJson;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google token refresh failed.");
  }
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scopes: json.scope ?? null,
  };
}

async function adsFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${ADS}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
      "Content-Type": "application/json",
      ...loginCustomerHeader(),
      ...(init?.headers ?? {}),
    },
  });
}

export async function listGoogleAccounts(accessToken: string): Promise<AdAccountOption[]> {
  const res = await adsFetch(accessToken, "/customers:listAccessibleCustomers");
  const json = (await res.json()) as { resourceNames?: string[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Could not list Google Ads accounts.");
  }
  const ids = (json.resourceNames ?? []).map((r) => r.replace("customers/", ""));
  const named: AdAccountOption[] = [];
  for (const id of ids) {
    try {
      const search = await adsFetch(accessToken, `/customers/${id}/googleAds:search`, {
        method: "POST",
        body: JSON.stringify({
          query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
        }),
      });
      const data = (await search.json()) as {
        results?: { customer?: { id?: string; descriptiveName?: string } }[];
      };
      const customer = data.results?.[0]?.customer;
      named.push({
        id,
        name: customer?.descriptiveName ? `${customer.descriptiveName} (${id})` : id,
      });
    } catch {
      named.push({ id, name: id });
    }
  }
  return named;
}

interface MutateResponse {
  results?: { resourceName?: string }[];
  error?: { message?: string };
  message?: string;
}

async function mutate(
  accessToken: string,
  customerId: string,
  endpoint: string,
  operations: unknown[]
): Promise<string> {
  const res = await adsFetch(accessToken, `/customers/${customerId}/${endpoint}:mutate`, {
    method: "POST",
    body: JSON.stringify({ operations, partialFailure: false }),
  });
  const json = (await res.json()) as MutateResponse;
  const name = json.results?.[0]?.resourceName;
  if (!res.ok || !name) {
    throw new Error(json.error?.message ?? json.message ?? `Google Ads ${endpoint} mutate failed.`);
  }
  return name;
}

export interface GooglePublishInput {
  name: string;
  budgetDailyCents: number;
  landingPage: string;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  adGroupName: string;
}

export async function publishGoogleCampaign(
  accessToken: string,
  customerId: string,
  input: GooglePublishInput
): Promise<{ campaignId: string }> {
  const cid = customerId.replace(/-/g, "");
  const budgetMicros = Math.max(input.budgetDailyCents, 100) * 10_000;

  const budgetName = await mutate(accessToken, cid, "campaignBudgets", [
    {
      create: {
        name: `${input.name} budget ${Date.now()}`,
        amountMicros: String(budgetMicros),
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  ]);

  const campaignName = await mutate(accessToken, cid, "campaigns", [
    {
      create: {
        name: input.name,
        advertisingChannelType: "SEARCH",
        status: "ENABLED",
        campaignBudget: budgetName,
        containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
        },
      },
    },
  ]);

  const adGroupName = await mutate(accessToken, cid, "adGroups", [
    {
      create: {
        name: input.adGroupName || input.name,
        campaign: campaignName,
        status: "ENABLED",
        type: "SEARCH_STANDARD",
        cpcBidMicros: "1000000",
      },
    },
  ]);

  const keywords = input.keywords.slice(0, 20).filter(Boolean);
  if (keywords.length > 0) {
    await mutate(
      accessToken,
      cid,
      "adGroupCriteria",
      keywords.map((text) => ({
        create: {
          adGroup: adGroupName,
          status: "ENABLED",
          keyword: { text: text.slice(0, 80), matchType: "BROAD" },
        },
      }))
    );
  }

  const headlines = input.headlines
    .filter((h) => h.length > 0 && h.length <= 30)
    .slice(0, 15)
    .map((text) => ({ text }));
  const descriptions = input.descriptions
    .filter((d) => d.length > 0 && d.length <= 90)
    .slice(0, 4)
    .map((text) => ({ text }));
  if (headlines.length < 3 || descriptions.length < 2) {
    throw new Error("Google Ads needs at least 3 headlines and 2 descriptions.");
  }

  await mutate(accessToken, cid, "adGroupAds", [
    {
      create: {
        adGroup: adGroupName,
        status: "ENABLED",
        ad: {
          finalUrls: [input.landingPage],
          responsiveSearchAd: { headlines, descriptions },
        },
      },
    },
  ]);

  const campaignId = campaignName.split("/").pop() ?? campaignName;
  return { campaignId };
}

export async function setGoogleCampaignStatus(
  accessToken: string,
  customerId: string,
  externalId: string,
  status: "ENABLED" | "PAUSED"
): Promise<void> {
  const cid = customerId.replace(/-/g, "");
  await mutate(accessToken, cid, "campaigns", [
    {
      update: {
        resourceName: `customers/${cid}/campaigns/${externalId}`,
        status,
      },
      updateMask: "status",
    },
  ]);
}

export interface DailyInsight {
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
}

export async function fetchGoogleInsights(
  accessToken: string,
  customerId: string,
  externalId: string,
  since: string,
  until: string
): Promise<DailyInsight[]> {
  const cid = customerId.replace(/-/g, "");
  const query = `
    SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE campaign.id = ${externalId}
      AND segments.date BETWEEN '${since}' AND '${until}'
  `;
  const res = await adsFetch(accessToken, `/customers/${cid}/googleAds:searchStream`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Ads insights failed: ${text.slice(0, 240)}`);
  }
  const rows: DailyInsight[] = [];
  const parsed = JSON.parse(text) as
    | { results?: Record<string, unknown>[] }[]
    | { results?: Record<string, unknown>[] };
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  for (const batch of batches) {
    for (const row of batch.results ?? []) {
      const segments = (row.segments ?? {}) as { date?: string };
      const metrics = (row.metrics ?? {}) as {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        conversions?: number;
        conversionsValue?: number;
      };
      const micros = Number(metrics.costMicros ?? 0);
      rows.push({
        date: segments.date ?? since,
        spendCents: Math.round(micros / 10_000),
        impressions: Number(metrics.impressions ?? 0),
        clicks: Number(metrics.clicks ?? 0),
        conversions: Math.round(Number(metrics.conversions ?? 0)),
        revenueCents: Math.round(Number(metrics.conversionsValue ?? 0) * 100),
      });
    }
  }
  return rows;
}

export function persistGoogleTokens(tokens: GoogleTokens) {
  return {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
  };
}

export function readGoogleAccess(encrypted: string): string {
  return decryptSecret(encrypted);
}

export function readGoogleRefresh(encrypted: string | null): string | null {
  return encrypted ? decryptSecret(encrypted) : null;
}
