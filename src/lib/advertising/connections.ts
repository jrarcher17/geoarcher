import { prisma } from "@/lib/db";
import type { AdOAuthPlatform } from "@/lib/advertising/oauth";
import { toDbPlatform } from "@/lib/advertising/oauth";
import {
  exchangeGoogleCode,
  listGoogleAccounts,
  persistGoogleTokens,
  readGoogleAccess,
  readGoogleRefresh,
  refreshGoogleAccess,
} from "@/lib/advertising/platforms/google";
import {
  exchangeMetaCode,
  listMetaAccounts,
  persistMetaTokens,
  readMetaAccess,
} from "@/lib/advertising/platforms/meta";
import { callbackUrl } from "@/lib/advertising/oauth";
import type { AdAccountOption } from "@/lib/advertising/platforms/google";

export async function completeOAuth(
  userId: string,
  platform: AdOAuthPlatform,
  code: string
): Promise<{ accountId: string | null; accountName: string | null; accounts: AdAccountOption[] }> {
  const dbPlatform = toDbPlatform(platform);
  const tokens =
    platform === "google"
      ? persistGoogleTokens(await exchangeGoogleCode(code, callbackUrl("google")))
      : persistMetaTokens(await exchangeMetaCode(code, callbackUrl("meta")));

  await prisma.adPlatformConnection.upsert({
    where: { userId_platform: { userId, platform: dbPlatform } },
    create: {
      userId,
      platform: dbPlatform,
      status: "CONNECTED",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      error: null,
    },
    update: {
      status: "CONNECTED",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      error: null,
    },
  });

  let accounts: AdAccountOption[] = [];
  try {
    const access =
      platform === "google"
        ? readGoogleAccess(tokens.accessToken)
        : readMetaAccess(tokens.accessToken);
    accounts =
      platform === "google"
        ? await listGoogleAccounts(access)
        : await listMetaAccounts(access);
  } catch (err) {
    await prisma.adPlatformConnection.update({
      where: { userId_platform: { userId, platform: dbPlatform } },
      data: {
        error: err instanceof Error ? err.message : "Could not list ad accounts.",
      },
    });
    return { accountId: null, accountName: null, accounts: [] };
  }

  const single = accounts.length === 1 ? accounts[0] : null;
  await prisma.adPlatformConnection.update({
    where: { userId_platform: { userId, platform: dbPlatform } },
    data: {
      accountId: single?.id ?? null,
      accountName: single?.name ?? null,
      error: accounts.length === 0 ? "No accessible ad accounts on this login." : null,
    },
  });

  return {
    accountId: single?.id ?? null,
    accountName: single?.name ?? null,
    accounts,
  };
}

export async function disconnectPlatform(userId: string, platform: AdOAuthPlatform) {
  await prisma.adPlatformConnection.upsert({
    where: { userId_platform: { userId, platform: toDbPlatform(platform) } },
    create: {
      userId,
      platform: toDbPlatform(platform),
      status: "DISCONNECTED",
    },
    update: {
      status: "DISCONNECTED",
      accountId: null,
      accountName: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      scopes: null,
      error: null,
    },
  });
}

export async function selectAccount(
  userId: string,
  platform: AdOAuthPlatform,
  accountId: string,
  accountName: string
) {
  await prisma.adPlatformConnection.update({
    where: { userId_platform: { userId, platform: toDbPlatform(platform) } },
    data: { accountId, accountName, error: null },
  });
}

export async function getLiveAccessToken(
  userId: string,
  platform: AdOAuthPlatform
): Promise<{ accessToken: string; accountId: string; accountName: string | null }> {
  const row = await prisma.adPlatformConnection.findUnique({
    where: { userId_platform: { userId, platform: toDbPlatform(platform) } },
  });
  if (!row || row.status !== "CONNECTED" || !row.accessToken) {
    throw new Error(
      platform === "google"
        ? "Connect Google Ads in Integrations first."
        : "Connect Meta in Integrations first."
    );
  }
  if (!row.accountId) {
    throw new Error("Select an ad account in Integrations before publishing.");
  }

  if (platform === "google") {
    const needsRefresh =
      row.expiresAt != null && row.expiresAt.getTime() < Date.now() + 60_000;
    if (needsRefresh) {
      const refresh = readGoogleRefresh(row.refreshToken);
      if (!refresh) throw new Error("Google Ads connection expired. Reconnect it.");
      const next = persistGoogleTokens(await refreshGoogleAccess(refresh));
      await prisma.adPlatformConnection.update({
        where: { id: row.id },
        data: {
          accessToken: next.accessToken,
          refreshToken: next.refreshToken ?? row.refreshToken,
          expiresAt: next.expiresAt,
          error: null,
        },
      });
      return {
        accessToken: readGoogleAccess(next.accessToken),
        accountId: row.accountId,
        accountName: row.accountName,
      };
    }
    return {
      accessToken: readGoogleAccess(row.accessToken),
      accountId: row.accountId,
      accountName: row.accountName,
    };
  }

  return {
    accessToken: readMetaAccess(row.accessToken),
    accountId: row.accountId,
    accountName: row.accountName,
  };
}

export async function listAccountsForConnection(
  userId: string,
  platform: AdOAuthPlatform
): Promise<AdAccountOption[]> {
  try {
    const live = await prisma.adPlatformConnection.findUnique({
      where: { userId_platform: { userId, platform: toDbPlatform(platform) } },
    });
    if (!live?.accessToken || live.status !== "CONNECTED") return [];
    const access =
      platform === "google"
        ? readGoogleAccess(live.accessToken)
        : readMetaAccess(live.accessToken);
    return platform === "google"
      ? await listGoogleAccounts(access)
      : await listMetaAccounts(access);
  } catch {
    return [];
  }
}
