import Image from "next/image";
import { Globe } from "lucide-react";
import { hostOf } from "@/lib/utils";

/** Responsive-search-ad style preview using the first few headlines. */
export function GoogleAdPreview({
  headlines,
  descriptions,
  landingPage,
  path1,
  path2,
}: {
  headlines: string[];
  descriptions: string[];
  landingPage: string;
  path1?: string;
  path2?: string;
}) {
  const shown = headlines.slice(0, 3);
  const host = hostOf(landingPage);
  const displayPath = [path1, path2].filter(Boolean).join("/");
  return (
    <div className="border border-slate-200 bg-white p-5">
      <div className="max-w-xl">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-slate-900">Sponsored</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <Globe className="h-3.5 w-3.5 text-slate-500" />
          </span>
          <div className="leading-tight">
            <p className="text-sm text-slate-800">
              {host}
              {displayPath ? `/${displayPath}` : ""}
            </p>
            <p className="text-xs text-slate-500">{landingPage}</p>
          </div>
        </div>
        <p className="mt-1.5 text-xl leading-snug text-[#1a0dab]">
          {shown.join(" | ") || "Your headlines appear here"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">
          {descriptions[0] ?? "Your description appears here."}
        </p>
      </div>
    </div>
  );
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  GET_QUOTE: "Get quote",
  CONTACT_US: "Contact us",
  BOOK_NOW: "Book now",
  SHOP_NOW: "Shop now",
  SUBSCRIBE: "Subscribe",
  GET_OFFER: "Get offer",
};

/** Facebook/Instagram feed or story preview. */
export function MetaAdPreview({
  businessName,
  primaryText,
  headline,
  description,
  cta,
  imageUrl,
  landingPage,
  format = "feed",
  imageLabel,
}: {
  businessName: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageUrl: string | null;
  landingPage: string;
  format?: "feed" | "story";
  imageLabel?: string | null;
}) {
  if (format === "story") {
    return (
      <div className="mx-auto w-full max-w-[280px] overflow-hidden border border-slate-200 bg-slate-900">
        <div className="relative aspect-[9/16] bg-slate-800">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageLabel ?? ""}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
              No image selected
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-[11px] text-white/70">{businessName} · Sponsored</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {headline || "Headline"}
            </p>
            {description && (
              <p className="mt-1 text-xs text-white/80">{description}</p>
            )}
            <span className="mt-3 inline-block bg-white px-3 py-1.5 text-xs font-medium text-slate-900">
              {CTA_LABELS[cta] ?? "Learn more"}
            </span>
          </div>
        </div>
        {imageLabel && (
          <p className="bg-slate-900 px-3 py-2 text-[10px] text-slate-400">{imageLabel}</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {businessName.slice(0, 1).toUpperCase()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{businessName}</p>
          <p className="text-xs text-slate-400">Sponsored</p>
        </div>
      </div>
      <p className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-slate-800">
        {primaryText || "Your primary text appears here."}
      </p>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageLabel ?? ""}
          width={640}
          height={335}
          unoptimized
          className="max-h-72 w-full bg-slate-100 object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-400">
          No image selected
        </div>
      )}
      {imageLabel && (
        <p className="px-4 pt-2 text-[11px] text-slate-400">{imageLabel}</p>
      )}
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {hostOf(landingPage)}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {headline || "Headline"}
          </p>
          {description && (
            <p className="truncate text-xs text-slate-500">{description}</p>
          )}
        </div>
        <span className="shrink-0 bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800">
          {CTA_LABELS[cta] ?? "Learn more"}
        </span>
      </div>
    </div>
  );
}

/** ChatGPT-style conversation + sponsored card preview. */
export function AiAdPreview({
  advertiser,
  headline,
  description,
  prompt,
  answer,
  followUp,
  landingPage,
  intents,
  imageUrl,
  imageLabel,
}: {
  advertiser?: string;
  headline?: string;
  description?: string;
  prompt?: string;
  answer?: string;
  followUp?: string | null;
  landingPage?: string;
  intents?: string[];
  imageUrl?: string | null;
  imageLabel?: string | null;
}) {
  if (!prompt && !answer && !headline) {
    return (
      <div className="max-w-md border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-900">AI / ChatGPT</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
          Generate ads with ChatGPT selected to preview the chat card. Publish
          from a Ready campaign after you connect ChatGPT Ads.
        </p>
      </div>
    );
  }
  return (
    <div className="max-w-md border border-slate-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        ChatGPT Ads preview
      </p>
      {prompt && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            You
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{prompt}</p>
        </div>
      )}
      {answer && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Recommended answer
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {answer}
          </p>
          {followUp && (
            <p className="mt-3 text-xs text-slate-400">Follow-up · {followUp}</p>
          )}
        </div>
      )}
      {(headline || description || advertiser) && (
        <div className="mt-4 border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Sponsored recommendation
          </p>
          {imageUrl && (
            <div className="relative mt-2">
              <Image
                src={imageUrl}
                alt={imageLabel ?? headline ?? advertiser ?? ""}
                width={400}
                height={220}
                unoptimized
                className="h-36 w-full bg-white object-cover"
              />
              {imageLabel && (
                <p className="mt-1 text-[10px] text-slate-400">{imageLabel}</p>
              )}
            </div>
          )}
          {advertiser && (
            <p className="mt-2 text-xs font-medium text-slate-500">{advertiser}</p>
          )}
          {headline && (
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{headline}</p>
          )}
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          )}
          {landingPage && (
            <p className="mt-2 truncate text-[11px] text-slate-400">
              {hostOf(landingPage)}
            </p>
          )}
          {(intents ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {intents!.map((intent) => (
                <li
                  key={intent}
                  className="bg-white px-1.5 py-0.5 text-[10px] text-slate-500"
                >
                  {intent}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
