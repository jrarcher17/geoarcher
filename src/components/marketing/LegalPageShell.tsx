import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingSections";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { signUpDisabled } from "@/lib/sign-up-config";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav signUpDisabled={signUpDisabled()} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="mt-8 space-y-6 text-slate-600 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-sky-600 [&_a]:hover:underline">
          {children}
        </div>
        <p className="mt-12 text-sm text-slate-500">
          Questions?{" "}
          <Link href="/login" className="text-sky-600 hover:underline">
            Sign in
          </Link>{" "}
          to manage your account, or contact support through your account settings.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
