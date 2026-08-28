import Image from "next/image";
import { Globe } from "lucide-react";
import { hostOf } from "@/lib/utils";

/** Responsive-search-ad style preview using the first few headlines. */
export function GoogleAdPreview({
  headlines,
  descriptions,
  landingPage,
}: {
  headlines: string[];
  descriptions: string[];
  landingPage: string;
}) {
  const shown = headlines.slice(0, 3);
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
            <p className="text-sm text-slate-800">{hostOf(landingPage)}</p>
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

/** Facebook/Instagram feed-ad style preview. */
export function MetaAdPreview({
  businessName,
  primaryText,
  headline,
  description,
  cta,
  imageUrl,
  landingPage,
}: {
  businessName: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageUrl: string | null;
  landingPage: string;
}) {
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
          alt=""
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

/** Honest placeholder — no official AI-platform ad APIs exist yet. */
export function AiAdPreview() {
  return (
    <div className="max-w-md border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">AI / ChatGPT</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
        Advertising opportunities inside AI platforms will be supported as
        official advertising APIs become available.
      </p>
      <span className="mt-4 inline-flex bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        Coming Soon
      </span>
    </div>
  );
}
