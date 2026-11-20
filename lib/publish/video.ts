/**
 * lib/publish/video.ts — SERVER ONLY. The video to post is a file in the Marketing storage (Cloudflare R2,
 * Marketing → Uploads). Each platform is handed a signed link that works for 6 hours: Instagram and Facebook
 * fetch the file themselves; YouTube is fed it by the site. Nothing is ever public for longer than that.
 */
import { isVideoKey, mediaOf, r2Url } from "@/lib/marketing/r2";
import { locate, storeOf } from "./storage";

export const LINK_SECONDS = 6 * 60 * 60;

export async function videoForPosting(key: string, now = new Date()): Promise<{ url: string; size: number; type: string }> {
  const where = locate(key); key = where.key;
  if (!isVideoKey(key)) throw new Error("That is not a video in storage.");
  const store = storeOf(where.source);
  if (!store || !store.config) throw new Error(where.source === "own" ? "Your own video storage (PUBLISH_R2_ settings) is not connected here." : "Marketing storage (R2) is not connected here.");
  const head = await store.head(key);
  if (!head) throw new Error("The video is no longer in storage.");
  const type = mediaOf(key)?.mime ?? "video/mp4";
  const url = r2Url(store.config, "GET", key, now, LINK_SECONDS, { query: { "response-content-type": type } });
  return { url, size: head.size, type };
}
