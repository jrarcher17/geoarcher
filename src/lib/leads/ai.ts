import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ProspectAnalysis, ProspectProblem } from "./analyze";
import { buildOutreachDraft } from "./outreach-copy";

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

export interface ReportInterest {
  name?: string;
  email: string;
  at: string;
}

export interface ProspectReport {
  headline: string;
  summary: string;
  businessSummary: string;
  findings: {
    title: string;
    severity: "critical" | "warning" | "info";
    explanation: string;
    /** Present on older reports; never shown on the public page. */
    fix?: string;
  }[];
  /** Present on older reports; never shown on the public page. */
  quickWins?: string[];
  generatedAt: string;
  interest?: ReportInterest;
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
    })
  ),
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
        content: `You write short, credible advertising-opportunity reports for GEO Archer (an AI advertising platform). The reader is the business owner — a non-technical person seeing this report cold, from an outreach email. Tone: helpful expert, zero hype, no scare tactics.

This report is a teaser. It shows WHAT we found on their website that is worth advertising and WHY paid campaigns could help them get more customers. It must NOT invent products, traffic, spend, or results. It must NOT give a how-to media plan.

Rules:
- businessSummary: 1-2 sentences describing what THIS business does, from the site content provided. Specific, so the reader immediately sees the report is genuinely about them.
- headline: one plain-language sentence about the advertising opportunity (e.g. "Your website already names services that could run as Google and Meta campaigns").
- summary: 2-3 sentences on what was checked and what it means for advertising them. Do not prescribe budgets or claim performance.
- findings: rewrite each provided site-check note for a business owner in an advertising frame (landing page, offers, trust). Use ONLY the provided problems; never invent issues, traffic numbers, rankings, or ad results.`,
      },
      {
        role: "user",
        content: `COMPANY: ${input.companyName}
WEBSITE: ${input.analysis.siteUrl}
PAGES CHECKED: ${input.analysis.pagesCrawled}
SEO HEALTH (landing-page quality): ${input.analysis.seoScore}/100
GEO (AI VISIBILITY, supporting): ${input.analysis.geoScore}/100

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
  return buildOutreachDraft({
    companyName: input.companyName,
    domain: input.analysis.siteUrl,
    siteUrl: input.analysis.siteUrl,
    senderName: input.senderName,
    contactName: input.contactName,
    pagesCrawled: input.analysis.pagesCrawled,
    problems: input.problems,
    reportUrl: input.reportUrl,
    followUpIndex: input.followUpIndex,
  });
}
