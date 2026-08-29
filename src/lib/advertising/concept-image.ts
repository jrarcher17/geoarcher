import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import type { OfferingDetails } from "@/lib/advertising/types";

/**
 * Generate an advertising concept image. Labeled as AI-generated —
 * not a photo from the scanned website and not a real product shot.
 */
export async function generateConceptImage(input: {
  offeringId: string;
  angle?: string;
  headline?: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
}): Promise<{ url: string; alt: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to generate concept images."
    );
  }

  const offering = await prisma.offering.findUnique({
    where: { id: input.offeringId },
    select: { name: true, description: true, details: true },
  });
  if (!offering) throw new Error("Product not found.");
  const details = (offering.details ?? {}) as OfferingDetails;

  const prompt = [
    "Create an original advertising concept image. Abstract or lifestyle mood — not a product photograph, not a screenshot, no logos, no readable text.",
    `Category: ${details.category || "software / service"}.`,
    `Mood inspired by: ${input.angle || input.headline || offering.name}.`,
    "Do not depict a specific real product. This is a concept, not a catalog photo.",
  ].join(" ");

  const client = new OpenAI();
  const model = process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3";
  const res = await client.images.generate({
    model,
    prompt,
    size: input.size ?? "1024x1024",
    response_format: "b64_json",
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("The image model returned no image.");
  }

  const dir = path.join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const file = path.join(dir, `${id}.png`);
  await writeFile(file, Buffer.from(b64, "base64"));

  return {
    url: `/generated/${id}.png`,
    alt: "AI-generated concept — not a photo from the website",
  };
}
