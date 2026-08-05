import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Tone } from "@/lib/utils";

/** One issue holding AI understanding back. */
export function IssueCard({
  issue,
  detail,
  severity = "warning",
  siteLabel,
}: {
  issue: string;
  detail: string;
  severity?: Tone;
  siteLabel?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{issue}</p>
            <Badge tone={severity}>
              {severity === "critical" ? "Critical" : "Needs attention"}
            </Badge>
          </div>
          {siteLabel && (
            <p className="mt-0.5 text-xs font-medium text-slate-400">{siteLabel}</p>
          )}
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{detail}</p>
        </div>
      </div>
    </Card>
  );
}
