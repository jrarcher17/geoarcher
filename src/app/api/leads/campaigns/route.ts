import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getQuotaState, requireLeadGenAccess } from "@/lib/leads/api-guard";
import { apolloConfigured } from "@/lib/leads/apollo";
import { resendConfigured } from "@/lib/leads/email";
import { serializeCampaign } from "@/lib/leads/serialize";
import { startLeadGenCampaign } from "@/lib/temporal-start";
import { temporalConfigured } from "@/temporal/client";

export const dynamic = "force-dynamic";

const FUNNEL_STATUSES = [
  "FOUND",
  "ANALYZING",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONTACTED",
  "REPLIED",
  "BOUNCED",
  "CLOSED",
  "FAILED",
] as const;

export async function GET() {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const [campaigns, quota, grouped] = await Promise.all([
    prisma.leadCampaign.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { prospects: true } } },
    }),
    getQuotaState(access.userId),
    prisma.prospect.groupBy({
      by: ["status"],
      where: { campaign: { userId: access.userId } },
      _count: { _all: true },
    }),
  ]);

  const funnel = Object.fromEntries(
    FUNNEL_STATUSES.map((status) => [status, 0])
  ) as Record<(typeof FUNNEL_STATUSES)[number], number>;
  for (const row of grouped) {
    funnel[row.status] = row._count._all;
  }

  return NextResponse.json({
    campaigns: campaigns.map(serializeCampaign),
    quota,
    funnel,
    configured: {
      temporal: temporalConfigured(),
      apollo: apolloConfigured(),
      resend: resendConfigured(),
    },
  });
}

export async function POST(request: Request) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  if (!temporalConfigured()) {
    return NextResponse.json(
      {
        error:
          "The Lead Generation Machine needs the Temporal worker running. Start `temporal server start-dev` and `pnpm worker`.",
      },
      { status: 503 }
    );
  }
  if (!apolloConfigured()) {
    return NextResponse.json(
      { error: "APOLLO_API_KEY is not configured on this server." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const industry =
    typeof body?.industry === "string" ? body.industry.trim() : "";
  if (industry.length < 2 || industry.length > 80) {
    return NextResponse.json(
      { error: "Industry must be between 2 and 80 characters." },
      { status: 400 }
    );
  }

  const location =
    typeof body?.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 80)
      : null;
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 80)
      : location
        ? `${industry} in ${location}`
        : industry;

  const targetRaw = Number(body?.targetCount);
  const targetCount = Number.isFinite(targetRaw)
    ? Math.floor(targetRaw)
    : 0;
  if (targetCount < 1 || targetCount > 500) {
    return NextResponse.json(
      { error: "Target count must be between 1 and 500." },
      { status: 400 }
    );
  }

  const quota = await getQuotaState(access.userId);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `Monthly prospect quota reached (${quota.used}/${quota.limit}).`,
      },
      { status: 403 }
    );
  }

  const cappedTarget = Math.min(targetCount, quota.remaining);
  const mode = body?.mode === "AUTO_SEND" ? "AUTO_SEND" : "APPROVE_FIRST";
  if (mode === "AUTO_SEND" && !resendConfigured()) {
    return NextResponse.json(
      {
        error:
          "Auto-send needs Resend configured (RESEND_API_KEY, LEADGEN_FROM_EMAIL).",
      },
      { status: 503 }
    );
  }

  const employeeMin =
    typeof body?.employeeMin === "number" && body.employeeMin > 0
      ? Math.floor(body.employeeMin)
      : null;
  const employeeMax =
    typeof body?.employeeMax === "number" && body.employeeMax > 0
      ? Math.floor(body.employeeMax)
      : null;

  const campaign = await prisma.leadCampaign.create({
    data: {
      userId: access.userId,
      name,
      industry,
      location,
      employeeMin,
      employeeMax,
      targetCount: cappedTarget,
      mode,
    },
  });

  try {
    await startLeadGenCampaign(campaign.id);
    await prisma.leadCampaign.update({
      where: { id: campaign.id },
      data: { workflowId: `leadgen-campaign-${campaign.id}` },
    });
  } catch (err) {
    await prisma.leadCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Could not start workflow.",
      },
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not start the campaign workflow.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(serializeCampaign(campaign), { status: 201 });
}
