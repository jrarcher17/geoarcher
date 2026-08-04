import { ScanForm } from "@/components/ScanForm";

export default function Home() {
  return (
    <main className="flex-1 px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="brand-wordmark mb-6">
          Geo<span className="brand-wordmark-accent">Archer</span>
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Become the answer in{" "}
          <span className="text-sky-500">AI assistants</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-500">
          Stop asking how to rank #1 on Google. See your website the way
          ChatGPT, Claude, Gemini, and Perplexity see it — then fix what they
          can&apos;t understand.
        </p>
        <div className="mt-10">
          <ScanForm />
        </div>
        <div className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
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
              title: "Competitor compare",
              body: "Stack your GEO and understanding scores against up to five rival sites.",
            },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <h3 className="mb-1 text-sm font-semibold text-slate-900">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
