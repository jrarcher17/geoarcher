import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildSiteDigest } from "./analysis";
import { prisma } from "./db";
import type { PageExtraction, VisibilityResults } from "./types";
import type { Prisma } from "@/generated/prisma/client";

export const ASSISTANT_NAMES = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Perplexity",
  "Copilot",
] as const;

const visibilitySchema = z.object({
  assistants: z.array(
    z.object({
      assistant: z.enum(ASSISTANT_NAMES),
      score: z.number(),
      reasoning: z.string(),
    })
  ),
});

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function scoreAssistantVisibility(
  siteUrl: string,
  pages: PageExtraction[]
): Promise<VisibilityResults> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to run AI visibility scoring."
    );
  }
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const digest = buildSiteDigest(siteUrl, pages);

  const res = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: `You are GeoArcher's AI Visibility scoring model. You do NOT have access to real ChatGPT, Claude, Gemini, Perplexity, or Copilot systems — you simulate how well EACH assistant would likely understand, trust, and surface this business when users ask relevant questions in this niche.

Score each assistant 0-100 exactly once: ${ASSISTANT_NAMES.join(", ")}.
Consider (vary scores slightly by assistant "persona" — e.g. Perplexity weights citations, Copilot weights structured facts, etc.):
- Can this site's content answer typical user questions in this space?
- Clarity of entity (who/what/where), trust signals, freshness, FAQ/schema readiness
- Depth vs thin marketing copy

Be conservative and grounded in the digest. One short reasoning sentence per assistant.`,
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(visibilitySchema, "assistant_visibility") },
  });

  const parsed = res.output_parsed?.assistants ?? [];
  if (parsed.length === 0) {
    throw new Error("Visibility scoring returned no results.");
  }

  const byName = new Map(parsed.map((a) => [a.assistant, a]));
  const assistants = ASSISTANT_NAMES.filter((n) => byName.has(n)).map((n) => {
    const a = byName.get(n)!;
    return {
      assistant: n,
      score: clamp(a.score),
      reasoning: a.reasoning,
    };
  });

  const overall = clamp(
    assistants.reduce((sum, a) => sum + a.score, 0) / Math.max(assistants.length, 1)
  );

  return { overall, assistants };
}

export async function runVisibilityReport(scanId: string): Promise<void> {
  try {
    const scan = await prisma.scan.findUniqueOrThrow({
      where: { id: scanId },
      include: { site: true, pages: true },
    });
    if (scan.status !== "COMPLETE") {
      throw new Error("Scan must be complete before scoring visibility.");
    }

    const pages = scan.pages.map((p) => p.extracted as unknown as PageExtraction);
    const results = await scoreAssistantVisibility(scan.site.url, pages);

    await prisma.visibilityReport.update({
      where: { scanId },
      data: {
        status: "COMPLETE",
        results: results as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[visibility ${scanId}] failed:`, err);
    await prisma.visibilityReport.update({
      where: { scanId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
  }
}
