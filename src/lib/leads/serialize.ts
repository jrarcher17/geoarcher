import type {
  LeadCampaign,
  OutreachEmail,
  Prospect,
} from "@/generated/prisma/client";

export function serializeCampaign(
  campaign: LeadCampaign & { _count?: { prospects: number } }
) {
  return {
    id: campaign.id,
    name: campaign.name,
    industry: campaign.industry,
    location: campaign.location,
    employeeMin: campaign.employeeMin,
    employeeMax: campaign.employeeMax,
    targetCount: campaign.targetCount,
    mode: campaign.mode,
    status: campaign.status,
    error: campaign.error,
    prospectCount: campaign._count?.prospects ?? undefined,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export function serializeEmail(email: OutreachEmail) {
  return {
    id: email.id,
    subject: email.subject,
    body: email.body,
    status: email.status,
    followUpIndex: email.followUpIndex,
    error: email.error,
    createdAt: email.createdAt.toISOString(),
    sentAt: email.sentAt?.toISOString() ?? null,
    deliveredAt: email.deliveredAt?.toISOString() ?? null,
    openedAt: email.openedAt?.toISOString() ?? null,
    bouncedAt: email.bouncedAt?.toISOString() ?? null,
    repliedAt: email.repliedAt?.toISOString() ?? null,
  };
}

export function serializeProspect(
  prospect: Prospect & { emails?: OutreachEmail[] }
) {
  return {
    id: prospect.id,
    campaignId: prospect.campaignId,
    companyName: prospect.companyName,
    domain: prospect.domain,
    status: prospect.status,
    score: prospect.score,
    scoreBreakdown: prospect.scoreBreakdown,
    problems: prospect.problems,
    analysis: prospect.analysis,
    contactName: prospect.contactName,
    contactTitle: prospect.contactTitle,
    contactEmail: prospect.contactEmail,
    report: prospect.report,
    reportToken: prospect.reportToken,
    error: prospect.error,
    createdAt: prospect.createdAt.toISOString(),
    updatedAt: prospect.updatedAt.toISOString(),
    emails: prospect.emails?.map(serializeEmail),
  };
}
