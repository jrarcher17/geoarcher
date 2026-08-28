"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LeadShell, LeadUpgradeGate } from "@/components/leads/LeadShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NewCampaignPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState<number>(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [targetCount, setTargetCount] = useState(25);
  const [employeeMin, setEmployeeMin] = useState("");
  const [employeeMax, setEmployeeMax] = useState("");
  const [mode, setMode] = useState<"APPROVE_FIRST" | "AUTO_SEND">(
    "APPROVE_FIRST"
  );

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/leads/access", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/leads/new";
        return;
      }
      const json = await res.json().catch(() => ({}));
      setAllowed(Boolean(json.allowed));
      if (json.quota?.remaining != null) setRemaining(json.quota.remaining);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          industry: industry.trim(),
          location: location.trim() || undefined,
          targetCount,
          mode,
          employeeMin: employeeMin ? Number(employeeMin) : undefined,
          employeeMax: employeeMax ? Number(employeeMax) : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not create campaign.");
      router.push(`/leads/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign.");
      setBusy(false);
    }
  }

  return (
    <LeadShell
      title="New Campaign"
      subtitle="Define industry, location, and company size. We find businesses that can run ads, score the opportunity, and draft outreach."
    >
      {allowed === false && <LeadUpgradeGate />}
      {allowed && (
        <Card className="max-w-xl p-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Industry
              </label>
              <input
                className="input-field mt-1.5"
                placeholder="e.g. tanning salon, plumber, law firm"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Location
              </label>
              <input
                className="input-field mt-1.5"
                placeholder="e.g. Austin, Texas"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Campaign name
              </label>
              <input
                className="input-field mt-1.5"
                placeholder="Optional — defaults to industry + location"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                How many companies to find ({remaining} outreach leads left
                this month)
              </label>
              <input
                type="number"
                className="input-field mt-1.5"
                min={1}
                max={Math.min(500, remaining)}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Min employees
                </label>
                <input
                  type="number"
                  className="input-field mt-1.5"
                  min={1}
                  placeholder="Any"
                  value={employeeMin}
                  onChange={(e) => setEmployeeMin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Max employees
                </label>
                <input
                  type="number"
                  className="input-field mt-1.5"
                  min={1}
                  placeholder="Any"
                  value={employeeMax}
                  onChange={(e) => setEmployeeMax(e.target.value)}
                />
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">
                Outreach mode
              </legend>
              <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "APPROVE_FIRST"}
                  onChange={() => setMode("APPROVE_FIRST")}
                />
                <span>
                  <strong className="font-medium text-slate-800">
                    Approve first
                  </strong>
                  {" — "}
                  review each email before it sends (recommended).
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "AUTO_SEND"}
                  onChange={() => setMode("AUTO_SEND")}
                />
                <span>
                  <strong className="font-medium text-slate-800">Auto-send</strong>
                  {" — "}
                  send as soon as a prospect qualifies. Daily cap still applies.
                </span>
              </label>
            </fieldset>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || remaining <= 0}>
                {busy ? "Starting…" : "Start campaign"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/leads")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </LeadShell>
  );
}
