/**
 * lib/publish/crypto.ts — SERVER ONLY. The platform login tokens are encrypted before they go in the database
 * (AES-256-GCM). The key is PUBLISH_TOKEN_KEY in Vercel: any long random string (it is hashed to 32 bytes).
 * Without it nothing is stored, so a database leak alone never leaks a usable token.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.PUBLISH_TOKEN_KEY?.trim();
  if (!raw || raw.length < 16) throw new Error("PUBLISH_TOKEN_KEY is not set in Vercel (any long random string).");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("A stored token is not readable. Connect the account again.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/** A random state for a login round trip (checked against a cookie on the way back). */
export const newState = () => randomBytes(18).toString("base64url");
