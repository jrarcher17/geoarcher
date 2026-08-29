export const CREATIVE_FORMATS = [
  "square",
  "landscape",
  "portrait",
  "story",
  "feed",
  "display",
] as const;

export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];

export const CREATIVE_PLATFORMS = ["META", "GOOGLE", "AI_CHAT"] as const;
export type CreativePlatform = (typeof CREATIVE_PLATFORMS)[number];

export const CONCEPT_ANGLES = [
  "Pain relief",
  "Recovery",
  "Convenience",
  "Scientific",
  "Performance",
  "Portability",
  "Time savings",
  "Premium",
  "Social proof",
  "Problem/solution",
] as const;

export type ConceptAngle = (typeof CONCEPT_ANGLES)[number];

export interface FormatSpec {
  id: CreativeFormat;
  label: string;
  /** CSS aspect-ratio */
  ratio: string;
  /** dall-e-3 size */
  imageSize: "1024x1024" | "1792x1024" | "1024x1792";
  note: string;
}

export const FORMAT_SPECS: Record<CreativeFormat, FormatSpec> = {
  square: {
    id: "square",
    label: "Square",
    ratio: "1 / 1",
    imageSize: "1024x1024",
    note: "1:1 — Instagram / Meta feed",
  },
  landscape: {
    id: "landscape",
    label: "Landscape",
    ratio: "1.91 / 1",
    imageSize: "1792x1024",
    note: "1.91:1 — link ads and landscape placements",
  },
  portrait: {
    id: "portrait",
    label: "Portrait",
    ratio: "4 / 5",
    imageSize: "1024x1792",
    note: "4:5 — Meta feed portrait",
  },
  story: {
    id: "story",
    label: "Story",
    ratio: "9 / 16",
    imageSize: "1024x1792",
    note: "9:16 — Stories and Reels",
  },
  feed: {
    id: "feed",
    label: "Feed",
    ratio: "1 / 1",
    imageSize: "1024x1024",
    note: "1:1 — Meta / Instagram feed default",
  },
  display: {
    id: "display",
    label: "Display",
    ratio: "1.91 / 1",
    imageSize: "1792x1024",
    note: "1.91:1 — Google Display-style",
  },
};

export function isCreativeFormat(v: unknown): v is CreativeFormat {
  return typeof v === "string" && (CREATIVE_FORMATS as readonly string[]).includes(v);
}

export function isCreativePlatform(v: unknown): v is CreativePlatform {
  return typeof v === "string" && (CREATIVE_PLATFORMS as readonly string[]).includes(v);
}
