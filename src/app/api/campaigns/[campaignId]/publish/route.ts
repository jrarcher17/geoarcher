import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { publishCampaign } from "@/lib/advertising/publish";
import { startAdsMetricSync } from "@/lib/jobs/start";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  try {
    const campaign = await publishCampaign(access.userId, campaignId);
    await startAdsMetricSync(access.userId).catch(() => undefined);
    return NextResponse.json({
      campaign: {
        id: campaign.id,
        status: campaign.status,
        externalId: campaign.externalId,
        publishedAt: campaign.publishedAt?.toISOString() ?? null,
        error: campaign.error,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed." },
      { status: 502 }
    );
  }
}
