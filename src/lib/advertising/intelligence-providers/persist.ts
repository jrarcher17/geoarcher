import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { parseAnalysis } from "@/lib/advertising/library-analysis";
import type { DiscoveredAd, LibraryAdAnalysis } from "./types";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

export type LibraryContextType = "SITE" | "OFFERING" | "COMPETITOR";

function parseStamp(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDbPlatform(platform: DiscoveredAd["platform"]): "META" | "GOOGLE" {
  return platform === "google" ? "GOOGLE" : "META";
}

export type StoredLibraryAd = DiscoveredAd & {
  id: string;
  analysis: LibraryAdAnalysis | null;
  analyzedAt: string | null;
  analyzable: boolean;
};

export function toApiAd(row: {
  id: string;
  provider: string;
  platform: string;
  externalId: string;
  advertiserName: string | null;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  landingPage: string | null;
  creativeUrl: string | null;
  format: string | null;
  firstSeen: Date | null;
  lastSeen: Date | null;
  sourceUrl: string | null;
  publisherPlatforms: unknown;
  analysis?: unknown;
  analyzedAt?: Date | null;
}): StoredLibraryAd {
  return {
    id: row.id,
    providerId: row.provider,
    platform: row.platform === "GOOGLE" ? "google" : "meta",
    externalId: row.externalId,
    advertiserName: row.advertiserName,
    headline: row.headline,
    primaryText: row.primaryText,
    cta: row.cta,
    landingPage: row.landingPage,
    creativeUrl: row.creativeUrl,
    format: row.format,
    firstSeen: row.firstSeen?.toISOString() ?? null,
    lastSeen: row.lastSeen?.toISOString() ?? null,
    sourceUrl: row.sourceUrl,
    publisherPlatforms: Array.isArray(row.publisherPlatforms)
      ? row.publisherPlatforms.map(String)
      : [],
    analysis: parseAnalysis(row.analysis),
    analyzedAt: row.analyzedAt?.toISOString() ?? null,
    analyzable: Boolean(row.headline?.trim() || row.primaryText?.trim()),
  };
}

/** Upsert official-library ads. Skips rows without an external id. */
export async function persistLibraryAds(input: {
  siteId: string;
  contextType: LibraryContextType;
  contextId: string;
  offeringId: string | null;
  competitorId: string | null;
  ads: DiscoveredAd[];
  searchTerms: string[];
  countries: string[];
  providerResults: { providerId: string; resultCount: number; error?: string }[];
}): Promise<number> {
  const terms = input.searchTerms.join(" ").slice(0, 300);
  let saved = 0;

  for (const ad of input.ads) {
    if (!ad.externalId) continue;
    await prisma.libraryAd.upsert({
      where: {
        siteId_provider_externalId_contextType_contextId: {
          siteId: input.siteId,
          provider: ad.providerId,
          externalId: ad.externalId,
          contextType: input.contextType,
          contextId: input.contextId,
        },
      },
      create: {
        siteId: input.siteId,
        offeringId: input.offeringId,
        competitorId: input.competitorId,
        contextType: input.contextType,
        contextId: input.contextId,
        provider: ad.providerId,
        platform: toDbPlatform(ad.platform),
        externalId: ad.externalId,
        advertiserName: ad.advertiserName,
        headline: ad.headline,
        primaryText: ad.primaryText,
        cta: ad.cta,
        landingPage: ad.landingPage,
        creativeUrl: ad.creativeUrl,
        format: ad.format,
        firstSeen: parseStamp(ad.firstSeen),
        lastSeen: parseStamp(ad.lastSeen),
        sourceUrl: ad.sourceUrl,
        publisherPlatforms: asJson(ad.publisherPlatforms),
        searchTerms: terms,
        countries: asJson(input.countries),
      },
      update: {
        offeringId: input.offeringId,
        competitorId: input.competitorId,
        advertiserName: ad.advertiserName,
        headline: ad.headline,
        primaryText: ad.primaryText,
        cta: ad.cta,
        landingPage: ad.landingPage,
        creativeUrl: ad.creativeUrl,
        format: ad.format,
        firstSeen: parseStamp(ad.firstSeen),
        lastSeen: parseStamp(ad.lastSeen),
        sourceUrl: ad.sourceUrl,
        publisherPlatforms: asJson(ad.publisherPlatforms),
        searchTerms: terms,
        countries: asJson(input.countries),
        fetchedAt: new Date(),
      },
    });
    saved += 1;
  }

  for (const row of input.providerResults) {
    await prisma.librarySearch.create({
      data: {
        siteId: input.siteId,
        contextType: input.contextType,
        contextId: input.contextId,
        provider: row.providerId,
        terms,
        countries: asJson(input.countries),
        resultCount: row.resultCount,
        error: row.error ?? null,
      },
    });
  }

  return saved;
}
