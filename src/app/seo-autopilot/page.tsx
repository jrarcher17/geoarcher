import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { signUpDisabled } from "@/lib/sign-up-config";

export const metadata = {
  title: "SEO Autopilot — GEO Archer",
  description:
    "GEO Archer continuously crawls, audits, and monitors your site. Major content changes always need your approval.",
};

export default function SeoAutopilotMarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          SEO Autopilot
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Turn monitoring on and GEO Archer keeps crawling, auditing, and
          finding opportunities. It never ships major website changes without
          your approval.
        </p>
        <ul className="mt-6 space-y-2 text-slate-600">
          <li>Monitor: crawl, audit, rankings, AI visibility, competitors</li>
          <li>Autopilot: queue technical and structured-data work</li>
          <li>Review: content drafts, new pages, large rewrites</li>
        </ul>
        <Link href="/signup" className="btn-primary mt-8 inline-block">
          Start Autopilot
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
