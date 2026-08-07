import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Tone } from "@/lib/utils";

function pageHealth(page: {
  wordCount: number;
  statusCode: number | null;
  title: string | null;
}): { label: string; tone: Tone } {
  if (page.statusCode != null && page.statusCode >= 400)
    return { label: `Error ${page.statusCode}`, tone: "critical" };
  if (!page.title) return { label: "Missing title", tone: "critical" };
  if (page.wordCount < 150) return { label: "Thin content", tone: "warning" };
  if (page.wordCount < 400) return { label: "Light content", tone: "warning" };
  return { label: "Healthy", tone: "positive" };
}

/** One crawled page: health at a glance. */
export function PageHealthCard({
  page,
}: {
  page: {
    url: string;
    title: string | null;
    wordCount: number;
    statusCode: number | null;
  };
}) {
  const health = pageHealth(page);
  let path = page.url;
  try {
    const u = new URL(page.url);
    path = u.pathname === "/" ? u.host : u.pathname;
  } catch {
    // keep raw url
  }
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-slate-50 text-slate-400">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate font-medium text-slate-900" title={page.url}>
              {path}
            </p>
            <Badge tone={health.tone}>{health.label}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {page.title ?? "No title tag"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {page.wordCount.toLocaleString()} words
            {page.statusCode != null ? ` · HTTP ${page.statusCode}` : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}
