"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ActionRow {
  id: string;
  action: string;
  campaignId: string | null;
  platform: string | null;
  status: string;
  title: string;
  detail: string | null;
  error: string | null;
}

interface RecommendationRow {
  id: string;
  type: string;
  title: string;
  detail: string;
  campaignId: string | null;
  payload: { action?: string; campaignId?: string; href?: string } | null;
}

interface ChatLine {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "How are my ads doing?",
  "Which campaign should I publish first?",
  "What should I advertise next?",
  "Compare Google and Meta — do I have any spend yet?",
];

export default function AssistantPage() {
  const [pending, setPending] = useState<ActionRow[]>([]);
  const [history, setHistory] = useState<ActionRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"chat" | "rec" | string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      if (json.upgradeRequired) {
        setUpgrade(true);
        return;
      }
      throw new Error(json.error ?? "Failed to load the assistant.");
    }
    setPending(json.pending);
    setHistory(json.history);
    setRecommendations(json.recommendations);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy("chat");
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The assistant couldn’t reply.");
      setMessages([...next, { role: "assistant", content: json.reply }]);
      if (Array.isArray(json.pending) && json.pending.length > 0) {
        setPending((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...json.pending.filter((p: ActionRow) => !ids.has(p.id)), ...prev];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant couldn’t reply.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/assistant/actions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update the action.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the action.");
    } finally {
      setBusy(null);
    }
  }

  async function queueRecommendation(rec: RecommendationRow) {
    if (!rec.payload?.action || !rec.payload.campaignId) return;
    setBusy(rec.id);
    setError(null);
    try {
      const res = await fetch("/api/assistant/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: rec.payload,
          title: rec.title,
          detail: rec.detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not queue this action.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue this action.");
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(id: string) {
    await fetch(`/api/assistant/recommendations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DISMISSED" }),
    });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  async function refreshRecs() {
    setBusy("rec");
    try {
      const res = await fetch("/api/assistant/recommend", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Refresh failed.");
      setRecommendations(json.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="AI Assistant"
      subtitle="Ask about your advertising. Anything that spends money waits for your approval."
    >
      {error && (
        <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {upgrade && (
        <EmptyState
          title="The assistant is a Pro feature"
          body="Upgrade to Pro to ask questions about your campaigns and approve AI-proposed changes."
          actionHref="/settings?tab=billing"
          actionLabel="Upgrade to Pro"
        />
      )}

      {loading && !upgrade && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-[28rem] lg:col-span-3" />
          <Skeleton className="h-[28rem] lg:col-span-2" />
        </div>
      )}

      {!loading && !upgrade && (
        <FadeIn className="grid gap-6 lg:grid-cols-5">
          <section className="flex min-h-[32rem] flex-col border border-slate-200 bg-white lg:col-span-3">
            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div>
                  <SectionLabel>Try asking</SectionLabel>
                  <ul className="mt-3 grid gap-2">
                    {EXAMPLES.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          className="w-full border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
                          onClick={() => void send(q)}
                        >
                          “{q}”
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={cn(
                    "max-w-[90%] px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-800"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {busy === "chat" && (
                <p className="text-sm text-slate-400">Reading your campaigns…</p>
              )}
            </div>
            <form
              className="flex gap-2 border-t border-slate-100 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                placeholder="Ask about a campaign, or propose a change…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy === "chat"}
              />
              <button
                type="submit"
                className="btn-primary text-sm disabled:opacity-60"
                disabled={busy === "chat" || !input.trim()}
              >
                Send
              </button>
            </form>
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-2">
            <section className="border border-slate-200 bg-white p-5">
              <SectionLabel>Needs your approval</SectionLabel>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No pending changes. The assistant will queue pause, budget, Ready
                  and publish actions here — never run them on its own.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {pending.map((a) => (
                    <li key={a.id} className="border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      {a.detail && (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {a.detail}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs disabled:opacity-60"
                          disabled={busy === a.id}
                          onClick={() => void decide(a.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs disabled:opacity-60"
                          disabled={busy === a.id}
                          onClick={() => void decide(a.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Recommendations</SectionLabel>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-60"
                  disabled={busy === "rec"}
                  onClick={() => void refreshRecs()}
                >
                  {busy === "rec" ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {recommendations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No recommendations right now. Create a campaign in Ad Studio or
                  refresh after you connect an ad account.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {recommendations.map((r) => (
                    <li key={r.id} className="border border-slate-100 p-3">
                      <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {r.detail}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.payload?.href && (
                          <Link
                            href={r.payload.href}
                            className="text-xs font-medium text-slate-900 underline underline-offset-2"
                          >
                            Open
                          </Link>
                        )}
                        {r.payload?.action && (
                          <button
                            type="button"
                            className="text-xs font-medium text-slate-900 underline underline-offset-2 disabled:opacity-60"
                            disabled={busy === r.id}
                            onClick={() => void queueRecommendation(r)}
                          >
                            Queue for approval
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-700"
                          onClick={() => void dismiss(r.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {history.length > 0 && (
              <section className="border border-slate-200 bg-white p-5">
                <SectionLabel>Audit trail</SectionLabel>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {history.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-2">
                      <span className="text-slate-700">{a.title}</span>
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </FadeIn>
      )}
    </AppShell>
  );
}
