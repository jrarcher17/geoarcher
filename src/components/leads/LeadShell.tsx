"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LeadUpgradeGate() {
  return (
    <Card className="mx-auto max-w-xl p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-violet-500" />
      <p className="mt-3 text-lg font-semibold text-slate-900">
        AI Lead Generation Machine is a Pro Plus feature
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Find companies that need better GEO, score their sites, generate a
        personalized report, and send outreach — automatically. Upgrade to Pro
        Plus to turn GEO Archer into a customer-finding engine.
      </p>
      <div className="mt-5">
        <Link href="/settings?tab=billing">
          <Button>Upgrade to Pro Plus</Button>
        </Link>
      </div>
    </Card>
  );
}

export function LeadShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppShell title={title} subtitle={subtitle} actions={actions} breadcrumb="Lead Machine">
      {children}
    </AppShell>
  );
}
