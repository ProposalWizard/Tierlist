/**
 * lib/publish/auth.ts — SERVER ONLY. Who may use the Publish routes:
 *   admin  signed in with an admin account (the Marketing check, lib/marketing/caller.ts)
 *   agent  a Claude chat, with header x-publish-agent = PUBLISH_AGENT_TOKEN (Vercel). The token is saved in the
 *          chat's cloud environment as a network secret, never in the repo or the chat.
 *          Locked to its owner (Mikey, 20 Nov 2026: "lock it to me"): when PUBLISH_OWNER_EMAIL is set in Vercel
 *          (one address, or several split by commas), only an admin signed in with that address gets in.
 *          Unset = every admin, as before. The address lives in Vercel, never in the repo.
 *   cron   the database's 5-minute timer, with header x-publish-cron = PUBLISH_CRON_SECRET (Vercel), or
 *          Vercel Cron's own "Authorization: Bearer CRON_SECRET".
 */
import { timingSafeEqual } from "node:crypto";
import { getCaller } from "@/lib/marketing/caller";
import type { Space } from "./types";

export type Who = { kind: "admin"; name: string; id: string; email?: string } | { kind: "agent"; name: "chat" } | { kind: "cron"; name: "timer" };

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const secret = (name: string) => { const v = process.env[name]?.trim(); return v && v.length >= 16 ? v : null; };

/** The Publish owner lock: true when no owner is set, or the signed-in address is one of them. */
export function ownerOk(email: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const owners = (env.PUBLISH_OWNER_EMAIL ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !owners.length || (!!email && owners.includes(email.trim().toLowerCase()));
}

export async function whoIs(req: Request, allow: Who["kind"][]): Promise<Who | null> {
  const h = req.headers;
  if (allow.includes("agent")) {
    // The chat's key comes as x-publish-agent, or as "Authorization: Bearer <key>" (the form cloud chats save keys with).
    const want = secret("PUBLISH_AGENT_TOKEN"), got = h.get("x-publish-agent"), auth = h.get("authorization");
    if (want && ((got && same(got, want)) || (auth && same(auth, `Bearer ${want}`)))) return { kind: "agent", name: "chat" };
  }
  if (allow.includes("cron")) {
    const want = secret("PUBLISH_CRON_SECRET"), got = h.get("x-publish-cron");
    if (want && got && same(got, want)) return { kind: "cron", name: "timer" };
    const vc = secret("CRON_SECRET"), auth = h.get("authorization");
    if (vc && auth && same(auth, `Bearer ${vc}`)) return { kind: "cron", name: "timer" };
  }
  if (allow.includes("admin")) { const c = await getCaller(); if (c?.admin) return { kind: "admin", name: c.name, id: c.id, email: c.email }; }
  return null;
}

/**
 * May this caller use this space? football and content are Mikey's own (the PUBLISH_OWNER_EMAIL lock); kib is the
 * team's (every admin). The chat (its key) and the timer may use every space.
 */
export function mayUse(who: Who | null, space: Space): boolean {
  if (!who) return false;
  if (who.kind !== "admin") return true;
  return space === "kib" ? true : ownerOk(who.email);
}
export const NOT_YOURS = "Only the owner of this space can use it (PUBLISH_OWNER_EMAIL); the Knowitball space is open to every admin.";

/** The site's own address, for the login round trips (must match what is registered with Meta and Google). */
export const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin).replace(/\/$/, "");
export const callbackUrl = (req: Request, platform: "meta" | "youtube") => `${siteUrl(req)}/api/admin/publish/callback/${platform}`;
