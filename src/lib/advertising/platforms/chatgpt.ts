import { decryptSecret, encryptSecret } from "@/lib/advertising/crypto";
import type { DailyInsight } from "@/lib/advertising/platforms/google";

const ADS = "https://api.ads.openai.com/v1";

export interface ChatgptAdAccount {
  id: string;
  name: string;
  status: string | null;
  currencyCode: string | null;
}

export interface ChatgptPublishInput {
  name: string;
  budgetDailyCents: number;
  landingPage: string;
  headline: string;
  description: string;
  intents: string[];
  imageUrl: string | null;
  adGroupName: string;
}

interface AdsErrorBody {
  error?: { message?: string; type?: string } | string;
  message?: string;
}

function adsErrorMessage(json: AdsErrorBody, fallback: string): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error;
  if (json.error && typeof json.error === "object" && json.error.message) {
    return json.error.message;
  }
  if (typeof json.message === "string" && json.message.trim()) return json.message;
  return fallback;
}

async function adsRequest(
  apiKey: string,
  method: string,
  path: string,
  opts?: {
    body?: unknown;
    search?: Record<string, string | string[] | undefined>;
  }
): Promise<unknown> {
  const url = new URL(`${ADS}${path}`);
  for (const [key, value] of Object.entries(opts?.search ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as AdsErrorBody;
  if (!res.ok) {
    throw new Error(adsErrorMessage(json, `OpenAI Ads ${method} ${path} failed.`));
  }
  return json;
}

/** $1 = 100 cents = 1_000_000 micros. */
function centsToMicros(cents: number): number {
  return Math.max(Math.round(cents) * 10_000, 1_000_000);
}

export async function getChatgptAdAccount(
  apiKey: string
): Promise<ChatgptAdAccount> {
  const json = (await adsRequest(apiKey, "GET", "/ad_account")) as {
    id?: string;
    name?: string;
    status?: string;
    currency_code?: string;
  };
  if (!json.id) throw new Error("OpenAI Ads did not return an ad account.");
  return {
    id: json.id,
    name: json.name?.trim() || json.id,
    status: json.status ?? null,
    currencyCode: json.currency_code ?? null,
  };
}

export async function publishChatgptCampaign(
  apiKey: string,
  input: ChatgptPublishInput
): Promise<{ campaignId: string }> {
  const title = input.headline.trim() || input.name;
  const body = input.description.trim();
  if (!title || !body) {
    throw new Error("ChatGPT ads need a headline and description before publishing.");
  }

  let fileId: string | null = null;
  if (input.imageUrl) {
    try {
      const uploaded = (await adsRequest(apiKey, "POST", "/upload", {
        body: { image_url: input.imageUrl },
      })) as { file_id?: string };
      fileId = uploaded.file_id ?? null;
    } catch (err) {
      console.warn(
        "[chatgpt-ads] image upload skipped:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const lifetimeMicros = centsToMicros(input.budgetDailyCents * 30);
  const campaign = (await adsRequest(apiKey, "POST", "/campaigns", {
    body: {
      name: input.name.slice(0, 1000),
      status: "active",
      bidding_type: "clicks",
      budget: { lifetime_spend_limit_micros: lifetimeMicros },
    },
  })) as { id?: string };
  if (!campaign.id) throw new Error("OpenAI Ads did not return a campaign id.");

  const contextHints = input.intents
    .map((hint) => hint.trim())
    .filter(Boolean)
    .slice(0, 12);

  const adGroup = (await adsRequest(apiKey, "POST", "/ad_groups", {
    body: {
      campaign_id: campaign.id,
      name: (input.adGroupName || input.name).slice(0, 200),
      status: "active",
      ...(contextHints.length > 0 ? { context_hints: contextHints } : {}),
      bidding_config: {
        billing_event_type: "click",
        max_bid_micros: 1_000_000,
      },
    },
  })) as { id?: string };
  if (!adGroup.id) throw new Error("OpenAI Ads did not return an ad group id.");

  await adsRequest(apiKey, "POST", "/ads", {
    body: {
      ad_group_id: adGroup.id,
      name: input.name.slice(0, 200),
      status: "active",
      creative: {
        type: "chat_card",
        title: title.slice(0, 70),
        body: body.slice(0, 180),
        target_url: input.landingPage,
        ...(fileId ? { file_id: fileId } : {}),
      },
    },
  });

  return { campaignId: campaign.id };
}

export async function setChatgptCampaignStatus(
  apiKey: string,
  externalId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  await adsRequest(
    apiKey,
    "POST",
    `/campaigns/${externalId}/${status === "ACTIVE" ? "activate" : "pause"}`
  );
}

export async function fetchChatgptInsights(
  apiKey: string,
  externalId: string,
  since: string,
  until: string
): Promise<DailyInsight[]> {
  const rows: DailyInsight[] = [];
  let after: string | undefined;

  do {
    const json = (await adsRequest(
      apiKey,
      "GET",
      `/campaigns/${externalId}/insights`,
      {
        search: {
          time_granularity: "daily",
          limit: "90",
          "time_ranges[]": JSON.stringify({
            type: "date_range",
            since,
            until,
          }),
          after,
        },
      }
    )) as {
      data?: {
        readable_time?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
      }[];
      last_id?: string;
      has_more?: boolean;
    };

    for (const row of json.data ?? []) {
      const date = row.readable_time ?? since;
      rows.push({
        date,
        spendCents: Math.round(Number(row.spend ?? 0) * 100),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        conversions: 0,
        revenueCents: 0,
      });
    }

    after = json.has_more ? json.last_id : undefined;
  } while (after);

  return rows;
}

export function persistChatgptApiKey(apiKey: string): string {
  return encryptSecret(apiKey);
}

export function readChatgptApiKey(encrypted: string): string {
  return decryptSecret(encrypted);
}
