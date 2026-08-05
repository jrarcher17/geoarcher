import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { hostOf } from "@/lib/utils";

interface CompetitorRow {
  siteUrl: string;
  status: string;
  geoOverall: number | null;
  understanding: number | null;
}

/** You vs one competitor across the two headline scores. */
export function CompetitorComparisonCard({
  you,
  competitor,
}: {
  you: CompetitorRow;
  competitor: CompetitorRow;
}) {
  const running = ["QUEUED", "CRAWLING", "ANALYZING"].includes(competitor.status);
  const rows: { label: string; yours: number | null; theirs: number | null }[] = [
    { label: "GEO Score", yours: you.geoOverall, theirs: competitor.geoOverall },
    {
      label: "AI Understanding",
      yours: you.understanding,
      theirs: competitor.understanding,
    },
  ];
  const winning =
    you.geoOverall != null &&
    competitor.geoOverall != null &&
    you.geoOverall >= competitor.geoOverall;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">{hostOf(competitor.siteUrl)}</p>
        {running ? (
          <Badge tone="info">Analyzing…</Badge>
        ) : competitor.geoOverall != null ? (
          <Badge tone={winning ? "positive" : "critical"}>
            {winning ? "You lead" : "They lead"}
          </Badge>
        ) : (
          <Badge tone="neutral">{competitor.status}</Badge>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{row.label}</span>
              <span className="font-mono">
                You {row.yours ?? "—"} · Them {row.theirs ?? "—"}
              </span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <Progress value={row.yours ?? 0} toned={false} />
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-400"
                  style={{ width: `${row.theirs ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Blue = you · Gray = {hostOf(competitor.siteUrl)}
      </p>
    </Card>
  );
}
