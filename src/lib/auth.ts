import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { signUpDisabled } from "./sign-up-config";

function authBaseURL(): string {
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
}

/** Share the session cookie across geoarcher.com and www.geoarcher.com. */
function authCookieDomain(): string | undefined {
  const explicit = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
  if (explicit) return explicit.replace(/^\./, "");
  try {
    const { hostname } = new URL(authBaseURL());
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return undefined;
    }
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return undefined;
  }
}

const cookieDomain = authCookieDomain();
const useSecureCookies = authBaseURL().startsWith("https://");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    useSecureCookies,
    ...(cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
  },
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
    authBaseURL(),
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
