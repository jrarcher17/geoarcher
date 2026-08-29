import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import {
  anyIntelligenceProviderReady,
  defaultSearchCountries,
  listIntelligenceProviders,
  searchIntelligenceAds,
} from "@/lib/advertising/intelligence-providers";
import {
  persistLibraryAds,
  toApiAd,
} from "@/lib/advertising/intelligence-providers/persist";
import type { OfferingDetails } from "@/lib/advertising/types";

type ContextKind = "offering" | "competitor" | null;

/**
 * Stored official-library ads + optional live search.
 * Never invents ads. Search only runs when search=1, a provider is ready,
 * and a product or competitor is selected.
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const offeringId = url.searchParams.get("offering") ?? "";
  const competitorId = url.searchParams.get("competitor") ?? "";
  const shouldSearch = url.searchParams.get("search") === "1";

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: { siteId: true },
  });
  const siteIds = links.map((l) => l.siteId);

  let context: {
    kind: ContextKind;
    name: string | null;
    category: string | null;
    companyName: string | null;
    siteId: string | null;
    offeringId: string | null;
    competitorId: string | null;
    searchTerms: string[];
  } = {
    kind: null,
    name: null,
    category: null,
    companyName: null,
    siteId: null,
    offeringId: null,
    competitorId: null,
    searchTerms: [],
  };

  if (offeringId) {
    const offering = await prisma.offering.findFirst({
      where: { id: offeringId, siteId: { in: siteIds } },
      include: {
        site: { select: { id: true, intelligence: { select: { business: true } } } },
      },
    });
    if (!offering) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const details = (offering.details ?? {}) as unknown as OfferingDetails;
    const business = offering.site.intelligence?.business as
      | { companyName?: string }
      | null;
    context = {
      kind: "offering",
      name: offering.name,
      category: details.category ?? null,
      companyName: business?.companyName ?? null,
      siteId: offering.site.id,
      offeringId: offering.id,
      competitorId: null,
      searchTerms: [offering.name, details.category].filter(
        (s): s is string => Boolean(s)
      ),
    };
  } else if (competitorId) {
    const competitor = await prisma.adCompetitor.findFirst({
      where: { id: competitorId, siteId: { in: siteIds }, dismissed: false },
      include: {
        site: { select: { id: true, intelligence: { select: { business: true } } } },
      },
    });
    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
    }
    const details = (competitor.details ?? {}) as {
      searchTerms?: string[];
    };
    const business = competitor.site.intelligence?.business as
      | { companyName?: string }
      | null;
    context = {
      kind: "competitor",
      name: competitor.name,
      category: competitor.category,
      companyName: business?.companyName ?? null,
      siteId: competitor.site.id,
      offeringId: competitor.offeringId,
      competitorId: competitor.id,
      searchTerms: [
        competitor.name,
        competitor.category,
        ...(details.searchTerms ?? []).slice(0, 3),
      ].filter((s): s is string => Boolean(s)),
    };
  }

  const providers = listIntelligenceProviders();
  const ready = anyIntelligenceProviderReady();
  const countries = defaultSearchCountries();

  let searched = false;
  let searchError: string | null = null;

  if (shouldSearch && ready && context.siteId && context.searchTerms.length > 0) {
    const { results, ads } = await searchIntelligenceAds({
      searchTerms: context.searchTerms.slice(0, 3),
      advertiserName: context.kind === "competitor" ? context.name : null,
      countries,
      limit: 25,
    });
    searched = true;
    const contextType = context.kind === "competitor" ? "COMPETITOR" : "OFFERING";
    const contextId = context.competitorId ?? context.offeringId ?? context.siteId;
    await persistLibraryAds({
      siteId: context.siteId,
      contextType,
      contextId,
      offeringId: context.offeringId,
      competitorId: context.competitorId,
      ads,
      searchTerms: context.searchTerms,
      countries,
      providerResults: results.map((r) => ({
        providerId: r.provider.id,
        resultCount: r.result.ads.length,
        error: r.result.status === "error" ? r.result.reason : undefined,
      })),
    });
    const failed = results.find((r) => r.result.status === "error");
    if (failed?.result.reason) searchError = failed.result.reason;
  }

  const storedWhere =
    context.kind === "offering" && context.offeringId
      ? { siteId: { in: siteIds }, contextType: "OFFERING" as const, contextId: context.offeringId }
      : context.kind === "competitor" && context.competitorId
        ? {
            siteId: { in: siteIds },
            contextType: "COMPETITOR" as const,
            contextId: context.competitorId,
          }
        : { siteId: { in: siteIds } };

  const [stored, lastSearch, totalStored, analyzedCount] = await Promise.all([
    prisma.libraryAd.findMany({
      where: storedWhere,
      orderBy: { fetchedAt: "desc" },
      take: 60,
    }),
    context.siteId && (context.offeringId || context.competitorId)
      ? prisma.librarySearch.findFirst({
          where: {
            siteId: context.siteId,
            contextType: context.kind === "competitor" ? "COMPETITOR" : "OFFERING",
            contextId: context.competitorId ?? context.offeringId ?? "",
          },
          orderBy: { createdAt: "desc" },
        })
      : prisma.librarySearch.findFirst({
          where: { siteId: { in: siteIds } },
          orderBy: { createdAt: "desc" },
        }),
    prisma.libraryAd.count({ where: { siteId: { in: siteIds } } }),
    prisma.libraryAd.count({
      where: { ...storedWhere, analyzedAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    context,
    providers,
    ready,
    countries,
    searched,
    searchError,
    lastSearch: lastSearch
      ? {
          at: lastSearch.createdAt.toISOString(),
          terms: lastSearch.terms,
          resultCount: lastSearch.resultCount,
          error: lastSearch.error,
          provider: lastSearch.provider,
        }
      : null,
    ads: stored.map(toApiAd),
    storedCount: totalStored,
    analyzedCount,
  });
}
