import { prisma } from "@/lib/db";
import { startScanPipeline } from "@/lib/jobs/start";
import {
  assessAdvertisingOpportunity,
  type IntelligenceFacts,
  type SiteCheckFacts,
} from "@/lib/leads/ad-opportunity";
import {
  assertCanAddSite,
  assertCanStartScan,
  getPlanForUser,
} from "@/lib/user-plan";

export function normalizeProspectUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function urlCandidatesForDomain(domain: string): string[] {
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!host.includes(".")) return [];
  return [
    `https://${host}`,
    `https://www.${host}`,
    `http://${host}`,
    `http://www.${host}`,
  ];
}

export async function findLinkedSiteForDomain(userId: string, domain: string) {
  const urls = urlCandidatesForDomain(domain);
  if (urls.length === 0) return null;
  return prisma.userSite.findFirst({
    where: { userId, site: { url: { in: urls } } },
    include: {
      site: {
        include: {
          intelligence: true,
          offerings: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, kind: true },
          },
          siteImages: { select: { id: true } },
          adOpportunities: {
            where: { dismissed: false },
            orderBy: [{ level: "asc" }, { createdAt: "asc" }],
            include: { offering: { select: { id: true, name: true } } },
          },
          scans: {
            where: { benchmarkScanId: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
        },
      },
    },
  });
}

export interface ProspectAdvertisingPayload {
  opportunity: ReturnType<typeof assessAdvertisingOpportunity>;
  site: {
    id: string;
    url: string;
    scanStatus: string | null;
    intelligenceStatus: string | null;
  } | null;
  offerings: { id: string; name: string; kind: string }[];
  opportunities: {
    id: string;
    title: string;
    level: string;
    offeringId: string | null;
    offeringName: string | null;
    channels: unknown;
  }[];
  campaigns: {
    id: string;
    name: string;
    platform: string;
    status: string;
  }[];
}

export async function loadProspectAdvertising(
  userId: string,
  prospect: { id: string; domain: string; analysis: unknown }
): Promise<ProspectAdvertisingPayload> {
  const link = await findLinkedSiteForDomain(userId, prospect.domain);
  const site = link?.site ?? null;

  const channels = (site?.adOpportunities ?? []).flatMap((o) =>
    Array.isArray(o.channels) ? (o.channels as string[]) : []
  );
  const intelligence: IntelligenceFacts | null = site
    ? {
        offeringCount: site.offerings.length,
        imageCount: site.siteImages.length,
        highOpportunityCount: site.adOpportunities.filter(
          (o) => o.level === "HIGH"
        ).length,
        mediumOpportunityCount: site.adOpportunities.filter(
          (o) => o.level === "MEDIUM"
        ).length,
        channels,
      }
    : null;

  const campaigns = await prisma.adCampaign.findMany({
    where: { userId, prospectId: prospect.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, platform: true, status: true },
  });

  return {
    opportunity: assessAdvertisingOpportunity(
      prospect.analysis as SiteCheckFacts | null,
      intelligence
    ),
    site: site
      ? {
          id: site.id,
          url: site.url,
          scanStatus: site.scans[0]?.status ?? null,
          intelligenceStatus: site.intelligence?.status ?? null,
        }
      : null,
    offerings: site?.offerings ?? [],
    opportunities: (site?.adOpportunities ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      level: o.level,
      offeringId: o.offeringId,
      offeringName: o.offering?.name ?? null,
      channels: o.channels,
    })),
    campaigns,
  };
}

export async function importProspectAsSite(
  userId: string,
  domain: string
): Promise<{
  siteId: string;
  scanId: string | null;
  startedScan: boolean;
  scanStatus: string | null;
  intelligenceStatus: string | null;
}> {
  const siteUrl = normalizeProspectUrl(domain);
  if (!siteUrl) {
    throw new Error("This prospect does not have a valid website URL.");
  }

  const site = await prisma.site.upsert({
    where: { url: siteUrl },
    update: {},
    create: { url: siteUrl },
  });

  const existingLink = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId, siteId: site.id } },
  });
  if (!existingLink) {
    const limitError = await assertCanAddSite(userId);
    if (limitError) throw new Error(limitError);
    await prisma.userSite.create({
      data: { userId, siteId: site.id },
    });
  }

  const latestScan = await prisma.scan.findFirst({
    where: { siteId: site.id, benchmarkScanId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, pagesCrawled: true },
  });
  const completed = await prisma.scan.findFirst({
    where: { siteId: site.id, status: "COMPLETE", benchmarkScanId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let scanId = latestScan?.id ?? null;
  let startedScan = false;
  const scanRunning = ["QUEUED", "CRAWLING", "ANALYZING"].includes(
    latestScan?.status ?? ""
  );

  if (!completed && !scanRunning) {
    const scanLimitError = await assertCanStartScan(userId);
    if (scanLimitError) throw new Error(scanLimitError);
    const scan = await prisma.scan.create({ data: { siteId: site.id } });
    scanId = scan.id;
    startedScan = true;
    const plan = await getPlanForUser(userId);
    await startScanPipeline({
      scanId: scan.id,
      siteId: site.id,
      withSeoAudit: plan !== "free",
    });
  }

  const intelligence = await prisma.siteIntelligence.findUnique({
    where: { siteId: site.id },
    select: { status: true },
  });

  return {
    siteId: site.id,
    scanId,
    startedScan,
    scanStatus: startedScan ? "QUEUED" : (latestScan?.status ?? null),
    intelligenceStatus: intelligence?.status ?? null,
  };
}
