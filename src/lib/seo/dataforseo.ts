/**
 * DataForSEO SERP API client — live Google organic results.
 * Auth: Basic (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).
 * Each keyword check is a paid API call, so callers batch and throttle.
 */

const API_BASE = "https://api.dataforseo.com/v3";
const SERP_DEPTH = 100;

export function dataForSeoConfigured(): boolean {
  return Boolean(
    process.env["DATAFORSEO_LOGIN"]?.trim() &&
      process.env["DATAFORSEO_PASSWORD"]?.trim()
  );
}

function authHeader(): string {
  const login = process.env["DATAFORSEO_LOGIN"] ?? "";
  const password = process.env["DATAFORSEO_PASSWORD"] ?? "";
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export interface SerpResultItem {
  position: number;
  url: string;
  domain: string;
  title: string;
}

export interface KeywordRankResult {
  keyword: string;
  /** 1-based organic position of the target domain, null if not in top 100. */
  position: number | null;
  /** URL of the target domain's ranking page, if found. */
  url: string | null;
  /** Top organic results for context (competitor intelligence). */
  topResults: SerpResultItem[];
  error: string | null;
}

interface DataForSeoTask {
  status_code: number;
  status_message: string;
  data?: { keyword?: string };
  result?: {
    keyword: string;
    items?: {
      type: string;
      rank_group?: number;
      url?: string;
      domain?: string;
      title?: string;
    }[];
  }[];
}

function normalizeDomain(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Check live Google rankings for a batch of keywords against a target domain.
 * One HTTP request per batch; DataForSEO bills per task (keyword).
 */
export async function checkKeywordRankings(
  keywords: { keyword: string; locationCode: number; languageCode: string }[],
  targetDomain: string
): Promise<KeywordRankResult[]> {
  if (!dataForSeoConfigured()) {
    throw new Error(
      "DataForSEO is not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD."
    );
  }
  if (keywords.length === 0) return [];

  const target = normalizeDomain(targetDomain);

  const res = await fetch(`${API_BASE}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      keywords.map((k) => ({
        keyword: k.keyword,
        location_code: k.locationCode,
        language_code: k.languageCode,
        depth: SERP_DEPTH,
      }))
    ),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DataForSEO request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    status_code: number;
    status_message: string;
    tasks?: DataForSeoTask[];
  };
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }

  const byKeyword = new Map<string, KeywordRankResult>();

  for (const task of json.tasks ?? []) {
    const keyword =
      task.result?.[0]?.keyword ?? task.data?.keyword ?? "";
    if (!keyword) continue;

    if (task.status_code !== 20000) {
      byKeyword.set(keyword.toLowerCase(), {
        keyword,
        position: null,
        url: null,
        topResults: [],
        error: task.status_message,
      });
      continue;
    }

    const organic = (task.result?.[0]?.items ?? []).filter(
      (i) => i.type === "organic" && typeof i.rank_group === "number" && i.url
    );

    let position: number | null = null;
    let url: string | null = null;
    for (const item of organic) {
      if (item.domain && normalizeDomain(item.domain) === target) {
        position = item.rank_group ?? null;
        url = item.url ?? null;
        break;
      }
    }

    byKeyword.set(keyword.toLowerCase(), {
      keyword,
      position,
      url,
      topResults: organic.slice(0, 3).map((i) => ({
        position: i.rank_group ?? 0,
        url: i.url ?? "",
        domain: i.domain ?? "",
        title: i.title ?? "",
      })),
      error: null,
    });
  }

  // Preserve caller order; surface missing tasks as errors instead of dropping.
  return keywords.map(
    (k) =>
      byKeyword.get(k.keyword.toLowerCase()) ?? {
        keyword: k.keyword,
        position: null,
        url: null,
        topResults: [],
        error: "No result returned for this keyword.",
      }
  );
}
