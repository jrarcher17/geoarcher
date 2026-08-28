import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { runAssistantTurn, type ChatMessage } from "@/lib/advertising/assistant";
import { loadAssistantContext } from "@/lib/advertising/context";
import { refreshRecommendations } from "@/lib/advertising/recommend";

function serializeAction(row: {
  id: string;
  action: string;
  campaignId: string | null;
  platform: string | null;
  status: string;
  previousValue: unknown;
  newValue: unknown;
  error: string | null;
  createdAt: Date;
}) {
  const prev = (row.previousValue ?? {}) as { title?: string };
  const next = (row.newValue ?? {}) as { detail?: string; budgetDailyCents?: number };
  return {
    id: row.id,
    action: row.action,
    campaignId: row.campaignId,
    platform: row.platform,
    status: row.status,
    title: prev.title ?? row.action.replaceAll("_", " "),
    detail: next.detail ?? null,
    budgetDailyCents: next.budgetDailyCents ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const [pending, history, recommendations] = await Promise.all([
    prisma.aIAction.findMany({
      where: { userId: access.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.aIAction.findMany({
      where: { userId: access.userId, status: { in: ["EXECUTED", "REJECTED", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.aIRecommendation.findMany({
      where: { userId: access.userId, status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  let recs = recommendations;
  if (recs.length === 0) {
    const ctx = await loadAssistantContext(access.userId);
    recs = await refreshRecommendations(access.userId, ctx);
  }

  return NextResponse.json({
    pending: pending.map(serializeAction),
    history: history.map(serializeAction),
    recommendations: recs.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      detail: r.detail,
      campaignId: r.campaignId,
      payload: r.payload,
    })),
  });
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter(
      (m: unknown) =>
        m &&
        typeof m === "object" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string"
    )
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.trim() }))
    .filter((m: ChatMessage) => m.content.length > 0)
    .slice(-8);

  if (messages.length === 0) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const ctx = await loadAssistantContext(access.userId);
  const result = await runAssistantTurn(access.userId, ctx, messages);

  return NextResponse.json({
    reply: result.reply,
    pending: result.actions.map(serializeAction),
  });
}
