/**
 * Apollo.io API client for the AI Lead Generation Machine.
 *
 * Cost model (why this file has two very different functions):
 * - Organization Search is free — no export credits consumed.
 * - Revealing a contact email costs 1 export credit, so `revealContact` is
 *   only called for prospects that scored above the outreach threshold.
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export function apolloConfigured(): boolean {
  return Boolean(process.env["APOLLO_API_KEY"]?.trim());
}

function apiKey(): string {
  const key = process.env["APOLLO_API_KEY"]?.trim();
  if (!key) throw new Error("APOLLO_API_KEY is not configured.");
  return key;
}

async function apolloPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export interface ApolloCompany {
  apolloOrgId: string;
  name: string;
  domain: string;
  websiteUrl: string;
}

export interface CompanySearchParams {
  /** Industry keyword, e.g. "tanning salon", "plumber", "law firm" */
  industry: string;
  /** Free-text location, e.g. "Texas, US" or "Austin, Texas" */
  location?: string | null;
  employeeMin?: number | null;
  employeeMax?: number | null;
  page?: number;
  perPage?: number;
}

interface ApolloOrgSearchResponse {
  organizations?: Array<{
    id?: string;
    name?: string;
    website_url?: string | null;
    primary_domain?: string | null;
  }>;
  pagination?: { page?: number; total_pages?: number; total_entries?: number };
}

/** Free-tier search: find companies matching industry + location. No credits. */
export async function searchCompanies(
  params: CompanySearchParams
): Promise<{ companies: ApolloCompany[]; totalPages: number }> {
  const body: Record<string, unknown> = {
    q_organization_keyword_tags: [params.industry],
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 50, 100),
  };
  if (params.location?.trim()) {
    body.organization_locations = [params.location.trim()];
  }
  if (params.employeeMin != null || params.employeeMax != null) {
    const min = params.employeeMin ?? 1;
    const max = params.employeeMax ?? 10_000;
    body.organization_num_employees_ranges = [`${min},${max}`];
  }

  const data = await apolloPost<ApolloOrgSearchResponse>(
    "/mixed_companies/search",
    body
  );

  const companies: ApolloCompany[] = [];
  for (const org of data.organizations ?? []) {
    const websiteUrl = org.website_url?.trim();
    const domain = (org.primary_domain ?? "").trim().toLowerCase();
    if (!org.id || !domain) continue;
    companies.push({
      apolloOrgId: org.id,
      name: org.name?.trim() || domain,
      domain,
      websiteUrl: websiteUrl || `https://${domain}`,
    });
  }
  return { companies, totalPages: data.pagination?.total_pages ?? 1 };
}

/** Decision-maker titles for GEO/SEO outreach, in preference order. */
const CONTACT_TITLES = [
  "owner",
  "founder",
  "co-founder",
  "ceo",
  "president",
  "marketing director",
  "marketing manager",
  "head of marketing",
  "general manager",
];

export interface ApolloContact {
  name: string;
  title: string | null;
  email: string;
}

interface ApolloPeopleSearchResponse {
  people?: Array<{
    id?: string;
    name?: string;
    title?: string | null;
  }>;
}

interface ApolloPersonMatchResponse {
  person?: {
    name?: string;
    title?: string | null;
    email?: string | null;
  };
}

function isUsableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  if (email.includes("email_not_unlocked")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Find a decision-maker and reveal their email. Costs 1 export credit on
 * success — only call for qualified prospects.
 */
export async function revealContact(
  apolloOrgId: string
): Promise<ApolloContact | null> {
  const search = await apolloPost<ApolloPeopleSearchResponse>(
    "/mixed_people/search",
    {
      organization_ids: [apolloOrgId],
      person_titles: CONTACT_TITLES,
      page: 1,
      per_page: 5,
    }
  );

  const candidates = (search.people ?? []).filter((p) => p.id);
  for (const person of candidates.slice(0, 2)) {
    const match = await apolloPost<ApolloPersonMatchResponse>("/people/match", {
      id: person.id,
      reveal_personal_emails: false,
    });
    const email = match.person?.email;
    if (isUsableEmail(email)) {
      return {
        name: match.person?.name?.trim() || person.name?.trim() || "there",
        title: match.person?.title ?? person.title ?? null,
        email: email.toLowerCase(),
      };
    }
  }
  return null;
}
