import { heartbeat } from "@temporalio/activity";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  generateOutreachEmail,
  generateProspectReport,
  type ProspectReport,
} from "@/lib/leads/ai";
import { buildOutreachDraft } from "@/lib/leads/outreach-copy";
import {
  analyzeProspectSite,
  type ProspectAnalysis,
  type ProspectProblem,
} from "@/lib/leads/analyze";
import { needsGeoHelp } from "@/lib/leads/qualify";
import { apolloConfigured, revealContact, searchCompanies } from "@/lib/leads/apollo";
import {
  countSentTodayForUser,
  dailySendCap,
  followUpDays,
  isSuppressed,
  resendConfigured,
  sendViaResend,
} from "@/lib/leads/email";
import { leadGenMonthlyQuota } from "@/lib/plans";
import { appBaseUrl } from "@/lib/stripe";
import {
  UNREACHABLE_PREFIX,
  isUnreachableError,
  isWebsiteReachable,
  unreachableErrorMessage,
} from "@/lib/leads/site-live";

/**
 * Activities for the AI Lead Generation Machine campaign workflow.
 * Ordering of spend: Apollo search is free, crawling is cheap, and the paid
 * steps (Apollo email reveal, OpenAI report/outreach) only run for prospects
 * that scored above the qualification threshold.
 */

function safeHeartbeat(details?: string): void {
  try {
    heartbeat(details);
  } catch {
    // Called from Next.js fallback, not a Temporal activity.
  }
}

async function withHeartbeat<T>(work: Promise<T>): Promise<T> {
  const timer = setInterval(() => safeHeartbeat(), 15_000);
  try {
    return await work;
  } finally {
    clearInterval(timer);
  }
}

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---- Access + campaign bookkeeping ----

export interface LeadGenAccessCheck {
  ok: boolean;
  reason: string | null;
  mode: "APPROVE_FIRST" | "AUTO_SEND";
}

/** Pro Plus gate re-checked every phase so lapsed subscriptions stop spending. */
export async function checkLeadGenAccess(
  campaignId: string
): Promise<LeadGenAccessCheck> {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true, mode: true, user: { select: { plan: true } } },
  });
  if (!campaign) {
    return { ok: false, reason: "Campaign was deleted.", mode: "APPROVE_FIRST" };
  }
  if (campaign.status === "CANCELLED") {
    return { ok: false, reason: "Campaign was cancelled.", mode: campaign.mode };
  }
  if (campaign.user.plan !== "PRO_PLUS") {
    return {
      ok: false,
      reason: "Campaign stopped: the account is no longer on Pro Plus.",
      mode: campaign.mode,
    };
  }
  return { ok: true, reason: null, mode: campaign.mode };
}

export async function markCampaignStatus(
  campaignId: string,
  status: "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED",
  error?: string | null
): Promise<void> {
  await prisma.leadCampaign
    .update({
      where: { id: campaignId },
      data: { status, error: error ?? null },
    })
    .catch(() => undefined); // campaign may have been deleted
}

// ---- Stage: find companies (Apollo search — free) ----

export interface FindCompaniesResult {
  created: number;
  quotaRemaining: number;
  detail: string;
  exhausted: boolean;
}

