import Link from "next/link";
import { Check } from "lucide-react";
import { BrandWordmark } from "@/components/BrandWordmark";

const PITCH = [
  {
    title: "Scan the business, not just the URL",
    detail: "GEO Archer reads the site and identifies products, services, and images you can advertise.",
  },
  {
    title: "Generate Google and Meta ads",
    detail: "Copy is grounded in what the website already says. You review before anything publishes.",
  },
  {
    title: "Approve every change",
    detail: "The AI assistant can recommend campaigns. You decide what goes live.",
  },
] as const;

export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[34%] shrink-0 flex-col overflow-hidden bg-[#0a0a0a] text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex h-full flex-col px-10 py-8">
          <Link href="/" className="w-fit">
            <BrandWordmark variant="dark" />
          </Link>

          <div className="flex flex-1 flex-col justify-center py-16">
            <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-[2.15rem]">
              Turn a website into advertising.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-400">
              Scan a site, understand the business, and generate campaigns from
              what it already says.
            </p>
            <ul className="mt-10 space-y-5">
              {PITCH.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-zinc-500">
            © {new Date().getFullYear()} GEO Archer
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <Link href="/" className="mb-8 lg:hidden">
          <BrandWordmark />
        </Link>
        <div className="w-full max-w-[440px] rounded-2xl border border-slate-200/90 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
