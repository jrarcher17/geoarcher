"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changePassword,
  deleteUser,
  signOut,
  updateUser,
  useSession,
} from "@/lib/auth-client";
import type { PlanId, PlanLimits } from "@/lib/plans";
import { formatSiteLimit } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SettingsPayload {
  user: { name: string; email: string; createdAt: string };
  billing: {
    plan: PlanId;
    planLabel: string;
    priceLabel: string;
    proPriceLabel: string;
    limits: PlanLimits;
    stripeEnabled: boolean;
    stripeProPlusEnabled: boolean;
    devBillingToggle: boolean;
    hasSubscription: boolean;
    usage: {
      sites: number;
      sitesLimit: number | null;
      scansThisMonth: number;
      scansLimit: number;
    };
  };
  plans: Record<PlanId, PlanLimits>;
}

function PlanFeatureList({ plan }: { plan: PlanLimits }) {
  return (
    <ul className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <strong className="font-medium text-slate-800">Scans per month:</strong>{" "}
          {plan.scansPerMonth}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <strong className="font-medium text-slate-800">Sites:</strong>{" "}
          {formatSiteLimit(plan.sites)}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <strong className="font-medium text-slate-800">Max pages per scan:</strong>{" "}
          {plan.maxPagesPerScan}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <strong className="font-medium text-slate-800">Competitor crawl budget:</strong>{" "}
          {plan.competitorMaxPages}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <strong className="font-medium text-slate-800">AI visibility:</strong>{" "}
          {plan.visibilityFeatures}
        </span>
      </li>
      {plan.prospectsPerMonth > 0 && (
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <span>
            <strong className="font-medium text-slate-800">
              AI Lead Generation Machine:
            </strong>{" "}
            {plan.prospectsPerMonth} prospects / month — automated discovery,
            GEO/SEO scoring, personalized reports + outreach
          </span>
        </li>
      )}
    </ul>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "profile";
  const checkoutNotice = searchParams.get("checkout");
  const scanError = searchParams.get("scanError");
  const { data: session, isPending } = useSession();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [billingBusy, setBillingBusy] = useState(false);

  async function loadSettings() {
    const res = await fetch("/api/me/settings", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setLoadError(j.error ?? "Failed to load settings.");
      return;
    }
    const data: SettingsPayload = await res.json();
    setSettings(data);
    setDisplayName(data.user.name);
  }

  useEffect(() => {
    if (session) void loadSettings();
  }, [session]);

  useEffect(() => {
    if (checkoutNotice === "success" && session) {
      void loadSettings();
    }
  }, [checkoutNotice, session]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await updateUser({ name: displayName.trim() });
      if (res.error) throw new Error(res.error.message ?? "Update failed.");
      setProfileMsg("Display name saved.");
      await loadSettings();
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) throw new Error(res.error.message ?? "Password change failed.");
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg("Password updated.");
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function switchPlan(plan: PlanId) {
    if (!settings || settings.billing.plan === plan) return;
    setBillingBusy(true);
    try {
      const res = await fetch("/api/me/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not update plan.");
      await loadSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update plan.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function startCheckout(plan: "pro" | "proPlus") {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Checkout failed.");
      if (j.updated) {
        // Existing subscription switched price in place — no redirect needed.
        await loadSettings();
        setBillingBusy(false);
        return;
      }
      if (typeof j.url === "string") {
        window.location.href = j.url;
        return;
      }
      throw new Error("Checkout failed.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed.");
      setBillingBusy(false);
    }
  }

  async function openBillingPortal() {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not open billing portal.");
      if (typeof j.url === "string") {
        window.location.href = j.url;
        return;
      }
      throw new Error("Could not open billing portal.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not open billing portal.");
      setBillingBusy(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== "DELETE") {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteUser({ password: deletePassword });
      if (res.error) throw new Error(res.error.message ?? "Could not delete account.");
      await signOut();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete account.");
      setDeleting(false);
    }
  }

  const currentPlan = settings?.billing.plan ?? "free";

  return (
    <AppShell
      title="Settings"
      subtitle="Account, integrations, and billing."
    >
      {isPending && <p className="text-sm text-slate-400">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!session && !isPending && (
        <Card className="p-8 text-center">
          <p className="text-slate-600">Sign in to manage settings.</p>
          <a href="/login" className="btn-primary mt-4 inline-block">
            Sign in
          </a>
        </Card>
      )}

      {session && settings && (
        <Tabs key={initialTab} defaultValue={initialTab} className="w-full">
          <TabsList>
            <TabsTrigger value="profile">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="danger">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Display name</CardTitle>
                <CardDescription>
                  Shown in the sidebar and on exported reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveProfile} className="flex max-w-md flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Name</label>
                    <input
                      className="input-field mt-1.5"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <input
                      className="input-field mt-1.5 bg-slate-50 text-slate-500"
                      value={settings.user.email}
                      disabled
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? "Saving…" : "Save changes"}
                    </Button>
                    {profileMsg && (
                      <p className="text-sm text-slate-500">{profileMsg}</p>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Use a strong password you don&apos;t reuse elsewhere.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={savePassword} className="flex max-w-md flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Current password
                    </label>
                    <input
                      type="password"
                      className="input-field mt-1.5"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      New password
                    </label>
                    <input
                      type="password"
                      className="input-field mt-1.5"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={passwordSaving}>
                      {passwordSaving ? "Updating…" : "Update password"}
                    </Button>
                    {passwordMsg && (
                      <p className="text-sm text-slate-500">{passwordMsg}</p>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>
                  Connect the systems GEO Archer already uses. Items marked
                  coming soon are not live.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["OpenAI", "Powers analysis, visibility modeling, and drafts.", "Connected when OPENAI_API_KEY is set on the server."],
                  ["Resend", "Sends Lead Machine outreach.", "Connected when RESEND_API_KEY is set."],
                  ["Apollo", "Finds companies for Lead Machine.", "Connected when APOLLO_API_KEY is set."],
                  ["Stripe", "Billing for Pro and Pro Plus.", "Connected when Stripe keys are set."],
                  ["DataForSEO", "Live Google rankings.", "Connect in Rankings after credentials are set."],
                  ["Google Search Console", "Traffic and queries.", "Coming soon — not connected."],
                  ["Google Analytics", "Sessions and conversions.", "Coming soon — not connected."],
                  ["WordPress / Shopify / Webflow", "CMS publish for approved content.", "Coming soon — not connected."],
                ].map(([name, why, state]) => (
                  <div key={name} className="border border-slate-100 px-4 py-3">
                    <p className="font-medium text-slate-900">{name}</p>
                    <p className="mt-0.5 text-slate-500">{why}</p>
                    <p className="mt-1 text-xs text-slate-400">{state}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            {scanError && (
              <p className="mb-4 rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {scanError}
              </p>
            )}
            {checkoutNotice === "success" && (
              <p className="mb-4 rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Payment received — your new plan should activate within a minute.
                Refresh if limits haven&apos;t updated yet.
              </p>
            )}
            {checkoutNotice === "cancel" && (
              <p className="mb-4 text-sm text-slate-500">Checkout canceled.</p>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={currentPlan !== "free" ? "info" : "neutral"}>
                Current: {settings.billing.planLabel}
              </Badge>
              <span className="text-sm text-slate-500">
                {settings.billing.usage.sites} site
                {settings.billing.usage.sites === 1 ? "" : "s"} in use
                {settings.billing.usage.sitesLimit != null &&
                  ` · limit ${settings.billing.usage.sitesLimit}`}
                {" · "}
                {settings.billing.usage.scansThisMonth} /{" "}
                {settings.billing.usage.scansLimit} scans this month (UTC)
              </span>
            </div>

            {currentPlan !== "free" &&
              settings.billing.hasSubscription &&
              settings.billing.stripeEnabled && (
                <div className="mb-4">
                  <Button
                    variant="secondary"
                    disabled={billingBusy}
                    onClick={() => void openBillingPortal()}
                  >
                    Manage subscription
                  </Button>
                </div>
              )}

            <div className="grid gap-4 lg:grid-cols-3">
              {(["free", "pro", "proPlus"] as PlanId[]).map((id) => {
                const plan = settings.plans[id];
                const active = currentPlan === id;
                const stripeOn =
                  id === "proPlus"
                    ? settings.billing.stripeProPlusEnabled
                    : settings.billing.stripeEnabled;
                const devToggle = settings.billing.devBillingToggle;
                const paid = id !== "free";
                return (
                  <Card
                    key={id}
                    className={cn(
                      "relative flex flex-col p-6",
                      active && "border-sky-300 ring-1 ring-sky-200",
                      id === "proPlus" && !active && "border-violet-200"
                    )}
                  >
                    {active && (
                      <Badge tone="info" className="absolute right-4 top-4">
                        Current plan
                      </Badge>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-lg font-bold text-slate-900">{plan.label}</h3>
                      <p className="text-sm font-semibold text-slate-800">
                        {plan.priceLabel}
                      </p>
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Included
                    </p>
                    <PlanFeatureList plan={plan} />
                    <div className="mt-6 flex-1" />
                    {paid ? (
                      active ? (
                        <Button className="w-full" disabled>
                          <Sparkles className="h-4 w-4" />
                          You&apos;re on {plan.label}
                        </Button>
                      ) : stripeOn ? (
                        <Button
                          className="w-full"
                          disabled={billingBusy}
                          onClick={() =>
                            void startCheckout(id as "pro" | "proPlus")
                          }
                        >
                          <Sparkles className="h-4 w-4" />
                          Upgrade to {plan.label}
                        </Button>
                      ) : devToggle ? (
                        <Button
                          className="w-full"
                          disabled={billingBusy}
                          onClick={() => void switchPlan(id)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Enable {plan.label} (dev)
                        </Button>
                      ) : (
                        <p className="text-center text-xs text-slate-400">
                          {plan.label} checkout is not configured yet.
                        </p>
                      )
                    ) : active ? (
                      <Button variant="secondary" className="w-full" disabled>
                        Current plan
                      </Button>
                    ) : devToggle ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        disabled={billingBusy}
                        onClick={() => void switchPlan("free")}
                      >
                        Switch to Free (dev)
                      </Button>
                    ) : null}
                  </Card>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Scan counts include rescans and competitor crawls on your sites,
              reset on the 1st of each month (UTC). Cancel anytime via{" "}
              {settings.billing.stripeEnabled ? (
                <button
                  type="button"
                  className="text-sky-600 hover:underline"
                  onClick={() => void openBillingPortal()}
                  disabled={!settings.billing.hasSubscription || billingBusy}
                >
                  Stripe billing portal
                </button>
              ) : (
                "the billing portal"
              )}
              .
            </p>
          </TabsContent>

          <TabsContent value="danger">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700">Delete account</CardTitle>
                <CardDescription>
                  Permanently removes your account, sessions, and site links. Sites
                  and scans may remain in the database if other users reference them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleDeleteAccount}
                  className="flex max-w-md flex-col gap-4"
                >
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <input
                      type="password"
                      className="input-field mt-1.5"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Type DELETE to confirm
                    </label>
                    <input
                      className="input-field mt-1.5"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600">{deleteError}</p>
                  )}
                  <Button variant="danger" type="submit" disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete my account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          title="Settings"
          subtitle="Profile, security, billing, and account controls."
        >
          <p className="text-sm text-slate-400">Loading…</p>
        </AppShell>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