function searchVariants(
  industry: string,
  location: string | null
): Array<{ location: string | null; keywords?: string }> {
  const variants: Array<{ location: string | null; keywords?: string }> = [
    { location },
  ];
  if (location) {
    const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      variants.push({ location: parts.slice(1).join(", ") });
      variants.push({ location: parts[parts.length - 1] });
    }
    variants.push({ location: null, keywords: `${industry} ${location}` });
  }
  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = `${v.location ?? ""}|${v.keywords ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findCompanies(
  campaignId: string
): Promise<FindCompaniesResult> {
  const campaign = await prisma.leadCampaign.findUniqueOrThrow({
    where: { id: campaignId },
  });
  if (!apolloConfigured()) {
    throw new Error("APOLLO_API_KEY is not configured on the worker.");
  }

  const quota = leadGenMonthlyQuota();
  const usedThisMonth = await prisma.prospect.count({
    where: {
      createdAt: { gte: startOfUtcMonth() },
      campaign: { userId: campaign.userId },
      status: {
        in: ["QUALIFIED", "CONTACTED", "REPLIED", "BOUNCED", "CLOSED"],
      },
      NOT: { error: { startsWith: UNREACHABLE_PREFIX } },
    },
  });
  const existingInCampaign = await countLiveProspects(campaignId);
  const target = Math.min(
    campaign.targetCount - existingInCampaign,
    quota - usedThisMonth
  );
  if (target <= 0) {
    return {
      created: 0,
      quotaRemaining: Math.max(0, quota - usedThisMonth),
      exhausted: campaign.targetCount - existingInCampaign <= 0,
      detail:
        campaign.targetCount - existingInCampaign <= 0
          ? "Campaign target already reached."
          : `Monthly prospect quota reached (${usedThisMonth}/${quota}).`,
    };
  }

  // Never email the same company twice across a user's campaigns.
  const knownDomains = new Set(
    (
      await prisma.prospect.findMany({
        where: { campaign: { userId: campaign.userId } },
        select: { domain: true },
      })
    ).map((p) => p.domain)
  );

  let created = 0;
  const variants = searchVariants(campaign.industry, campaign.location);
  for (const variant of variants) {
    if (created >= target) break;
    let page = 1;
    let totalPages = 1;
    while (created < target && page <= totalPages && page <= 40) {
      safeHeartbeat(`apollo ${variant.location ?? variant.keywords ?? "all"} p${page}`);
      const result = await searchCompanies({
        industry: campaign.industry,
        location: variant.location,
        keywords: variant.keywords,
        employeeMin: campaign.employeeMin,
        employeeMax: campaign.employeeMax,
        page,
        perPage: 50,
      });
      totalPages = result.totalPages;

      for (const company of result.companies) {
        if (created >= target) break;
        if (knownDomains.has(company.domain)) continue;
        knownDomains.add(company.domain);
        const siteUrl = company.websiteUrl || `https://${company.domain}`;
        const live = await isWebsiteReachable(siteUrl, company.domain);
        if (!live) {
          await prisma.prospect.create({
            data: {
              campaignId,
              companyName: company.name,
              domain: company.domain,
              apolloOrgId: company.apolloOrgId,
              status: "CLOSED",
              error: unreachableErrorMessage(),
              analysis: { siteUrl } as unknown as Prisma.InputJsonValue,
            },
          });
          continue;
        }
        await prisma.prospect.create({
          data: {
            campaignId,
            companyName: company.name,
            domain: company.domain,
            apolloOrgId: company.apolloOrgId,
            analysis: { siteUrl } as unknown as Prisma.InputJsonValue,
          },
        });
        created += 1;
      }
      page += 1;
    }
  }

  const liveAfter = await countLiveProspects(campaignId);
  if (created === 0 && liveAfter === 0) {
    const where = campaign.location
      ? `“${campaign.industry}” in ${campaign.location}`
      : `“${campaign.industry}”`;
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        error: `No companies found for ${where}. Try a broader industry or location.`,
      },
    });
  } else if (campaign.error) {
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: { error: null },
    });
  }

  const exhausted = liveAfter < campaign.targetCount && created === 0;
  return {
    created,
    quotaRemaining: Math.max(0, quota - usedThisMonth - created),
    exhausted,
    detail: `Found ${created} new companies (target ${target}).`,
  };
}

