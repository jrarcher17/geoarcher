import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { loadAssistantContext } from "@/lib/advertising/context";
import { refreshRecommendations } from "@/lib/advertising/recommend";

export async function POST() {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const ctx = await loadAssistantContext(access.userId);
  const recommendations = await refreshRecommendations(access.userId, ctx);
  return NextResponse.json({
    recommendations: recommendations.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      detail: r.detail,
      campaignId: r.campaignId,
      payload: r.payload,
    })),
  });
}
