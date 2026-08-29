import { StrategyForm } from "@/components/strategy/StrategyForm";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { getServerSession } from "@/lib/session";
import { signUpDisabled } from "@/lib/sign-up-config";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const session = await getServerSession();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <main className="mx-auto grid max-w-5xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Advertising &amp; GEO services
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Get more customers from AI &amp; advertising
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Want GEO Archer to build your advertising strategy? Tell us who you
            are and the site we should start from. We store the request — we do
            not invent ads, spend, or results, and we do not connect an ad
            account from this form.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>Name, email, company, and website</li>
            <li>Optional monthly ad budget so we can scope a recommendation</li>
            <li>You can still use Ad Studio yourself anytime</li>
          </ul>
        </div>
        <StrategyForm
          defaults={{
            name: session?.user.name ?? "",
            email: session?.user.email ?? "",
          }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