export async function listPendingProspects(
  campaignId: string,
  limit: number
): Promise<string[]> {
  const rows = await prisma.prospect.findMany({
    where: { campaignId, status: "FOUND" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ---- Stage: analyze + score (own crawler — no credits, no AI) ----

/** Live sites we keep toward the campaign target. Down domains do not count. */
export const LIVE_PROSPECT_STATUSES = [
  "FOUND",
  "ANALYZING",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONTACTED",
  "REPLIED",
  "BOUNCED",
] as const;

/** Flip DISQUALIFIED rows whose GEO is actually below the healthy bar (e.g. 59 F). */
export async function reclassifyUnhealthySkips(
  campaignId: string
): Promise<string[]> {
  const rows = await prisma.prospect.findMany({
    where: { campaignId, status: "DISQUALIFIED" },
    select: { id: true, score: true, analysis: true },
  });
  const flipped: string[] = [];
  for (const row of rows) {
    const stored = (row.analysis as { geoScore?: number } | null)?.geoScore;
    const geoScore =
      typeof stored === "number"
        ? stored
        : row.score != null
          ? 100 - row.score
          : null;
    if (geoScore == null || !needsGeoHelp(geoScore)) continue;
    await prisma.prospect.update({
      where: { id: row.id },
      data: { status: "QUALIFIED" },
    });
    flipped.push(row.id);
  }
  return flipped;
}

export async function countLiveProspects(campaignId: string): Promise<number> {
  return prisma.prospect.count({
    where: {
      campaignId,
      status: { in: [...LIVE_PROSPECT_STATUSES] },
    },
  });
}

/** QUALIFIED rows that never got a draft (Apollo people search failed, etc.). */
export async function prepareMissingOutreach(campaignId: string): Promise<number> {
  const rows = await prisma.prospect.findMany({
    where: {
      campaignId,
      status: "QUALIFIED",
      emails: { none: { followUpIndex: 0 } },
    },
    select: { id: true },
    take: 5,
  });
  let n = 0;
  for (const row of rows) {
    const outcome = await prepareOutreach(row.id);
    if (outcome === "ready") n += 1;
  }
  return n;
}

export type AnalyzeOutcome =
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "FAILED"
  | "UNREACHABLE";

export async function analyzeProspect(
  prospectId: string
): Promise<AnalyzeOutcome> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  });
  const analysis = prospect.analysis as { siteUrl?: string } | null;
  const siteUrl = analysis?.siteUrl ?? `https://${prospect.domain}`;

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "ANALYZING" },
  });

  try {
    const result = await withHeartbeat(analyzeProspectSite(siteUrl));
    const qualified = needsGeoHelp(result.analysis.geoScore);
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: qualified ? "QUALIFIED" : "DISQUALIFIED",
        score: result.score,
        scoreBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        problems: result.problems as unknown as Prisma.InputJsonValue,
        analysis: result.analysis as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
    return qualified ? "QUALIFIED" : "DISQUALIFIED";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isUnreachableError(message)) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: "CLOSED",
          error: unreachableErrorMessage(),
        },
      });
      return "UNREACHABLE";
    }
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
    return "FAILED";
  }
}

// ---- Stage: reveal contact + AI report + outreach draft (paid, qualified only) ----

export type PrepareOutcome = "ready" | "no-contact" | "suppressed" | "skipped";

