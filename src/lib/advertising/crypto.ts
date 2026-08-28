import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "v1";

function keyBytes(): Buffer {
  const raw =
    process.env.AD_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();
  if (!raw) {
    throw new Error(
      "Set AD_TOKEN_ENCRYPTION_KEY (or BETTER_AUTH_SECRET) to encrypt ad-platform tokens."
    );
  }
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Output is `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, b64(iv), b64(tag), b64(encrypted)].join(".");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Unrecognized token encoding.");
  }
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function b64(buf: Buffer): string {
  return buf.toString("base64url");
}
