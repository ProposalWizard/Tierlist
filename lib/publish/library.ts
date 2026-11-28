/**
 * lib/publish/library.ts — PURE (no network, no database). The words kept for a video in Marketing → Library
 * (table marketing_videos, supabase/migrations/marketing_library.sql): name, why, titles, captions and hashtags per app.
 * Used by the server routes, the Library page and the Publish page, so all three agree on what a video's words are.
 * Tested in tests/star/marketingLibrary.mts.
 */
import type { Platform } from "./types";

/** TikTok is not in the posting tool yet, but its caption is kept so it can be copied and posted by hand. */
export const WORD_APPS = ["instagram", "facebook", "youtube", "tiktok"] as const;
export type WordApp = (typeof WORD_APPS)[number];
export const APP_NAMES: Record<WordApp, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" };

export interface VideoDetails {
  name: string;
  why: string;
  series: string;
  len_label: string;
  made_on: string | null;
  titles: Partial<Record<"youtube" | "facebook", string>>;
  captions: Partial<Record<WordApp, string>>;
  tags: Partial<Record<WordApp, string>>;
}

export const EMPTY_DETAILS: VideoDetails = { name: "", why: "", series: "", len_label: "", made_on: null, titles: {}, captions: {}, tags: {} };

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dateOrNull = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

/** Anything a person or a chat sends, cleaned to the shape the table holds (lengths capped, unknown keys dropped). */
export function cleanDetails(raw: unknown): VideoDetails {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (src: unknown, keys: readonly string[], max: number) => {
    const s = (src && typeof src === "object" ? src : {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const k of keys) { const t = text(s[k], max); if (t) out[k] = t; }
    return out;
  };
  return {
    name: text(o.name, 140), why: text(o.why, 600), series: text(o.series, 40), len_label: text(o.len_label, 12), made_on: dateOrNull(o.made_on),
    titles: pick(o.titles, ["youtube", "facebook"], 100),
    captions: pick(o.captions, WORD_APPS, 5000),
    tags: pick(o.tags, WORD_APPS, 600),
  };
}

/** The caption with its hashtags, the way it is posted: caption, a blank line, the tags. */
export function fullCaption(d: Pick<VideoDetails, "captions" | "tags"> | null | undefined, app: WordApp): string {
  if (!d) return "";
  const c = d.captions[app] ?? "", t = d.tags[app] ?? "";
  return [c, t].filter(Boolean).join("\n\n");
}

/** The title for an app (YouTube and Facebook have one); falls back to the other one, then the video's name. */
export function titleFor(d: Pick<VideoDetails, "titles" | "name"> | null | undefined, app: "youtube" | "facebook"): string {
  if (!d) return "";
  return d.titles[app] || d.titles[app === "youtube" ? "facebook" : "youtube"] || d.name || "";
}

/** How much of a video's words are filled in: used for the "needs details" tag. */
export function isFilledIn(d: VideoDetails | null | undefined): boolean {
  if (!d) return false;
  return !!d.name && WORD_APPS.some((a) => !!d.captions[a]);
}

/** Library search: every word typed must appear in the name, file name, series or why (case does not matter). */
export function matchesSearch(q: string, parts: (string | undefined)[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** A file name without its storage stamp ("20261127-135820-5b17-ex19-name.mp4" → "ex19-name.mp4"). */
export const fileLabel = (key: string): string => key.split("/").pop()?.replace(/^\d{8}-\d{6}-[a-z0-9]{4}-/, "") ?? key;

/** Total views across the apps for one post's results (Instagram/YouTube "views", Facebook "views" or "plays"). */
export function viewsOf(results: Partial<Record<Platform, { stats?: Record<string, number> }>> | undefined): number {
  if (!results) return 0;
  let n = 0;
  for (const p of ["instagram", "facebook", "youtube"] as const) {
    const s = results[p]?.stats; if (!s) continue;
    n += Number(s.views ?? s.plays ?? 0) || 0;
  }
  return n;
}
