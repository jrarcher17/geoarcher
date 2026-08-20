import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { signUpDisabled } from "./sign-up-config";

function signupEmailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = "email" in body ? body.email : null;
  return typeof email === "string" && email.includes("@")
    ? email.trim().toLowerCase()
    : null;
}

function authTrustedOrigins(): string[] {
  const configured = [
    process.env.BETTER_AUTH_URL,
    "http://localhost:3000",
    "https://geoarcher.com",
    "https://www.geoarcher.com",
  ].filter((value): value is string => Boolean(value?.trim()));

  const origins = new Set<string>();
  for (const value of configured) {
    try {
      const url = new URL(value);
      const port = url.port ? `:${url.port}` : "";
      origins.add(`${url.protocol}//${url.hostname}${port}`);
      if (url.hostname.startsWith("www.")) {
        origins.add(`${url.protocol}//${url.hostname.slice(4)}${port}`);
      } else if (url.hostname !== "localhost" && !url.hostname.endsWith(".localhost")) {
        origins.add(`${url.protocol}//www.${url.hostname}${port}`);
      }
    } catch {
      origins.add(value.replace(/\/$/, ""));
    }
  }
  return [...origins];
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: signUpDisabled(),
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const email = signupEmailFromBody(ctx.body);
      if (!email) return;
      const existing = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          accounts: { select: { id: true }, take: 1 },
        },
      });
      // A previous attempt can persist the user row and then fail before the
      // password account is written. Treat that as unfinished signup.
      if (existing && existing.accounts.length === 0) {
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }),
  },
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      plan: {
        type: "string",
        required: false,
        defaultValue: "FREE",
        input: false,
      },
    },
  },
  trustedOrigins: authTrustedOrigins(),
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
