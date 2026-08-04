import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildSiteDigest } from "./analysis";
import { prisma } from "./db";
import type {
  PageExtraction,
  Recommendation,
  SimulationResults,
} from "./types";
import type { Prisma } from "@/generated/prisma/client";

const promptsSchema = z.object({
  prompts: z.array(
    z.object({
      prompt: z.string(),
      category: z.string(),
    })
  ),
});

const evaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      prompt: z.string(),
      beforeLikelihood: z.number(),
      beforeReasoning: z.string(),
      afterLikelihood: z.number(),
      afterReasoning: z.string(),
      keyChanges: z.array(z.string()),
    })
  ),
});

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function simulateAnswers(
  siteUrl: string,
  pages: PageExtraction[],
  recommendations: Recommendation[]
): Promise<SimulationResults> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable answer simulation."
    );
  }
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const digest = buildSiteDigest(siteUrl, pages);

  // Step 1: generate realistic user prompts for this business's niche.
  const promptsRes = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content:
          "Generate exactly 8 realistic prompts that real users would type into an AI assistant (ChatGPT, Claude, Gemini, Perplexity) where this business could plausibly be recommended or cited as a source. Ground every prompt in the site's actual services, products, and location — never invent services it doesn't offer. Cover a mix of categories: direct recommendation ('best X in Y' / 'who should I hire for X'), cost ('what does X cost'), comparison ('X vs Y'), process/how-to, and problem-driven ('my X broke, what do I do'). Write prompts the way real users type them: casual, specific, sometimes with location.",
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(promptsSchema, "user_prompts") },
  });
  const prompts = promptsRes.output_parsed?.prompts ?? [];
  if (prompts.length === 0) {
    throw new Error("Prompt generation returned no prompts.");
  }

  // Step 2: evaluate citation likelihood before/after recommendations.
  const recsText = recommendations
    .map((r, i) => `${i + 1}. [${r.impact} impact] ${r.title} — ${r.how}`)
    .join("\n");
  const promptsText = prompts
    .map((p, i) => `${i + 1}. (${p.category}) ${p.prompt}`)
    .join("\n");

  const evalRes = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: `You simulate whether an AI assistant would cite or recommend this specific business when answering each user prompt. This is GeoArcher's scoring model — an honest simulation, not a guarantee of real AI behavior.

For each prompt, produce:
- beforeLikelihood (0-100): assuming the assistant can see this site's CURRENT content (the digest) alongside typical competitors, how likely is it to cite or recommend this business in its answer? Judge strictly on whether the site's content actually answers the prompt with specific, quotable information. Thin or missing content = low score.
- beforeReasoning: 1-2 sentences naming what content helps or is missing.
- afterLikelihood (0-100): the same judgment assuming the site has implemented the PLANNED RECOMMENDATIONS listed below. Only raise the score where a recommendation genuinely addresses why the before score was low. If no recommendation is relevant to a prompt, afterLikelihood must equal beforeLikelihood.
- afterReasoning: 1-2 sentences.
- keyChanges: which specific recommendations (by title) drive the improvement, empty if none.

Be conservative. Return one evaluation per prompt, same order, copying the prompt text exactly.`,
      },
      {
        role: "user",
        content: `${digest}\n\n=== PLANNED RECOMMENDATIONS ===\n${recsText}\n\n=== USER PROMPTS TO EVALUATE ===\n${promptsText}`,
      },
    ],
    text: { format: zodTextFormat(evaluationSchema, "citation_evaluations") },
  });
  const evaluations = evalRes.output_parsed?.evaluations ?? [];
  if (evaluations.length === 0) {
    throw new Error("Evaluation returned no results.");
  }

  const results: SimulationResults["prompts"] = evaluations.map((e, i) => ({
    prompt: e.prompt,
    category: prompts[i]?.category ?? "general",
    before: { likelihood: clamp(e.beforeLikelihood), reasoning: e.beforeReasoning },
    after: {
      likelihood: clamp(Math.max(e.afterLikelihood, e.beforeLikelihood)),
      reasoning: e.afterReasoning,
      keyChanges: e.keyChanges,
    },
  }));

  const avg = (ns: number[]) =>
    clamp(ns.reduce((a, b) => a + b, 0) / Math.max(ns.length, 1));

  return {
    prompts: results,
    overallBefore: avg(results.map((r) => r.before.likelihood)),
    overallAfter: avg(results.map((r) => r.after.likelihood)),
  };
}

export async function runSimulation(scanId: string): Promise<void> {
  try {
    const scan = await prisma.scan.findUniqueOrThrow({
      where: { id: scanId },
      include: { site: true, analysis: true, pages: true },
    });
    if (scan.status !== "COMPLETE" || !scan.analysis) {
      throw new Error("Scan must be complete before running a simulation.");
    }

    const pages = scan.pages.map((p) => p.extracted as unknown as PageExtraction);
    const recommendations = scan.analysis
      .recommendations as unknown as Recommendation[];

    const results = await simulateAnswers(scan.site.url, pages, recommendations);

    await prisma.simulation.update({
      where: { scanId },
      data: {
        status: "COMPLETE",
        results: results as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[simulation ${scanId}] failed:`, err);
    await prisma.simulation.update({
      where: { scanId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
  }
}
