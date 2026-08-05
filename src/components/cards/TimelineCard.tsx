import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { ScanHistoryEntry } from "@/lib/types";

/** Scan history as a vertical timeline with score movements. */
export function TimelineCard({
  entries,
  currentScanId,
  title = "Scan timeline",
  description = "Every crawl, newest first.",
}: {
  entries: ScanHistoryEntry[];
  currentScanId?: string;
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-0 border-l border-slate-200 pl-5">
          {entries.map((e, i) => {
            const prev = entries[i + 1];
            const delta =
              e.geoOverall != null && prev?.geoOverall != null
                ? e.geoOverall - prev.geoOverall
                : null;
            return (
              <li key={e.id} className="relative pb-6 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white",
                    e.status === "COMPLETE"
                      ? "bg-emerald-500"
                      : e.status === "FAILED"
                        ? "bg-red-400"
                        : "bg-amber-400"
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/scan/${e.id}`}
                    className={cn(
                      "text-sm font-medium hover:text-sky-600",
                      e.id === currentScanId ? "text-sky-600" : "text-slate-800"
                    )}
                  >
                    {formatDate(e.createdAt)}
                  </Link>
                  <Badge
                    tone={
                      e.status === "COMPLETE"
                        ? "positive"
                        : e.status === "FAILED"
                          ? "critical"
                          : "warning"
                    }
                  >
                    {e.status.toLowerCase()}
                  </Badge>
                  {e.id === currentScanId && <Badge tone="info">viewing</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {e.pagesCrawled} pages
                  {e.geoOverall != null ? ` · GEO ${e.geoOverall}` : ""}
                  {e.understanding != null
                    ? ` · Understanding ${e.understanding}`
                    : ""}
                  {delta != null && delta !== 0 && (
                    <span
                      className={cn(
                        "ml-1 font-semibold",
                        delta > 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      ({delta > 0 ? "+" : ""}
                      {delta} GEO)
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
