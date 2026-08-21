import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { SignupForm } from "@/components/auth/SignupForm";
import { signUpDisabled } from "@/lib/sign-up-config";

export const metadata: Metadata = {
  title: "Sign up — GEO Archer",
  description: "Create your GEO Archer account",
};

export default function SignupPage() {
  if (signUpDisabled()) {
    redirect("/login");
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        Start tracking how AI assistants see your sites.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
    </AuthSplitLayout>
  );
}
