export type GuideSlug =
  | "what-is-geo"
  | "visibility-scoring"
  | "competitor-benchmarks";

export interface GuideStat {
  value: string;
  label: string;
  detail?: string;
}

export interface GuideChart {
  title: string;
  caption: string;
  horizontal?: boolean;
  variant?: "grouped";
  data: Record<string, string | number>[];
}

export interface GuideSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface GuideArticle {
  slug: GuideSlug;
  tag: string;
  title: string;
  summary: string;
  readMinutes: number;
  heroStats: GuideStat[];
  urgency: { title: string; body: string };
  chart: GuideChart;
  sections: GuideSection[];
  framework?: {
    title: string;
    items: { name: string; desc: string }[];
  };
  pullQuote: { text: string; attribution: string };
  sources: { label: string; note: string; href?: string }[];
  cta: { title: string; body: string; button: string };
}

export const GUIDE_ARTICLES: Record<GuideSlug, GuideArticle> = {
  "what-is-geo": {
    slug: "what-is-geo",
    tag: "GEO",
    title: "What generative engine optimization actually measures",
    summary:
      "GEO is how you stay visible when buyers stop clicking links and start asking AI. Here is what to measure, why it matters now, and what happens if your site is opaque to machines.",
    readMinutes: 12,
    heroStats: [
      {
        value: "~40%",
        label: "Visibility lift (research)",
        detail:
          "Aggarwal et al. (Princeton, Allen AI, Georgia Tech, IIT Delhi) report up to ~40% gains from targeted GEO-style edits on GEO-bench.",
      },
      {
        value: "25%",
        label: "Search volume shift",
        detail:
          "Gartner forecast: traditional search volume could fall 25% by 2026 as AI chatbots absorb queries.",
      },
      {
        value: "13",
        label: "GEO score components",
        detail:
          "GEO Archer breaks readiness into concrete factors: clarity, structure, schema, depth, trust signals, and more.",
      },
      {
        value: "1 crawl",
        label: "Full semantic map",
        detail:
          "One GEO-powered crawl reveals how assistants infer topics, entities, and gaps — not just a sitemap.",
      },
    ],
    urgency: {
      title: "If AI cannot explain your business, you do not exist in the answer",
      body: "Traditional SEO metrics can look fine while ChatGPT, Claude, Gemini, Perplexity, and Copilot still summarize you wrong — or pick a competitor who wrote clearer pages. GEO measures that failure mode before revenue does.",
    },
    chart: {
      title: "Where B2B research is shifting (illustrative mix)",
      caption:
        "Directional view of AI-assisted research share (illustrative). Gartner has publicly forecast a material decline in traditional search volume by 2026 as assistants absorb queries.",
      data: [
        { name: "2022", value: 12, fill: "#94a3b8" },
        { name: "2024", value: 28, fill: "#38bdf8" },
        { name: "2026", value: 45, fill: "#0ea5e9" },
      ],
    },
    sections: [
      {
        heading: "GEO is not SEO with a new acronym",
        body: "Search-engine optimization optimizes for ranked links. Generative engine optimization optimizes for being understood, trusted, and cited when there is no page-one list — only a single synthesized answer. That requires explicit definitions, structured facts, comparison content, FAQs, proof, and machine-readable signals. Rankings without clarity still lose in AI.",
        bullets: [
          "SEO asks: “Do we rank?” GEO asks: “Would an assistant recommend us accurately?”",
          "Thin service pages and marketing fluff score poorly on AI Understanding even with strong backlinks.",
          "GEO rewards the same content your best sales rep would use to explain what you do in 60 seconds.",
        ],
      },
      {
        heading: "What academic and industry work already shows",
        body: "Researchers studying generative engines — including the 2023 GEO paper (Aggarwal, Murahari, Rajpurohit, Kalyan, Narasimhan, Deshpande; Princeton, Allen Institute for AI, Georgia Tech, IIT Delhi) — showed that specific content interventions can measurably shift how often content appears in generated answers. Tested tactics include citing sources, adding statistics, quotations, and improving fluency; keyword stuffing did not transfer from classic SEO. GEO Archer turns that research into scores and shippable tasks on your domain.",
        bullets: [
          "Optimizations target visibility inside the model’s answer, not just click-through.",
          "Small, factual content additions often outperform keyword stuffing.",
          "Sites that define terms and scope beat sites that assume the reader already knows the category.",
        ],
      },
      {
        heading: "What GEO Archer measures on your site",
        body: "Each scan runs a GEO-powered crawl, builds a semantic map of topics and subtopics, and scores AI Understanding (can an assistant state what you do, for whom, and where?) plus a 13-part GEO score. We surface missing FAQs, weak entity coverage, schema holes, ambiguous positioning, and pages that humans read fine but models cannot parse.",
        bullets: [
          "Semantic map: primary topic, subtopics, and concepts — not a flat URL list.",
          "Recommendations: prioritized actions with impact/effort, tied to real pages.",
          "Rescans: prove movement when you ship fixes — executives see trend, not vibes.",
        ],
      },
      {
        heading: "The cost of waiting",
        body: "Every month your competitors add comparison pages, pricing transparency, and FAQ depth tuned for AI, their Understanding and visibility scores compound. You are not fighting Google alone anymore — you are fighting whoever the model already trusts. Waiting for “more AI data” means ceding default answers to rivals who moved first.",
      },
    ],
    framework: {
      title: "The GEO Archer score stack (what “good” looks like)",
      items: [
        {
          name: "AI Understanding",
          desc: "Confidence an assistant could answer who you are, what you sell, and who it is for — from your site alone.",
        },
        {
          name: "GEO score (13 components)",
          desc: "Structured audit across clarity, depth, citability, schema, technical signals, and content completeness.",
        },
        {
          name: "Visibility modeling",
          desc: "Per-assistant likelihood you would surface for realistic buyer prompts in your niche.",
        },
        {
          name: "Action plan",
          desc: "Ordered fixes — FAQs, comparisons, schema, copy — mapped to the pages that block citations.",
        },
      ],
    },
    pullQuote: {
      text: "The winners in generative search will not be the sites with the most traffic — they will be the sites machines can quote without hallucinating.",
      attribution: "GEO Archer research synthesis",
    },
    sources: [
      {
        label: "GEO: Generative Engine Optimization (arXiv)",
        href: "https://arxiv.org/abs/2311.09735",
        note: "Foundational paper introducing GEO, GEO-bench (~10K queries), and measured visibility lifts from content edits.",
      },
      {
        label: "GEO project & benchmark (generative-engines.com)",
        href: "https://generative-engines.com/GEO/",
        note: "Authors’ project page with paper links and benchmark context.",
      },
      {
        label: "Gartner — search volume vs. AI agents (2024)",
        href: "https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents",
        note: "Enterprise framing for why discovery is moving off classic SERPs — use for strategy, not as a vendor guarantee.",
      },
      {
        label: "Search Engine Land — GEO framework overview",
        href: "https://searchengineland.com/generative-engine-optimization-framework-introduced-research-paper-435855",
        note: "Accessible summary of the research and why lower-SERP sites can gain disproportionately from GEO tactics.",
      },
      {
        label: "Run your own baseline — GEO Archer",
        href: "/#analyze",
        note: "Illustrative charts on this page are benchmarks; your crawl is the decision data.",
      },
    ],
    cta: {
      title: "See your GEO score on your URL — not a generic benchmark",
      body: "Free tier: one site, full scoring pipeline. Know exactly where assistants would stumble before a prospect asks them.",
      button: "Analyze my site",
    },
  },
  "visibility-scoring": {
    slug: "visibility-scoring",
    tag: "Visibility",
    title: "Multi-assistant visibility scoring explained",
    summary:
      "One crawl, five assistant personas — because ChatGPT, Claude, Gemini, Perplexity, and Copilot do not all “see” your brand the same way. Learn how to read the scores and what to fix first.",
    readMinutes: 10,
    heroStats: [
      {
        value: "5",
        label: "Assistants modeled",
        detail: "ChatGPT, Claude, Gemini, Perplexity, and Copilot — from one crawl.",
      },
      {
        value: "75+",
        label: "Strong visibility band",
        detail: "Scores in this range mean assistants likely surface you for on-topic prompts.",
      },
      {
        value: "Gap",
        label: "Understanding vs visibility",
        detail:
          "High visibility with low understanding is a hallucination risk — fix clarity first.",
      },
    ],
    urgency: {
      title: "A single “AI score” hides how you lose deals",
      body: "You might look fine to one assistant persona and invisible to another — especially models that weight live citations (Perplexity-style) versus structured facts (Copilot-style). Multi-assistant scoring exposes that split before a buyer chooses a vendor inside the chat window.",
    },
    chart: {
      title: "Example: visibility by assistant (same company, one scan)",
      caption:
        "Illustrative output shape from GEO Archer. Your real scan may show a different spread — that spread is the insight.",
      horizontal: true,
      data: [
        { name: "ChatGPT", value: 72, fill: "#0ea5e9" },
        { name: "Claude", value: 68, fill: "#8b5cf6" },
        { name: "Gemini", value: 61, fill: "#f59e0b" },
        { name: "Perplexity", value: 54, fill: "#10b981" },
        { name: "Copilot", value: 58, fill: "#64748b" },
      ],
    },
    sections: [
      {
        heading: "Why we model five assistants separately",
        body: "Users do not pick one AI — they use whichever tool their company approved, their browser bundled, or their habit prefers. Each system emphasizes different signals: citation density, structured data, recency, brand mentions, or conversational brevity. GEO Archer simulates those personas against the same crawl so you see where your story breaks per channel.",
        bullets: [
          "One weak assistant score = one channel where competitors become the default answer.",
          "Visibility without Understanding means you might be mentioned incorrectly.",
          "Fix content once; rescan to see which personas moved.",
        ],
      },
      {
        heading: "What the numbers mean (and what they do not)",
        body: "Scores are modeled likelihoods from your public site content — not live API calls to OpenAI, Anthropic, Google, or Microsoft. That keeps scans fast, repeatable, and compliant. Treat them as diagnostic MRIs: they show structural problems and relative strength, not a guaranteed ranking in tomorrow’s model version.",
        bullets: [
          "Low scores usually mean missing pages, not a penalty box.",
          "Large spreads between assistants point to specific content types to add.",
          "Track trends across rescans after you ship recommendations.",
        ],
      },
      {
        heading: "Prompts buyers actually type",
        body: "Visibility runs consider realistic questions: “best [service] in [city],” “how much does [X] cost,” “[vendor A] vs [vendor B],” and problem-led queries. If your site cannot answer those in crawlable text, models fill gaps with guesses — often from competitors who published FAQs and comparison tables.",
      },
      {
        heading: "Playbook: raise visibility without spam",
        body: "Ship authoritative FAQs with real scope and pricing bands (even ranges), add comparison pages that name alternatives fairly, strengthen About and service-area copy, and implement schema that matches visible text. GEO Archer’s simulation and visibility tabs show which assistant moves when you fix each gap.",
        bullets: [
          "Use the AI Visibility tab per site after each scan.",
          "Pair with Recommendations for ordered execution.",
          "Export PDF reports for stakeholders who do not live in the dashboard.",
        ],
      },
    ],
    pullQuote: {
      text: "Being ‘in ChatGPT’ is not a strategy. Being correctly cited when it matters — that is visibility.",
      attribution: "GEO Archer visibility methodology",
    },
    sources: [
      {
        label: "GEO paper — visibility metrics (arXiv)",
        href: "https://arxiv.org/abs/2311.09735",
        note: "Defines generative engines and black-box visibility optimization; basis for modern GEO scorecards.",
      },
      {
        label: "OpenAI — ChatGPT search",
        href: "https://openai.com/index/introducing-chatgpt-search/",
        note: "How a major assistant blends web retrieval with synthesis — one persona GEO Archer models.",
      },
      {
        label: "Google — AI Overviews in Search",
        href: "https://developers.google.com/search/docs/appearance/ai-features",
        note: "Google’s public explanation of AI-generated summaries atop search — another discovery surface.",
      },
      {
        label: "Perplexity — how answers use sources",
        href: "https://www.perplexity.ai/hub/blog/getting-started-with-perplexity",
        note: "Citation-forward answers; visibility often tracks who publishes quotable, scoped facts.",
      },
      {
        label: "AI Visibility in GEO Archer",
        href: "/visibility",
        note: "Per-assistant modeled scores from your crawl after sign-in.",
      },
    ],
    cta: {
      title: "Run visibility on your domain",
      body: "See per-assistant scores and the prompts that expose your gaps — then fix them before the next RFP lands in someone’s chat thread.",
      button: "Start a visibility scan",
    },
  },
  "competitor-benchmarks": {
    slug: "competitor-benchmarks",
    tag: "Competitors",
    title: "Benchmark rivals for AI answers, not blue links",
    summary:
      "Google rank is the wrong scoreboard. Compare GEO score, understanding, and visibility-style signals against up to five rivals on the same framework — and see who wins the AI answer before you do.",
    readMinutes: 11,
    heroStats: [
      {
        value: "5",
        label: "Competitors per scan",
        detail: "Same crawl rules, same scoring — no apples-to-oranges SEO tools.",
      },
      {
        value: "500",
        label: "Pro competitor pages",
        detail: "Deep crawls for large rival sites; Free tier uses a focused budget.",
      },
      {
        value: "Side-by-side",
        label: "GEO + understanding",
        detail: "See who assistants would trust when both brands are compared in one prompt.",
      },
    ],
    urgency: {
      title: "Your competitor’s FAQ page is stealing your citations",
      body: "In generative answers, the clearest site wins — not the oldest domain. If a rival explains pricing, process, and proof better, assistants default to them when buyers ask neutral questions. Benchmarking shows that gap in numbers, not opinion.",
    },
    chart: {
      title: "Example: you vs top rival (same category scan)",
      caption:
        "Illustrative GEO Archer competitor output. Your scan replaces example data with live rival URLs you choose.",
      variant: "grouped",
      data: [
        { name: "GEO score", you: 71, rival: 84 },
        { name: "Understanding", you: 68, rival: 79 },
        { name: "Visibility (avg)", you: 62, rival: 76 },
      ],
    },
    sections: [
      {
        heading: "Why SERP rank misleads you now",
        body: "A competitor can rank below you on Google yet look more authoritative to an AI because they publish structured comparisons, transparent service pages, and FAQ depth. Benchmarking on GEO signals reveals that hidden lead — the one that shows up when a prospect asks an assistant for a short list.",
        bullets: [
          "Compare up to five URLs on a completed primary scan.",
          "Each competitor run uses the same GEO-powered crawl framework.",
          "Competitor scans count toward your monthly scan allowance — plan accordingly.",
        ],
      },
      {
        heading: "What to do when you are behind",
        body: "Do not copy their marketing fluff — copy their information architecture: what questions they answer, how they scope services, where they show proof. GEO Archer maps gaps to recommendations so your team ships pages that close specific score deltas, not generic blog posts.",
        bullets: [
          "If they win on comparison content, publish a fair ‘why us’ and ‘vs’ page.",
          "If they win on understanding, rewrite hero copy and service definitions.",
          "If they win on visibility, add FAQs that match real buyer prompts.",
        ],
      },
      {
        heading: "When you are ahead — do not coast",
        body: "Leads erode fast when rivals run their own GEO programs. Rescan quarterly (or on Pro, more often) to catch new competitor pages. Treat benchmarks like product telemetry: alert the team when a rival crosses your GEO score.",
      },
      {
        heading: "Executive story in one slide",
        body: "Export site PDF reports with scores and competitor context for board or client meetings. The narrative is simple: AI discovery is reallocating trust; here is our position, here is the gap, here is the fix list with owners.",
      },
    ],
    framework: {
      title: "Competitor benchmark checklist",
      items: [
        {
          name: "Pick true alternatives",
          desc: "URLs buyers would mention in the same breath as you — not random big brands.",
        },
        {
          name: "Complete your scan first",
          desc: "Primary site must finish so comparisons attach to a stable baseline.",
        },
        {
          name: "Read the gap, not the ego",
          desc: "Lower score is a content roadmap, not a judgment on your team.",
        },
        {
          name: "Rescan after shipping",
          desc: "Prove delta to leadership; tie wins to specific pages you published.",
        },
      ],
    },
    pullQuote: {
      text: "In AI-mediated markets, second place is ‘never mentioned.’ Benchmark before that becomes your quarterly revenue miss.",
      attribution: "GEO Archer competitor practice",
    },
    sources: [
      {
        label: "GEO research — smaller sites can gain vs. SERP leaders",
        href: "https://arxiv.org/abs/2311.09735",
        note: "Paper reports lower-SERP sites can see larger visibility gains from cite-sources and related tactics than top-ranked pages.",
      },
      {
        label: "Gartner — buyers use multiple channels (AI included)",
        href: "https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents",
        note: "Context for why benchmark gaps translate to lost shortlists, not just lost clicks.",
      },
      {
        label: "Competitor benchmarks in GEO Archer",
        href: "/competitors",
        note: "Add rivals on a completed scan; same GEO framework as your primary site.",
      },
      {
        label: "Start a comparative scan",
        href: "/#analyze",
        note: "Free tier includes focused crawls; Pro expands depth for large competitor sites.",
      },
    ],
    cta: {
      title: "Benchmark your rivals on your next scan",
      body: "Add competitor URLs after your primary crawl completes. See who owns the AI answer in your category today.",
      button: "Analyze my site",
    },
  },
};

export const GUIDES_LIST = Object.values(GUIDE_ARTICLES);

export function getGuide(slug: string): GuideArticle | null {
  if (slug in GUIDE_ARTICLES) {
    return GUIDE_ARTICLES[slug as GuideSlug];
  }
  return null;
}

export const GUIDES = GUIDES_LIST.map((g) => ({
  tag: g.tag,
  title: g.title,
  summary: g.summary,
  href: `/guides/${g.slug}`,
}));
