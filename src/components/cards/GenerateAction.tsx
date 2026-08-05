"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type GenerateKind =
  | "faq"
  | "schema"
  | "service-content"
  | "comparison-page"
  | "brief";

export const GENERATE_LABELS: Record<GenerateKind, string> = {
  faq: "Generate FAQ",
  schema: "Generate Schema",
  "service-content": "Generate Service Content",
  "comparison-page": "Generate Comparison Page",
  brief: "Generate Content Brief",
};

/** Pick the one-click action that matches a recommendation. */
export function kindForRecommendation(rec: {
  title: string;
  category: string;
}): GenerateKind {
  const t = `${rec.category} ${rec.title}`.toLowerCase();
  if (/\bfaq/.test(t)) return "faq";
  if (/schema|structured|json-ld|markup/.test(t)) return "schema";
  if (/compar|competitor|versus|vs\b/.test(t)) return "comparison-page";
  if (/service|content|page|copy|write/.test(t)) return "service-content";
  return "brief";
}

export function GenerateActionButton({
  scanId,
  kind,
  topic,
  size = "sm",
  variant = "secondary",
}: {
  scanId: string;
  kind: GenerateKind;
  /** Optional focus, e.g. the recommendation title or gap question. */
  topic?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setOpen(true);
    if (output || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setOutput(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={run}>
        <Sparkles className="h-3.5 w-3.5" />
        {GENERATE_LABELS[kind]}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={GENERATE_LABELS[kind]}
          description={topic ? `Focus: ${topic}` : "Drafted from this scan's analysis"}
        >
          {loading && (
            <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
              Drafting with AI — usually 10–20 seconds…
            </div>
          )}
          {error && <p className="py-4 text-sm text-red-600">{error}</p>}
          {output && (
            <div>
              <div className="mb-3 flex justify-end">
                <Button variant="secondary" size="sm" onClick={copy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
                {output}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
