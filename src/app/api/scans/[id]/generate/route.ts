import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import type { ContentGap, SemanticMap, Understanding } from "@/lib/types";
import { polishGeneratedContent } from "@/lib/generated-content";

export const maxDuration = 120;

const PROMPTS: Record<string, string> = {
  faq: "Write 6–8 FAQ entries (question + concise 2–4 sentence answer) that this site should publish. Prioritize the focus topic if given, then the biggest content gaps. Write in the site's voice, factual and specific — no marketing fluff. Output as markdown with '### Q:' headings.",
  schema:
    "Produce JSON-LD structured data this site should add (Organization/LocalBusiness, Service, and FAQPage as applicable). Fill fields from what you know about the business; use UPPERCASE_PLACEHOLDERS where information is missing. Output each block in a ```json code fence with a one-line comment above it explaining where to place it.",
  "service-content":
    "Draft a service/landing page (500–800 words) for the focus topic. Structure: H1, intro that states what/who/where in the first two sentences, benefit sections with H2s, one FAQ section, and a call to action. Write clean markdown, concrete and specific to this business.",
  "comparison-page":
    "Draft a comparison page (categories, criteria table, honest pros/cons) positioning this business against typical alternatives for the focus topic. Fair and factual — AI assistants distrust one-sided pages. Output markdown with a comparison table.",
  brief: `Write a complete content brief for the focus topic. This is a static handoff document for a writer — not a chat. Do not ask questions, do not offer to do more work, and do not end with "If you want…" or similar.

Use real markdown only:
- Major sections: ## Section title (never write "H2:" as plain text)
- Page outline: start with one # Page title line, then ## and ### for sections (never "H1:" / "H2:" / "H3:" labels)
- Bullets: use "-" only

Required sections in this order:

## Target questions to answer

## Entities & topics to mention

## Recommended page outline

## Schema to include

## Internal links to add

## Why this helps AI visibility

Stop immediately after the last section. No closing paragraph offering extra help.`,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const kind = typeof body?.kind === "string" ? body.kind : "brief";
  const topic = typeof body?.topic === "string" ? body.topic.slice(0, 300) : "";
  const instruction = PROMPTS[kind] ?? PROMPTS.brief;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { site: true, analysis: true },
  });
  if (!scan || !scan.analysis) {
    return NextResponse.json(
      { error: "Scan analysis not found. Run a scan first." },
      { status: 404 }
    );
  }

  const understanding = scan.analysis.understanding as unknown as Understanding;
  const semanticMap = scan.analysis.semanticMap as unknown as SemanticMap;
  const gaps = (scan.analysis.contentGaps as unknown as ContentGap[]) ?? [];

  const context = [
    `WEBSITE: ${scan.site.url}`,
    `BUSINESS: ${understanding.businessSummary}`,
    `AUDIENCE: ${understanding.audience}`,
    `SERVICE AREA: ${understanding.serviceArea}`,
    `MAIN TOPIC: ${semanticMap.topic}`,
    `SUBTOPICS: ${semanticMap.subtopics.join(", ")}`,
    `DIFFERENTIATORS: ${understanding.differentiators.join("; ") || "(none listed)"}`,
    `TOP CONTENT GAPS:\n${gaps
      .slice(0, 8)
      .map((g) => `- ${g.question}`)
      .join("\n")}`,
    topic ? `FOCUS TOPIC: ${topic}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const response = await client.responses.create({
    model,
    instructions:
      "You are GEO Archer's content engine. You produce finished, publish-ready documents — not conversational replies. Never ask the user questions, never offer follow-up tasks, and never append 'If you want, I can also…' or similar. Be concrete and specific to the business context provided. Never invent facts like prices, credentials, or reviews — use UPPERCASE_PLACEHOLDERS for unknowns. Use valid markdown headings (# ## ###) instead of writing 'H1:' or 'H2:' as text.",
    input: `${context}\n\nTASK: ${instruction}`,
  });

  const raw = response.output_text ?? "";
  const content = polishGeneratedContent(raw, kind);

  return NextResponse.json({ content, kind });
}
