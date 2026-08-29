import { prisma } from "@/lib/db";
import { sendInternalEmail } from "@/lib/leads/email";
import { appBaseUrl } from "@/lib/stripe";

async function siteOwner(siteId: string) {
  return prisma.userSite.findFirst({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { email: true, name: true } } },
  });
}

export async function notifyScanComplete(scanId: string): Promise<void> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      status: true,
      error: true,
      site: { select: { id: true, url: true } },
    },
  });
  if (!scan) return;
  const owner = await siteOwner(scan.site.id);
  if (!owner?.user.email) return;
  const ok = scan.status === "COMPLETE";
  const base = appBaseUrl().replace(/\/$/, "");
  await sendInternalEmail({
    to: owner.user.email,
    subject: ok
      ? `Scan finished for ${scan.site.url}`
      : `Scan failed for ${scan.site.url}`,
    body: [
      ok
        ? `The scan for ${scan.site.url} is done.`
        : `The scan for ${scan.site.url} failed${scan.error ? `: ${scan.error}` : "."}`,
      "",
      `Open it: ${base}/sites/${scan.site.id}/intelligence`,
    ].join("\n"),
  });
}

export async function notifyCampaignComplete(campaignId: string): Promise<void> {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      status: true,
      error: true,
      targetCount: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!campaign?.user.email) return;
  if (campaign.status === "RUNNING" || campaign.status === "PAUSED") return;
  const base = appBaseUrl().replace(/\/$/, "");
  await sendInternalEmail({
    to: campaign.user.email,
    subject:
      campaign.status === "COMPLETE"
        ? `Lead campaign finished: ${campaign.name}`
        : `Lead campaign ${campaign.status.toLowerCase()}: ${campaign.name}`,
    body: [
      `“${campaign.name}” is ${campaign.status.toLowerCase()}.`,
      campaign.error ?? "",
      "",
      `Open it: ${base}/leads/${campaignId}`,
    ]
      .filter((line, i) => i < 2 || line.length > 0)
      .join("\n"),
  });
}

export async function notifyAutopilotCycle(siteId: string, ok: boolean): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { url: true },
  });
  if (!site) return;
  const owner = await siteOwner(siteId);
  if (!owner?.user.email) return;
  const base = appBaseUrl().replace(/\/$/, "");
  await sendInternalEmail({
    to: owner.user.email,
    subject: ok
      ? `Autopilot cycle finished for ${site.url}`
      : `Autopilot cycle failed for ${site.url}`,
    body: [
      ok
        ? `SEO Autopilot finished a cycle for ${site.url}.`
        : `SEO Autopilot hit an error on ${site.url}. Check the Autopilot card for details.`,
      "",
      `Open the site: ${base}/sites/${siteId}`,
    ].join("\n"),
  });
}
