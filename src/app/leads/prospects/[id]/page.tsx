"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LeadShell, LeadUpgradeGate } from "@/components/leads/LeadShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProspectReport } from "@/lib/leads/ai";
import type { ProspectProblem } from "@/lib/leads/analyze";
import { formatDate, type Tone } from "@/lib/utils";

interface EmailRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  followUpIndex: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  bouncedAt: string | null;
  repliedAt: string | null;
}

interface ProspectDetail {
  id: string;
  campaignId: string;
  companyName: string;
  domain: string;
  status: string;
  score: number | null;
  problems: ProspectProblem[] | null;
  analysis: {
    seoScore?: number;
    geoScore?: number;
    pagesCrawled?: number;
    siteUrl?: string;
  } | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  report: ProspectReport | null;
  reportToken: string;
  error: string | null;
  emails: EmailRow[];
}

function statusTone(status: string): Tone {
  if (status === "REPLIED" || status === "QUALIFIED" || status === "OPENED")
    return "positive";
  if (status === "CONTACTED" || status === "SENT" || status === "DELIVERED")
    return "info";
  if (status === "BOUNCED" || status === "FAILED") return "critical";
  return "neutral";
}

function severityTone(severity: string): Tone {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "info";
}

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [campaignName, setCampaignName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  const load = useCallback(async () => {
    const accessRes = await fetch("/api/leads/access", { cache: "no-store" });
    if (accessRes.status === 401) {
      window.location.href = `/login?next=/leads/prospects/${params.id}`;
      return;
    }
    const access = await accessRes.json().catch(() => ({}));
    if (!access.allowed) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    const res = await fetch(`/api/leads/prospects/${params.id}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load prospect.");
      return;
    }
    setProspect(json.prospect);
    setCampaignName(json.campaign?.name ?? "");
    const draft = (json.prospect.emails as EmailRow[] | undefined)?.find(
      (e) => e.followUpIndex === 0
    );
    if (draft) {
      setSubject(draft.subject);
      setBody(draft.body);
    }
    if (json.prospect.contactEmail) setEmailInput(json.prospect.contactEmail);
    if (json.prospect.contactName) setNameInput(json.prospect.contactName);
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const draft = prospect?.emails.find(
    (e) =>
      e.followUpIndex === 0 && (e.status === "DRAFT" || e.status === "QUEUED")
  );

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/prospects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!confirm("Send this outreach email now?")) return;
    setBusy(true);
    try {
      if (draft && (subject !== draft.subject || body !== draft.body)) {
        const save = await fetch(`/api/leads/prospects/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body }),
        });
        if (!save.ok) {
          const json = await save.json().catch(() => ({}));
          throw new Error(json.error ?? "Could not save draft.");
        }
      }
      const res = await fetch(`/api/leads/prospects/${params.id}/send`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Send failed.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LeadShell
      title={prospect?.companyName ?? "Prospect"}
      subtitle={
        prospect
          ? `${prospect.domain}${campaignName ? ` · ${campaignName}` : ""}`
          : "Problems found, report, and outreach."
      }
      actions={
        prospect ? (
          <Button
            variant="secondary"
            onClick={() => router.push(`/leads/${prospect.campaignId}`)}
          >
            Back to campaign
          </Button>
        ) : undefined
      }
    >
      {allowed === null && <Skeleton className="h-64" />}
      {allowed === false && <LeadUpgradeGate />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {allowed && prospect && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={statusTone(prospect.status)}>{prospect.status}</Badge>
              {prospect.analysis && (
                <span className="text-sm font-semibold text-slate-800">
                  GEO {prospect.analysis.geoScore ?? "—"}/100
                </span>
              )}
              {prospect.analysis && (
                <span className="text-sm text-slate-500">
                  SEO {prospect.analysis.seoScore ?? "—"} ·{" "}
                  {prospect.analysis.pagesCrawled ?? 0} pages
                </span>
              )}
            </div>
            {prospect.error && (
              <p className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {prospect.error}
              </p>
            )}

            <Card className="p-6">
              <h2 className="text-base font-semibold text-slate-900">
                Write and send outreach
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add who to email, edit the draft, then send. Nothing goes out
                until you click Approve &amp; send.
              </p>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    1. Contact
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      className="input-field"
                      placeholder="Contact name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                    />
                    <input
                      className="input-field"
                      type="email"
                      placeholder="name@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                  <Button
                    className="mt-2"
                    variant="secondary"
                    disabled={busy || !emailInput.includes("@")}
                    onClick={() =>
                      void patch({
                        contactEmail: emailInput,
                        contactName: nameInput,
                      })
                    }
                  >
                    Save contact &amp; draft email
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    2. Edit the email
                  </p>
                  {draft || subject || body ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        className="input-field"
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                      <textarea
                        className="input-field min-h-[14rem]"
                        placeholder="Email body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        disabled={busy || !draft}
                        onClick={() => void patch({ subject, body })}
                      >
                        Save draft
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      Save a contact first. We will write a draft you can edit
                      here.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    3. Approve &amp; send
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      disabled={busy || !draft || !emailInput.includes("@")}
                      onClick={() => void send()}
                    >
                      Approve &amp; send
                    </Button>
                    {prospect.status === "QUALIFIED" && (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => void patch({ action: "disqualify" })}
                      >
                        Skip this company
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">Problems</h2>
              <div className="mt-3 space-y-3">
                {(prospect.problems ?? []).map((p) => (
                  <div key={p.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={severityTone(p.severity)}>{p.severity}</Badge>
                      <p className="font-medium text-slate-800">{p.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{p.detail}</p>
                  </div>
                ))}
                {(prospect.problems ?? []).length === 0 && (
                  <p className="text-sm text-slate-400">
                    Analysis hasn&apos;t finished yet.
                  </p>
                )}
              </div>
            </Card>

            {prospect.report && (
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Personalized report
                  </h2>
                  <Link
                    href={`/r/${prospect.reportToken}`}
                    target="_blank"
                    className="text-sm font-medium text-violet-600 hover:underline"
                  >
                    Open public link
                  </Link>
                </div>
                <p className="mt-2 font-medium text-slate-800">
                  {prospect.report.headline}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {prospect.report.summary}
                </p>
              </Card>
            )}

          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
              <p className="mt-2 text-sm text-slate-700">
                {prospect.contactName ?? "—"}
              </p>
              <p className="text-xs text-slate-400">
                {prospect.contactTitle ?? ""}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {prospect.contactEmail ?? "No email yet — add one to draft outreach"}
              </p>
              {prospect.report?.interest?.email && (
                <p className="mt-3 rounded-none border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                  Requested the fix plan
                  {prospect.report.interest.name
                    ? ` — ${prospect.report.interest.name}`
                    : ""}{" "}
                  ({prospect.report.interest.email})
                </p>
              )}
              {["CONTACTED", "REPLIED"].includes(prospect.status) &&
                prospect.status !== "REPLIED" && (
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void patch({ action: "markReplied" })}
                  >
                    Mark as replied
                  </Button>
                )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
              <ul className="mt-3 space-y-3">
                {prospect.emails.map((e) => (
                  <li key={e.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      <span className="text-xs text-slate-400">
                        {e.followUpIndex === 0
                          ? "Initial"
                          : `Follow-up ${e.followUpIndex}`}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-slate-800">{e.subject}</p>
                    <p className="text-xs text-slate-400">
                      {e.sentAt
                        ? `Sent ${formatDate(e.sentAt)}`
                        : `Created ${formatDate(e.createdAt)}`}
                      {e.openedAt ? " · opened" : ""}
                      {e.repliedAt ? " · replied" : ""}
                    </p>
                    {e.error && (
                      <p className="mt-1 text-xs text-red-600">{e.error}</p>
                    )}
                  </li>
                ))}
                {prospect.emails.length === 0 && (
                  <li className="text-sm text-slate-400">No emails yet.</li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </LeadShell>
  );
}
