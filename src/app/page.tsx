import { ScanForm } from "@/components/ScanForm";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm font-mono uppercase tracking-widest text-emerald-400 mb-4">
          GeoArcher
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Become the answer in{" "}
          <span className="text-emerald-400">AI assistants</span>
        </h1>
        <p className="text-neutral-400 text-lg mb-10 leading-relaxed">
          Stop asking how to rank #1 on Google. See your website the way
          ChatGPT, Claude, Gemini, and Perplexity see it — then fix what they
          can&apos;t understand.
        </p>
        <ScanForm />
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            {
              title: "AI Website Crawl",
              body: "We crawl your site and build the semantic map AI sees: concepts, not pages.",
            },
            {
              title: "AI Understanding Score",
              body: "How confidently can an AI say what you do, for whom, and where?",
            },
            {
              title: "GEO Score + Fixes",
              body: "13-component GEO audit with specific, non-generic recommendations.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
