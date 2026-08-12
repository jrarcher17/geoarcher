"use client";

import { useState } from "react";
import { Check, Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GeneratedContentView } from "@/components/cards/GeneratedContentView";
import { downloadGeneratedDocPdf } from "@/lib/generated-doc-pdf";

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

  async function generate() {
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

  function run() {
    setOpen(true);
    if (output || loading) return;
    void generate();
  }

  function regenerate() {
    setOutput(null);
    void generate();
  }

  async function copy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadPdf() {
    if (!output) return;
    downloadGeneratedDocPdf({
      markdown: output,
      docTitle: GENERATE_LABELS[kind].replace(/^Generate /, ""),
      subtitle: topic ?? "Drafted from this scan's analysis",
    });
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
          className={kind === "schema" ? undefined : "max-w-3xl"}
        >
          {loading && (
            <div className="flex flex-col items-center gap-4 py-14">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                <Sparkles className="h-5 w-5 text-sky-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  Drafting with AI…
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Usually takes 10–20 seconds
                </p>
              </div>
            </div>
          )}
          {error && <p className="py-4 text-sm text-red-600">{error}</p>}
          {output && !loading && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  {kind === "schema"
                    ? "Copy to paste into your CMS or editor."
                    : "Download a branded PDF, or Copy the source text for your CMS or doc."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={regenerate}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                  <Button variant="secondary" size="sm" onClick={copy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  {kind !== "schema" && (
                    <Button variant="primary" size="sm" onClick={downloadPdf}>
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </Button>
                  )}
                </div>
              </div>
              <GeneratedContentView content={output} kind={kind} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
