import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { DailyRow, DerivedMetrics, PerformanceNote } from "@/lib/advertising/metrics";
import { hasActivity, performanceNotes } from "@/lib/advertising/metrics";

const noteSchema = z.object({
  observations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      tone: z.enum(["positive", "watch", "neutral"]),
    })
  ),
});

const SYSTEM = `You are a performance-marketing analyst. Write 3-5 short observations from the advertising metrics provided.

Rules:
- Use only the numbers given. Do not invent spend, conversions, revenue, audiences, creatives or platform errors.
- If a metric is zero or missing, say so — do not assume a cause.
- Do not recommend raising budget or publishing campaigns. You cannot see the ads or the landing page.
- Prefer comparisons that are in the data (platform mix, peak day, CPA vs spend).
- Each observation: a short title and one sentence of detail.`;

function contextBlock(
  totals: DerivedMetrics,
  platforms: Array<{ platform: string } & DerivedMetrics>,
  daily: DailyRow[]
): string {
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines = [
    `TOTALS: spend=${money(totals.spendCents)} impressions=${totals.impressions} clicks=${totals.clicks} conversions=${totals.conversions} revenue=${money(totals.revenueCents)} ctr=${totals.ctr ?? "n/a"} cpa=${totals.cpaCents != null ? money(totals.cpaCents) : "n/a"} roas=${totals.roas ?? "n/a"}`,
    "PLATFORMS:",
    ...platforms.map(
      (p) =>
        `- ${p.platform}: spend=${money(p.spendCents)} impr=${p.impressions} clicks=${p.clicks} conv=${p.conversions} revenue=${money(p.revenueCents)}`
    ),
    "DAILY (date spendCents conversions):",
    ...daily
      .filter((d) => d.spendCents > 0 || d.conversions > 0)
      .map((d) => `- ${d.date} ${d.spendCents} ${d.conversions}`),
  ];
  return lines.join("\n");
}

/**
 * AI observations grounded in real totals. Falls back to deterministic notes
 * if the model is unavailable or returns nothing.
 */
export async function analyzePerformance(
  totals: DerivedMetrics,
  platforms: Array<{ platform: string } & DerivedMetrics>,
  daily: DailyRow[]
): Promise<PerformanceNote[]> {
  const fallback = performanceNotes(totals, platforms, daily);
  if (!hasActivity(totals) || !process.env.OPENAI_API_KEY) return fallback;

  try {
    const client = new OpenAI();
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const res = await client.responses.parse({
      model,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: contextBlock(totals, platforms, daily) },
      ],
      text: { format: zodTextFormat(noteSchema, "performance_notes") },
    });
    const parsed = res.output_parsed?.observations ?? [];
    return parsed.length > 0 ? parsed.slice(0, 6) : fallback;
  } catch (err) {
    console.error("[analytics] AI analysis failed, using rule notes:", err);
    return fallback;
  }
}
