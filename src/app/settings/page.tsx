"use client";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { signOut, useSession } from "@/lib/auth-client";

export default function SettingsPage() {
  const { data: session, isPending } = useSession();

  return (
    <AppShell title="Settings" subtitle="Your account and workspace preferences.">
      <div className="flex w-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed-in identity for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : session ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {session.user.name || "Unnamed"}
                  </p>
                  <p className="text-sm text-slate-500">{session.user.email}</p>
                </div>
                <Button variant="secondary" onClick={() => signOut()}>
                  Sign out
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Not signed in.{" "}
                <a href="/login" className="text-sky-600 hover:underline">
                  Sign in
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scanning</CardTitle>
            <CardDescription>
              Crawl limits are configured via environment variables on the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Max pages per scan</span>
              <Badge tone="neutral">MAX_CRAWL_PAGES (default 15)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Competitor crawl budget</span>
              <Badge tone="neutral">COMPETITOR_MAX_CRAWL_PAGES (default 8)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">AI model</span>
              <Badge tone="neutral">OPENAI_MODEL</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Remove sites (and all their scans) from the Sites page — hover a
              site card and use the trash action.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppShell>
  );
}
