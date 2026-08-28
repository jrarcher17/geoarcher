import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AssistantContext } from "@/lib/advertising/context";
import { queueAction } from "@/lib/advertising/execute-action";
import { isActionType } from "@/lib/advertising/recommend";

const SYSTEM = `You are GEO Archer's advertising assistant. Answer using ONLY the provided advertising context.

Rules:
- Do not invent spend, conversions, campaigns, prices or connections. If a number is missing, say it is not available.
- Draft and Ready campaigns have not spent money. Do not talk about their CPA or ROAS as if they were live.
- You may propose actions, but you cannot execute them. The user must approve each one.
- Only propose actions that match a real campaign id from the context.
- Do not propose publish_campaign unless that platform is connected.
- Do not propose pause_campaign unless the campaign is ACTIVE.
- Do not propose raising budget unless there are conversions in the totals. Prefer questions over guesses.
- If the user asks to create ads, tell them to use Ad Studio and name the offering. Do not pretend you published anything.
- Keep the reply to a short paragraph plus bullets if needed.`;

const proposalSchema = z.object({
  action: z.enum([
    "pause_campaign",
    "resume_campaign",
    "change_budget",
    "mark_ready",
    "publish_campaign",
  ]),
  campaignId: z.string(),
  budgetDailyCents: z.number().int().positive().optional(),
  title: z.string(),
  detail: z.string(),
});

const replySchema = z.object({
  reply: z.string(),
  proposals: z.array(proposalSchema),
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function fallbackReply(ctx: AssistantContext, question: string): string {
  const q = question.toLowerCase();
  if (ctx.campaigns.length === 0) {
    return "You don’t have any campaigns yet. Open Ad Studio, pick a product or service from your website, and I’ll have something to work with.";
  }
  if (q.includes("doing") || q.includes("performance") || q.includes("ads")) {
    const live = ctx.campaigns.filter((c) => c.metrics.spendCents > 0);
    if (live.length === 0) {
      const ready = ctx.campaigns.filter((c) => c.status === "READY").length;
      return `No campaign has recorded spend yet. You have ${ctx.campaigns.length} campaign${ctx.campaigns.length === 1 ? "" : "s"} (${ready} Ready). Connect an ad account and publish to see performance.`;
    }
  }
  const names = ctx.campaigns
    .slice(0, 4)
    .map((c) => `${c.name} (${c.platform}, ${c.status})`)
    .join("; ");
  return `I can see ${ctx.campaigns.length} campaign${ctx.campaigns.length === 1 ? "" : "s"}: ${names}. Ask about a specific campaign, or tell me what you want to change — I’ll queue it for your approval.`;
}

export async function runAssistantTurn(
  userId: string,
  ctx: AssistantContext,
  messages: ChatMessage[]
) {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const fallback = fallbackReply(ctx, question);

  if (!process.env.OPENAI_API_KEY) {
    return { reply: fallback, actions: [] as Awaited<ReturnType<typeof queueAction>>[] };
  }

  try {
    const client = new OpenAI();
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const res = await client.responses.parse({
      model,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: ctx.prompt },
        ...history,
      ],
      text: { format: zodTextFormat(replySchema, "assistant_reply") },
    });
    const parsed = res.output_parsed;
    if (!parsed) return { reply: fallback, actions: [] };

    const actions = [];
    for (const proposal of parsed.proposals) {
      if (!isActionType(proposal.action)) continue;
      const campaign = ctx.campaigns.find((c) => c.id === proposal.campaignId);
      if (!campaign) continue;
      if (proposal.action === "publish_campaign") {
        const connected =
          (campaign.platform === "GOOGLE" && ctx.connections.google) ||
          (campaign.platform === "META" && ctx.connections.meta);
        if (!connected) continue;
      }
      if (proposal.action === "pause_campaign" && campaign.status !== "ACTIVE") continue;
      if (proposal.action === "resume_campaign" && campaign.status !== "PAUSED") continue;
      if (proposal.action === "mark_ready" && campaign.status !== "DRAFT") continue;
      const queued = await queueAction(
        userId,
        {
          action: proposal.action,
          campaignId: campaign.id,
          budgetDailyCents: proposal.budgetDailyCents,
        },
        {
          title: proposal.title,
          detail: proposal.detail,
          platform: campaign.platform,
        }
      );
      actions.push(queued);
    }

    return { reply: parsed.reply || fallback, actions };
  } catch (err) {
    console.error("[assistant] chat failed:", err);
    return { reply: fallback, actions: [] };
  }
}
