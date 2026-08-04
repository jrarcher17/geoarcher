import { headers } from "next/headers";
import { auth } from "./auth";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user.id ?? null;
}
