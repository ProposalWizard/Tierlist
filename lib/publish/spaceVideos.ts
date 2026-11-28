/**
 * lib/publish/spaceVideos.ts — SERVER ONLY. The videos in one space's storage (Mikey's own bucket for football and
 * content, the team's Cloudflare bucket for kib), newest first, each with the key the posting queue uses.
 * The one place that decides this, so the Publish page and the Library page always list the same videos.
 */
import { itemsFromList, type MediaItem } from "@/lib/marketing/r2";
import { OWN, listPrefixes, uploadTarget } from "./storage";
import type { Space } from "./types";

export type SpaceVideo = MediaItem & { source: "own" | "kib" };

export async function listSpaceVideos(space: Space): Promise<{ videos: SpaceVideo[]; storage: "own" | "kib" | "off"; error?: string }> {
  const target = uploadTarget(space);
  if (!target) return { videos: [], storage: "off" };
  const videos: SpaceVideo[] = [];
  const errors: string[] = [];
  for (const prefix of listPrefixes(space)) {
    try {
      for (const v of itemsFromList(await target.store.list(prefix)).filter((x) => x.kind === "video"))
        videos.push({ ...v, key: (target.source === "own" ? OWN : "") + v.key, source: target.source });
    } catch (e) { errors.push((e as Error).message); }
  }
  videos.sort((a, b) => String(b.uploaded).localeCompare(String(a.uploaded)));
  return { videos: videos.slice(0, 500), storage: target.source, ...(errors.length ? { error: errors.join(" ") } : {}) };
}
