import { ScanForm } from "@/components/ScanForm";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { signUpDisabled } from "@/lib/sign-up-config";

export const metadata = {
  title: "Free AI Visibility Audit — GEO Archer",
  description:
    "Enter your website to see how visible you are to Google and AI search — then fix what GEO Archer finds.",
};

export default function FreeAuditPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Free audit
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          How visible is your business to Google and AI?
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Enter your website and find out. GEO Archer crawls the site, measures
          SEO and modeled AI visibility, and lists the biggest opportunities.
        </p>
        <div className="mt-8">
          <ScanForm requireAuth submitLabel="Analyze My Website" layout="stacked" />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          After the scan you will see your AI visibility score, SEO score, and
          the opportunities GEO Archer can prioritize. Fixing them automatically
          starts when you create an account.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
