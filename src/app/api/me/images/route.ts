import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { userOwnsSite } from "@/lib/user-plan";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

async function saveSiteImage(input: {
  siteId: string;
  offeringId: string | null;
  url: string;
  alt: string | null;
}) {
  return prisma.siteImage.upsert({
    where: { siteId_url: { siteId: input.siteId, url: input.url } },
    create: {
      siteId: input.siteId,
      offeringId: input.offeringId,
      url: input.url,
      alt: input.alt,
    },
    update: {
      offeringId: input.offeringId ?? undefined,
      alt: input.alt ?? undefined,
    },
  });
}

function asClient(row: {
  id: string;
  url: string;
  alt: string | null;
  pageUrl: string | null;
  offeringId: string | null;
}) {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    pageUrl: row.pageUrl,
    offeringId: row.offeringId,
  };
}

/**
 * Add a photo the crawl missed — remote URL or uploaded file — so Ad Studio
 * can use it as creative. Never invents an image.
 */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const siteId = String(form.get("siteId") ?? "");
      const offeringIdRaw = String(form.get("offeringId") ?? "");
      const file = form.get("file");
      if (!siteId || !(file instanceof File)) {
        return NextResponse.json(
          { error: "siteId and an image file are required." },
          { status: 400 }
        );
      }
      if (!(await userOwnsSite(access.userId, siteId))) {
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      }
      if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "Upload a JPEG, PNG, WebP, or GIF under 8 MB." },
          { status: 400 }
        );
      }
      const offeringId = offeringIdRaw || null;
      if (offeringId) {
        const offering = await prisma.offering.findFirst({
          where: { id: offeringId, siteId },
          select: { id: true },
        });
        if (!offering) {
          return NextResponse.json({ error: "Product not found." }, { status: 404 });
        }
      }
      const dir = path.join(process.cwd(), "public", "generated", "uploads");
      await mkdir(dir, { recursive: true });
      const id = randomUUID();
      const filename = `${id}.${extFor(file.type)}`;
      await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      const url = `/generated/uploads/${filename}`;
      const row = await saveSiteImage({
        siteId,
        offeringId,
        url,
        alt: file.name.replace(/\.[^.]+$/, "") || "Uploaded ad creative",
      });
      return NextResponse.json(asClient(row));
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const siteId = typeof body?.siteId === "string" ? body.siteId : "";
    const offeringId =
      typeof body?.offeringId === "string" && body.offeringId
        ? body.offeringId
        : null;
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!siteId || !rawUrl) {
      return NextResponse.json(
        { error: "siteId and an image URL are required." },
        { status: 400 }
      );
    }
    if (!(await userOwnsSite(access.userId, siteId))) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Enter a valid image URL." }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Enter an http(s) image URL." }, { status: 400 });
    }
    if (offeringId) {
      const offering = await prisma.offering.findFirst({
        where: { id: offeringId, siteId },
        select: { id: true },
      });
      if (!offering) {
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }
    }
    const row = await saveSiteImage({
      siteId,
      offeringId,
      url: parsed.toString(),
      alt: typeof body?.alt === "string" ? body.alt.trim() || null : null,
    });
    return NextResponse.json(asClient(row));
  } catch (err) {
    console.error("[images] add failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add the image." },
      { status: 500 }
    );
  }
}
