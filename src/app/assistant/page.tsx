import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SectionLabel } from "@/components/os/primitives";

const EXAMPLES = [
  "How are my ads doing?",
  "Which campaign is wasting the most money?",
  "Create three new ads for my best service.",
  "Why did my CPA increase this week?",
  "Compare Google and Meta performance.",
  "Which service should I advertise next?",
];

export default function AssistantPage() {
  return (
    <AppShell
      title="AI Assistant"
      subtitle="Ask questions about your advertising and delegate campaign work — with your approval on anything that spends money."
    >
      <div className="border border-slate-200 bg-white p-6 sm:p-8">
        <SectionLabel>In development</SectionLabel>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          A conversational layer over your campaigns
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          The assistant uses controlled backend tools — it can read your campaign
          data, generate ads and propose changes, but every action that affects
          spend requires your explicit approval and is logged to an audit trail.
          It ships after campaign management and analytics are live, so it has
          real data to work with.
        </p>
        <div className="mt-6">
          <SectionLabel>Things you&apos;ll be able to ask</SectionLabel>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((q) => (
              <li
                key={q}
                className="border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">
          <Link href="/ad-studio" className="btn-secondary text-sm">
            Meanwhile, create campaigns in Ad Studio
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