export async function prepareOutreach(
  prospectId: string
): Promise<PrepareOutcome> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: {
      campaign: { include: { user: { select: { name: true, email: true } } } },
      emails: { where: { followUpIndex: 0 }, take: 1 },
    },
  });
  if (prospect.status !== "QUALIFIED") return "skipped";
  if (prospect.contactEmail && prospect.report && prospect.emails.length > 0) {
    return "ready";
  }

  const analysis = prospect.analysis as unknown as ProspectAnalysis;
  const problems = (prospect.problems ?? []) as unknown as ProspectProblem[];

  // 1 export credit — the only Apollo spend, and only for qualified prospects.
  // If this API key cannot search people, use a public email from the crawl.
  const siteEmail = analysis.contactEmails?.find((e) => e.includes("@"));
  const contact = prospect.contactEmail
    ? {
        name: prospect.contactName ?? "there",
        title: prospect.contactTitle,
        email: prospect.contactEmail,
      }
    : prospect.apolloOrgId
      ? await withHeartbeat(revealContact(prospect.apolloOrgId))
      : null;
  const resolved =
    contact ??
    (siteEmail
      ? { name: "there", title: null, email: siteEmail }
      : null);
  if (!resolved) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: "CLOSED",
        error:
          "No contact email found (Apollo people search unavailable or no public email on the site).",
      },
    });
    return "no-contact";
  }
  if (await isSuppressed(resolved.email)) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "CLOSED", error: "Contact email is on the suppression list." },
    });
    return "suppressed";
  }

  let report = prospect.report as ProspectReport | null;
  if (!report) {
    try {
      report = await withHeartbeat(
        generateProspectReport({
          companyName: prospect.companyName,
          analysis,
          problems,
        })
      );
    } catch (err) {
      console.error("[leads] report generation failed, using a simple draft:", err);
    }
  }
  const reportUrl = `${appBaseUrl()}/r/${prospect.reportToken}`;
  const draft = buildOutreachDraft({
    companyName: prospect.companyName,
    domain: prospect.domain,
    siteUrl: analysis?.siteUrl,
    senderName: prospect.campaign.user.name,
    pagesCrawled: analysis?.pagesCrawled,
    problems,
    reportUrl,
    followUpIndex: 0,
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      contactName: resolved.name,
      contactTitle: resolved.title,
      contactEmail: resolved.email,
      ...(report
        ? { report: report as unknown as Prisma.InputJsonValue }
        : {}),
      emails: prospect.emails.length
        ? undefined
        : {
            create: {
              subject: draft.subject,
              body: draft.body,
              status: "DRAFT",
              followUpIndex: 0,
            },
          },
    },
  });
  return "ready";
}

// ---- Stage: send (Resend, guarded by suppression + daily cap) ----

export type SendOutcome = "sent" | "capped" | "skipped";

async function deliver(input: {
  emailId: string;
  to: string;
  subject: string;
  body: string;
  replyTo: string;
  senderName: string;
  prospectId: string;
}): Promise<void> {
  const resendId = await sendViaResend({
    to: input.to,
    subject: input.subject,
    body: input.body,
    replyTo: input.replyTo,
    senderName: input.senderName,
  });
  await prisma.outreachEmail.update({
    where: { id: input.emailId },
    data: { status: "SENT", resendId, sentAt: new Date(), error: null },
  });
  await prisma.prospect.update({
    where: { id: input.prospectId },
    data: { status: "CONTACTED" },
  });
}

/** Send the initial outreach draft for one prospect (AUTO_SEND mode or approval). */
export async function sendOutreach(prospectId: string): Promise<SendOutcome> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: {
      campaign: { include: { user: { select: { name: true, email: true } } } },
      emails: { where: { followUpIndex: 0 }, take: 1 },
    },
  });
  const email = prospect.emails[0];
  if (
    !email ||
    !prospect.contactEmail ||
    !["DRAFT", "QUEUED"].includes(email.status) ||
    !["QUALIFIED", "CONTACTED"].includes(prospect.status)
  ) {
    return "skipped";
  }
  if (!resendConfigured()) {
    throw new Error("Resend is not configured (RESEND_API_KEY, LEADGEN_FROM_EMAIL).");
  }
  if (await isSuppressed(prospect.contactEmail)) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "CLOSED", error: "Contact email is on the suppression list." },
    });
    return "skipped";
  }

  const sentToday = await countSentTodayForUser(prospect.campaign.userId);
  if (sentToday >= dailySendCap()) {
    // Deliverability guardrail — queue it; the daily follow-up pass drains the queue.
    await prisma.outreachEmail.update({
      where: { id: email.id },
      data: { status: "QUEUED" },
    });
    return "capped";
  }

  await deliver({
    emailId: email.id,
    to: prospect.contactEmail,
    subject: email.subject,
    body: email.body,
    replyTo: prospect.campaign.user.email,
    senderName: prospect.campaign.user.name,
    prospectId,
  });
  return "sent";
}

// ---- Stage: daily pass — drain queued sends, send follow-ups, close out ----

export interface FollowUpPassResult {
  pending: number;
  sentQueued: number;
  sentFollowUps: number;
  closed: number;
}

