/**
 * lib/publish/auth.ts — SERVER ONLY. Who may use the Publish routes:
 *   admin  signed in with an admin account (the Marketing check, lib/marketing/caller.ts)
 *   agent  a Claude chat, with header x-publish-agent = PUBLISH_AGENT_TOKEN (Vercel). The token is saved in the
 *          chat's cloud environment as a network secret, never in the repo or the chat.
 *   cron   the database's 5-minute timer, with header x-publish-cron = PUBLISH_CRON_SECRET (Vercel), or
 *          Vercel Cron's own "Authorization: Bearer CRON_SECRET".
 */
import { timingSafeEqual } from "node:crypto";
import { getCaller } from "@/lib/marketing/caller";

export type Who = { kind: "admin"; name: string; id: string } | { kind: "agent"; name: "chat" } | { kind: "cron"; name: "timer" };

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const secret = (name: string) => { const v = process.env[name]?.trim(); return v && v.length >= 16 ? v : null; };

export async function whoIs(req: Request, allow: Who["kind"][]): Promise<Who | null> {
  const h = req.headers;
  if (allow.includes("agent")) { const want = secret("PUBLISH_AGENT_TOKEN"), got = h.get("x-publish-agent"); if (want && got && same(got, want)) return { kind: "agent", name: "chat" }; }
  if (allow.includes("cron")) {
    const want = secret("PUBLISH_CRON_SECRET"), got = h.get("x-publish-cron");
    if (want && got && same(got, want)) return { kind: "cron", name: "timer" };
    const vc = secret("CRON_SECRET"), auth = h.get("authorization");
    if (vc && auth && same(auth, `Bearer ${vc}`)) return { kind: "cron", name: "timer" };
  }
  if (allow.includes("admin")) { const c = await getCaller(); if (c?.admin) return { kind: "admin", name: c.name, id: c.id }; }
  return null;
}

/** The site's own address, for the login round trips (must match what is registered with Meta and Google). */
export const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin).replace(/\/$/, "");
export const callbackUrl = (req: Request, platform: "meta" | "youtube") => `${siteUrl(req)}/api/admin/publish/callback/${platform}`;
