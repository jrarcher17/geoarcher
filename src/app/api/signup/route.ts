import { NextResponse } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signUpDisabled } from "@/lib/sign-up-config";

function newId(size = 32) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof APIError) {
    const body = error.body as { message?: string } | undefined;
    return body?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function POST(request: Request) {
  if (signUpDisabled()) {
    return NextResponse.json(
      { error: "New registrations are currently closed." },
      { status: 403 }
    );
  }

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email.includes("@") || password.length < 8) {
    return NextResponse.json(
      { error: "Name, a valid email, and a password (8+ characters) are required." },
      { status: 400 }
    );
  }

  try {
    const ctx = await auth.$context;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        accounts: {
          where: { providerId: "credential" },
          select: { id: true, password: true },
        },
        sessions: { select: { id: true }, take: 1 },
      },
    });

    const credential = existing?.accounts[0];
    if (credential?.password) {
      const matches = await ctx.password
        .verify({ hash: credential.password, password })
        .catch(() => false);
      if (matches) {
        return NextResponse.json({ ok: true });
      }
      if (existing && existing.sessions.length > 0) {
        return NextResponse.json(
          { error: "User already exists. Use another email." },
          { status: 409 }
        );
      }
    }

    const userId = existing?.id ?? newId();
    if (!existing) {
      await prisma.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: false,
        },
      });
    }

    const hash = await ctx.password.hash(password);
    if (credential) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password: hash },
      });
    } else {
      await prisma.account.create({
        data: {
          id: newId(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hash,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[signup]", error);
    return NextResponse.json(
      { error: apiErrorMessage(error, "Sign up failed.") },
      { status: 500 }
    );
  }
}
