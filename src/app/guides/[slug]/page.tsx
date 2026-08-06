import { notFound } from "next/navigation";
import { GuideArticleView } from "@/components/marketing/GuideArticleView";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { getGuide, GUIDES_LIST } from "@/lib/guides-content";
import { signUpDisabled } from "@/lib/sign-up-config";

export function generateStaticParams() {
  return GUIDES_LIST.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: `${guide.title} — GEO Archer`,
    description: guide.summary,
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <GuideArticleView guide={guide} />
      <MarketingFooter />
    </div>
  );
}
