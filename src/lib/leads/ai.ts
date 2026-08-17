import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ProspectAnalysis, ProspectProblem } from "./analyze";

/**
 * AI stages of the Lead Generation Machine — only run for QUALIFIED prospects
 * so AI spend scales with lead quality, not raw search volume.
 */

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI();
}

function model(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

export interface ProspectReport {
  headline: string;
  summary: string;
  businessSummary: string;
  findings: {
    title: string;
    severity: "critical" | "warning" | "info";
    explanation: string;
    fix: string;
  }[];
  quickWins: string[];
  generatedAt: string;
}

const reportSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  businessSummary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["critical", "warning", "info"]),
      explanation: z.string(),
      fix: z.string(),
    })
  ),
  quickWins: z.array(z.string()),
});

function problemsBlock(problems: ProspectProblem[]): string {
  return problems
    .map((p) => `- [${p.severity}] ${p.title}: ${p.detail}`)
    .join("\n");
}

/** Personalized GEO/SEO report the prospect receives via a public share link. */
export async function generateProspectReport(input: {
  companyName: string;
  analysis: ProspectAnalysis;
  problems: ProspectProblem[];
}): Promise<ProspectReport> {
  const client = getClient();
  const res = await client.responses.parse({
    model: model(),
    input: [
      {
        role: "system",
        content: `You write short, credible website audit reports for GEO Archer (a GEO/SEO platform). The reader is the business owner — a non-technical person seeing this report cold, from an outreach email. Tone: helpful expert, zero hype, no scare tactics.

Rules:
- businessSummary: 1-2 sentences describing what THIS business does, from the site content provided. Specific, so the reader immediately sees the report is genuinely about them.
- headline: one plain-language sentence naming their biggest visibility problem (e.g. "AI assistants like ChatGPT can't confidently describe or recommend your business").
- summary: 2-3 sentences on what was checked and what it means for them.
- findings: rewrite each provided problem for a business owner — explanation says why it costs them customers, fix says concretely what to do. Use ONLY the provided problems; never invent issues, traffic numbers, or rankings.
- quickWins: 3-5 actions they could do this week, ordered by impact.`,
      },
      {
        role: "user",
        content: `COMPANY: ${input.companyName}
WEBSITE: ${input.analysis.siteUrl}
PAGES CHECKED: ${input.analysis.pagesCrawled}
SEO HEALTH SCORE: ${input.analysis.seoScore}/100
GEO (AI VISIBILITY) SCORE: ${input.analysis.geoScore}/100

PROBLEMS FOUND:
${problemsBlock(input.problems)}

SITE CONTENT DIGEST:
${input.analysis.digest}`,
      },
    ],
    text: { format: zodTextFormat(reportSchema, "prospect_report") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Report generation returned no output.");
  return { ...parsed, generatedAt: new Date().toISOString() };
}

export interface OutreachDraft {
  subject: string;
  body: string;
}

const outreachSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

/** Personalized cold outreach referencing the prospect's specific problems. */
export async function generateOutreachEmail(input: {
  companyName: string;
  contactName: string;
  senderName: string;
  analysis: ProspectAnalysis;
  problems: ProspectProblem[];
  report: ProspectReport;
  reportUrl: string;
  followUpIndex: number;
}): Promise<OutreachDraft> {
  const client = getClient();

  const followUpNote =
    input.followUpIndex === 0
      ? "This is the FIRST email — introduce the finding and link the report."
      : `This is FOLLOW-UP #${input.followUpIndex} — they haven't replied. Be shorter than the first email, reference that you wrote before, add ONE new specific detail from the findings, and make it easy to say no ("if this isn't a priority, no worries").`;

  const res = await client.responses.parse({
    model: model(),
    input: [
      {
        role: "system",
        content: `You write cold outreach emails for GEO Archer users offering GEO/SEO help to local businesses. The emails must feel like a knowledgeable human wrote them after actually looking at the site — because we did.

Hard rules:
- 90-140 words max. Short paragraphs. No bullet lists in the first email.
- Open with a SPECIFIC observation about THEIR site from the findings (not "I noticed your website could use some work").
- Mention exactly one or two concrete problems in plain language, then link the free personalized report: ${input.reportUrl}
- One clear, low-pressure call to action (reply, or read the report).
- No hype words (skyrocket, unlock, revolutionary), no fake urgency, no "Hope this finds you well".
- Sign off with the sender's name only — the platform appends the footer.
- subject: under 8 words, specific and honest (e.g. "ChatGPT can't find ${input.companyName}").
- ${followUpNote}`,
      },
      {
        role: "user",
        content: `TO: ${input.contactName} at ${input.companyName}
FROM (sender name): ${input.senderName}
WEBSITE: ${input.analysis.siteUrl}
REPORT HEADLINE: ${input.report.headline}
BUSINESS: ${input.report.businessSummary}

TOP PROBLEMS:
${problemsBlock(input.problems.slice(0, 4))}`,
      },
    ],
    text: { format: zodTextFormat(outreachSchema, "outreach_email") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Outreach generation returned no output.");
  return parsed;
}
