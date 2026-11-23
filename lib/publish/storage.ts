/**
 * lib/publish/storage.ts — SERVER ONLY. Where Publish keeps and finds videos (Mikey, 20 Nov 2026: "this is
 * personal ... my own videos and social media accounts", kept apart from the team's Marketing bucket).
 *   own  Mikey's own Cloudflare bucket: PUBLISH_R2_ACCOUNT_ID, PUBLISH_R2_ACCESS_KEY_ID,
 *        PUBLISH_R2_SECRET_ACCESS_KEY, PUBLISH_R2_BUCKET in Vercel. Uploads from Publish go here. Its keys
 *        are stored with the "own:" mark in front, so the queue always knows which bucket a video is in.
 *   kib  the team's Marketing bucket (R2_* settings, Marketing → Uploads), for Knowitball videos.
 */
import { getStorage, r2Storage } from "@/lib/marketing/storage";
import { isVideoKey, mediaOf, r2ConfigFrom } from "@/lib/marketing/r2";
import type { Storage } from "@/lib/marketing/mediaApi";

export const OWN = "own:";
export type Source = "own" | "kib";

export function ownStorage(): Storage | null {
  const { config } = r2ConfigFrom(process.env, "PUBLISH_R2_");
  return config ? r2Storage(config) : null;
}
export function kibStorage(): Storage | null {
  const s = getStorage();
  return s.mode === "r2" && s.config ? s : null;
}
/** Split a queued key into its bucket and the plain key. */
export function locate(key: string): { source: Source; key: string } {
  return key.startsWith(OWN) ? { source: "own", key: key.slice(OWN.length) } : { source: "kib", key };
}
export const storeOf = (source: Source) => (source === "own" ? ownStorage() : kibStorage());
/** A key Publish can post: a video in either bucket. */
export function isPublishVideo(key: unknown): key is string {
  if (typeof key !== "string") return false;
  const k = locate(key).key;
  return isVideoKey(k) && mediaOf(k)?.kind === "video";
}
/** Uploads go to Mikey's bucket when it is set up, else the team's. */
export function uploadTarget(): { source: Source; store: Storage } | null {
  const own = ownStorage(); if (own) return { source: "own", store: own };
  const kib = kibStorage(); return kib ? { source: "kib", store: kib } : null;
}
