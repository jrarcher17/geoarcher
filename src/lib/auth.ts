import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { signUpDisabled } from "./sign-up-config";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const email =
        typeof ctx.body === "object" && ctx.body && "email" in ctx.body
          ? String((ctx.body as { email?: unknown }).email ?? "")
              .trim()
              .toLowerCase()
          : "";
      if (!email) return;

      const existing = await prisma.user.findUnique({
        where: { email },
        include: {
          accounts: { select: { id: true } },
          userSites: { select: { id: true } },
          leadCampaigns: { select: { id: true } },
        },
      });
      if (
        existing &&
        existing.accounts.length === 0 &&
        existing.userSites.length === 0 &&
        existing.leadCampaigns.length === 0
      ) {
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: signUpDisabled(),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    "https://geoarcher.com",
    "https://www.geoarcher.com",
  ],
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
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
