import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
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
    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        accounts: {
          where: { providerId: "credential" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (existing?.accounts.length) {
      return NextResponse.json(
        { error: "User already exists. Use another email." },
        { status: 409 }
      );
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

    await prisma.account.create({
      data: {
        id: newId(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(password),
      },
    });

    const session = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    return NextResponse.json({
      token: session.token,
      user: session.user,
    });
  } catch (error) {
    console.error("[signup]", error);
    return NextResponse.json(
      { error: apiErrorMessage(error, "Sign up failed.") },
      { status: 500 }
    );
  }
}