export async function processFollowUps(
  campaignId: string
): Promise<FollowUpPassResult> {
  const campaign = await prisma.leadCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { user: { select: { name: true, email: true } } },
  });

  let budget = Math.max(
    0,
    dailySendCap() - (await countSentTodayForUser(campaign.userId))
  );
  let sentQueued = 0;
  let sentFollowUps = 0;
  let closed = 0;

  // 1. Drain initial emails that were queued by the daily cap (AUTO_SEND only —
  //    approve-first drafts wait for the user).
  if (campaign.mode === "AUTO_SEND" && budget > 0) {
    const queued = await prisma.outreachEmail.findMany({
      where: {
        status: "QUEUED",
        followUpIndex: 0,
        prospect: { campaignId, status: { in: ["QUALIFIED", "CONTACTED"] } },
      },
      include: { prospect: true },
      take: budget,
    });
    for (const email of queued) {
      safeHeartbeat("queued sends");
      if (!email.prospect.contactEmail) continue;
      if (await isSuppressed(email.prospect.contactEmail)) continue;
      try {
        await deliver({
          emailId: email.id,
          to: email.prospect.contactEmail,
          subject: email.subject,
          body: email.body,
          replyTo: campaign.user.email,
          senderName: campaign.user.name,
          prospectId: email.prospectId,
        });
        budget -= 1;
        sentQueued += 1;
      } catch (err) {
        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: { error: String(err).slice(0, 300) },
        });
      }
      if (budget <= 0) break;
    }
  }

  // 2. Follow-ups: contacted prospects whose last email is old enough and got
  //    no reply/bounce. Max 2 follow-ups, then close the prospect out.
  const dueBefore = new Date(Date.now() - followUpDays() * 24 * 60 * 60 * 1000);
  const contacted = await prisma.prospect.findMany({
    where: { campaignId, status: "CONTACTED" },
    include: { emails: { orderBy: { followUpIndex: "desc" } } },
  });

  for (const prospect of contacted) {
    safeHeartbeat("follow-ups");
    const last = prospect.emails.find((e) => e.sentAt);
    if (!last?.sentAt || last.sentAt > dueBefore) continue;
    if (last.status === "REPLIED" || last.status === "BOUNCED") continue;

    if (last.followUpIndex >= 2) {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { status: "CLOSED", error: null },
      });
      closed += 1;
      continue;
    }
    if (budget <= 0) continue;
    if (!prospect.contactEmail || (await isSuppressed(prospect.contactEmail))) {
      continue;
    }

    try {
      const report = prospect.report as unknown as ProspectReport;
      const draft = await withHeartbeat(
        generateOutreachEmail({
          companyName: prospect.companyName,
          contactName: prospect.contactName ?? "there",
          senderName: campaign.user.name,
          analysis: prospect.analysis as unknown as ProspectAnalysis,
          problems: (prospect.problems ?? []) as unknown as ProspectProblem[],
          report,
          reportUrl: `${appBaseUrl()}/r/${prospect.reportToken}`,
          followUpIndex: last.followUpIndex + 1,
        })
      );
      const email = await prisma.outreachEmail.create({
        data: {
          prospectId: prospect.id,
          subject: draft.subject,
          body: draft.body,
          status: "QUEUED",
          followUpIndex: last.followUpIndex + 1,
        },
      });
      await deliver({
        emailId: email.id,
        to: prospect.contactEmail,
        subject: draft.subject,
        body: draft.body,
        replyTo: campaign.user.email,
        senderName: campaign.user.name,
        prospectId: prospect.id,
      });
      budget -= 1;
      sentFollowUps += 1;
    } catch (err) {
      console.warn(`[leadgen] follow-up failed for ${prospect.id}:`, err);
    }
  }

  // Prospects still needing action keep the campaign's daily pass alive.
  const pending = await prisma.prospect.count({
    where: {
      campaignId,
      OR: [
        { status: "CONTACTED" },
        {
          status: "QUALIFIED",
          emails: {
            some: {
              followUpIndex: 0,
              status: { in: ["DRAFT", "QUEUED"] },
            },
          },
        },
      ],
    },
  });

  return { pending, sentQueued, sentFollowUps, closed };
}
