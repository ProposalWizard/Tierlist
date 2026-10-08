/**
 * WHICH VIDEO AN ACCOUNT POSTS (lib/star/goalClip/edit.ts). Pure, so the
 * feed's tests can check it without a browser.
 */
import type { ClipStyle } from "../goalClip/edit";
import type { StoredPost } from "./types";

/** Who posted it — the kind of video they post. */
export type PostAuthor = Pick<StoredPost["author"], "handle" | "name" | "archetype" | "platform">;

/**
 * The kind of goal video an account posts. Official accounts post the TV
 * pictures with replays from other cameras; pages and papers lead with
 * another angle; fans and team-mates post it filmed on a phone in the stand;
 * meme pages and TikTok accounts post a TikTok edit (slow-mo, captions).
 */
export function clipStyleFor(author?: PostAuthor): ClipStyle {
  if (!author) return "broadcast";
  if (author.platform === "tiktok") return "tiktok";
  switch (author.archetype) {
    case "club": case "league": case "competition": return "broadcast";
    case "meme": return "tiktok";
    case "fan": case "rivalFan": case "teammate": return "fan";
    default: return "reverse";
  }
}

/** Which of its cuts an account uses: fixed per account, so each one has a
 *  house style and two accounts rarely post the same video. */
export function clipVariantFor(author?: PostAuthor): number {
  const key = author?.handle ?? "";
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

