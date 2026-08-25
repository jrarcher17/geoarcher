import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ReportInterestForm } from "@/components/leads/ReportInterestForm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import type { ProspectReport } from "@/lib/leads/ai";
import type { Tone } from "@/lib/utils";

export const dynamic = "force-dynamic";

function severityTone(severity: string): Tone {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "info";
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { reportToken: token },
    select: {
      companyName: true,
      domain: true,
      report: true,
      analysis: true,
    },
  });
  if (!prospect?.report) notFound();

  const report = prospect.report as unknown as ProspectReport;
  const analysis = prospect.analysis as {
    seoScore?: number;
    geoScore?: number;
    pagesCrawled?: number;
    siteUrl?: string;
  } | null;

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <BrandWordmark />
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Personalized GEO report
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
          {prospect.companyName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {report.headline}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {report.summary}
        </p>
        {report.businessSummary && (
          <p className="mt-3 text-sm italic text-slate-500">
            {report.businessSummary}
          </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              SEO health
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {analysis?.seoScore ?? "—"}
              <span className="text-sm font-medium text-slate-400">/100</span>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              AI visibility
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {analysis?.geoScore ?? "—"}
              <span className="text-sm font-medium text-slate-400">/100</span>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Pages checked
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {analysis?.pagesCrawled ?? "—"}
            </p>
          </Card>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-slate-900">Findings</h2>
        <div className="mt-4 space-y-3">
          {report.findings.map((finding) => (
            <Card key={finding.title} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={severityTone(finding.severity)}>
                  {finding.severity}
                </Badge>
                <h3 className="font-semibold text-slate-900">{finding.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {finding.explanation}
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-12 border-violet-200 bg-violet-50/50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Want to get found more often in AI search?
          </p>
          <ReportInterestForm
            token={token}
            alreadyRequested={Boolean(report.interest?.email)}
          />
        </Card>
      </main>
    </div>
  );
}
