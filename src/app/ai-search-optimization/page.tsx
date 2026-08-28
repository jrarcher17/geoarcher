import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { signUpDisabled } from "@/lib/sign-up-config";

export const metadata = {
  title: "AI Search Optimization — GEO Archer",
  description:
    "Get found by Google. Get mentioned by AI. GEO Archer finds visibility gaps and helps fix them without rebuilding your site.",
};

export default function AiSearchOptimizationPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          AI search optimization
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Traditional SEO tools find problems. GEO Archer finds problems,
          prioritizes them, helps fix them, and monitors the result — across
          Google and AI answers.
        </p>
        <p className="mt-4 text-slate-600">
          We do not ask you to publish 50 articles. We identify the smallest
          amount of high-quality information that closes the biggest visibility
          gap, usually on a page you already have.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/free-seo-geo-audit" className="btn-primary">
            Analyze My Website Free
          </Link>
          <Link href="/#how" className="btn-secondary">
            See How It Works
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
