import Image from "next/image";
import { FORMAT_SPECS, type CreativeFormat } from "@/lib/advertising/creative-formats";

export function CreativeLayout({
  format,
  imageUrl,
  headline,
  description,
  cta,
  imageLabel,
}: {
  format: CreativeFormat;
  imageUrl: string | null;
  headline: string;
  description: string;
  cta: string;
  imageLabel: string;
}) {
  const spec = FORMAT_SPECS[format];
  const tall = format === "story" || format === "portrait";
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div
        className="relative mx-auto w-full overflow-hidden bg-slate-200"
        style={{
          aspectRatio: spec.ratio,
          maxWidth: tall ? "18rem" : "100%",
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageLabel}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            Select a website photo or generate an AI concept to preview this
            layout.
          </div>
        )}
        {imageUrl && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-16">
            {headline && (
              <p className="text-base font-semibold leading-snug text-white">
                {headline}
              </p>
            )}
            {description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85">
                {description}
              </p>
            )}
            {cta && (
              <span className="mt-3 inline-block bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                {cta}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{imageLabel}</p>
    </div>
  );
}
