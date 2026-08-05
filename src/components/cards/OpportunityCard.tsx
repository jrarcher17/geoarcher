"use client";

import { MessageCircleQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GenerateActionButton } from "@/components/cards/GenerateAction";

/** A question AI assistants get asked that this site can't answer yet. */
export function OpportunityCard({
  question,
  whyItMatters,
  scanId,
  siteLabel,
}: {
  question: string;
  whyItMatters: string;
  scanId?: string;
  siteLabel?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
          <MessageCircleQuestion className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {siteLabel && (
            <p className="mb-1 text-xs font-medium text-slate-400">{siteLabel}</p>
          )}
          <p className="font-semibold text-slate-900">“{question}”</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {whyItMatters}
          </p>
          {scanId && (
            <div className="mt-3">
              <GenerateActionButton scanId={scanId} kind="faq" topic={question} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
