/**
 * /api/admin/publish — Marketing → Publish (lib/publish/*).
 *   GET   the connected accounts (names only, never tokens), the latest posts with their results and numbers,
 *         and the videos in Marketing storage to pick from. Admins, or a chat with the agent token.
 *   POST  queue a post: {video_key, title?, captions: {instagram?, facebook?, youtube?} | caption, platforms,
 *         scheduled_at? (ISO; default now)}. The timer posts it when due; "now" posts within 5 minutes.
 */
import { NextResponse } from "next/server";
import { whoIs } from "@/lib/publish/auth";
import { accountViews, insertPost, listPosts } from "@/lib/publish/db";
import { PLATFORMS, type Platform } from "@/lib/publish/types";
import { getStorage } from "@/lib/marketing/storage";
import { isVideoKey, itemsFromList, mediaOf } from "@/lib/marketing/r2";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  if (!who) return json({ error: "Admins only." }, 403);
  const out: Record<string, unknown> = { setup: setupState() };
  try { out.accounts = await accountViews(); out.posts = await listPosts(); } catch (e) { out.error = (e as Error).message; out.accounts = []; out.posts = []; }
  try {
    const store = getStorage();
    out.videos = store.mode === "r2" ? itemsFromList(await store.list("videos/")).filter((v) => v.kind === "video").slice(0, 200) : [];
    out.storage = store.mode;
  } catch (e) { out.videos = []; out.storageError = (e as Error).message; }
  return json(out);
}

export async function POST(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  if (!who) return json({ error: "Admins only." }, 403);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Send the post as JSON." }, 400);
  const key = b.video_key;
  if (!isVideoKey(key) || mediaOf(key)?.kind !== "video") return json({ error: "Pick a video from Marketing storage." }, 400);
  const platforms = Array.isArray(b.platforms) ? PLATFORMS.filter((p) => (b.platforms as unknown[]).includes(p)) as Platform[] : [];
  if (!platforms.length) return json({ error: "Tick at least one platform." }, 400);
  const one = typeof b.caption === "string" ? b.caption : "";
  const given = (b.captions && typeof b.captions === "object" ? b.captions : {}) as Record<string, unknown>;
  const captions: Partial<Record<Platform, string>> = {};
  for (const p of PLATFORMS) { const c = typeof given[p] === "string" ? (given[p] as string) : one; if (c) captions[p] = c.slice(0, p === "youtube" ? 5000 : 2200); }
  const when = typeof b.scheduled_at === "string" && !Number.isNaN(Date.parse(b.scheduled_at)) ? new Date(b.scheduled_at) : new Date();
  const title = (typeof b.title === "string" ? b.title : "").trim().slice(0, 100);
  if (platforms.includes("youtube") && !title) return json({ error: "YouTube needs a title." }, 400);
  try {
    const post = await insertPost({ video_key: key, title, captions, platforms, scheduled_at: when.toISOString(), created_by: who.name });
    return json({ post });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
}

/** Which settings are in place (names only), so the page can say what is missing. */
function setupState() {
  const has = (n: string) => !!process.env[n]?.trim();
  return {
    tables: true,
    tokenKey: has("PUBLISH_TOKEN_KEY"),
    meta: has("META_APP_ID") && has("META_APP_SECRET"),
    google: has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET"),
    cron: has("PUBLISH_CRON_SECRET"),
    agent: has("PUBLISH_AGENT_TOKEN"),
    storage: has("R2_ACCOUNT_ID") && has("R2_ACCESS_KEY_ID") && has("R2_SECRET_ACCESS_KEY") && has("R2_BUCKET"),
  };
}
