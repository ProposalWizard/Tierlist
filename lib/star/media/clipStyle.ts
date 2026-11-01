/**
 * WHICH VIDEO AN ACCOUNT POSTS (lib/star/goalClip/edit.ts). Pure, so the
 * feed's tests can check it without a browser.
 */
import type { ClipStyle } from "../goalClip/edit";
import type { StoredPost } from "./types";

/** Who posted it — the kind of video they post. `persona` (Football Twitter's
 *  account type, StoredPost.persona) is optional and only read by the better
 *  videos. */
export type PostAuthor = Pick<StoredPost["author"], "handle" | "name" | "archetype" | "platform"> & { persona?: string };

/**
 * The kind of goal video an account posts. Official accounts post the TV
 * pictures with replays from other cameras; pages and papers lead with
 * another angle; fans and team-mates post it filmed on a phone in the stand;
 * meme pages and TikTok accounts post a TikTok edit (slow-mo, captions).
 *
 * `better` (Leo's switch part "betterVideos", read at the call site): clip
 * pages, scores apps and stats pages post a highlights reel instead, and the
 * Football Twitter personas pick their own (BETTER_BY_PERSONA). Off: exactly
 * as before.
 */
export function clipStyleFor(author?: PostAuthor, better = false, cold = false, postKey = ""): ClipStyle {
  // Cold edits (Leo's switch part "coldEdits", read at the call site): edit
  // pages, POV and meme pages, numbers pages post the new edits. Off: never.
  if (cold && author) {
    const c = coldClipStyleFor(author, postKey);
    if (c) return c;
  }
  if (better && author) return betterClipStyleFor(author);
  if (!author) return "broadcast";
  if (author.platform === "tiktok") return "tiktok";
  switch (author.archetype) {
    case "club": case "league": case "competition": return "broadcast";
    case "meme": return "tiktok";
    case "fan": case "rivalFan": case "teammate": return "fan";
    default: return "reverse";
  }
}

/** Football Twitter personas (lib/star/media/twitter/personas.ts ids) → their video. */
export const BETTER_BY_PERSONA: Record<string, ClipStyle> = {
  // Edit and hype pages: the TikTok edit.
  edits: "tiktok", hype: "tiktok", meme: "tiktok", ratio: "tiktok", nostalgia: "tiktok", quiz: "tiktok",
  // TV channels and the club's own account: the broadcast with replays.
  breaking: "broadcast", clubAdmin: "broadcast",
  // Clip accounts, scores apps, numbers pages: the highlights reel and its card.
  clips: "highlights", scores: "highlights", xg: "highlights", facts: "highlights", fantasy: "highlights",
  wonderkid: "highlights", odds: "highlights", ref: "highlights",
  // Supporters: filmed on a phone in the stand.
  fanTV: "fan", womenFan: "fan", kidFan: "fan", neutral: "fan", groundhopper: "fan", rivalBanter: "fan",
  // Papers, insiders, pundits, podcasts: the pages' cut (another angle, slow-mo).
  insider: "reverse", aggregator: "reverse", journalist: "reverse", itk: "reverse", agent: "reverse",
  gossip: "reverse", ranter: "reverse", readsGame: "reverse", takes: "reverse", tactics: "reverse",
  expro: "reverse", pod: "reverse",
  // Football Twitter v2 accounts.
  pov: "tiktok", ranker: "tiktok", commentBot: "tiktok", matchday: "tiktok", sundayLeague: "tiktok",
  commsQuotes: "broadcast",
  rater: "highlights", priceBot: "highlights", history: "highlights", refWatch: "highlights",
  streamer: "fan", atmosphere: "fan", ticketMoan: "fan", spainFan: "fan", italyFan: "fan",
  exproPundit: "reverse", kitLeaks: "reverse", tier2: "reverse", rumourMill: "reverse",
};

/** The better videos' style: persona first, then platform, then archetype. */
export function betterClipStyleFor(author: PostAuthor): ClipStyle {
  const byPersona = author.persona ? BETTER_BY_PERSONA[author.persona] : undefined;
  if (byPersona) return byPersona;
  if (author.platform === "tiktok" || /edit|loops|tok/i.test(author.handle)) return "tiktok";
  switch (author.archetype) {
    case "club": case "league": case "competition": return "broadcast";
    case "meme": return "tiktok";
    case "fan": case "rivalFan": case "teammate": return "fan";
    case "aggregator": case "stats": return "highlights";
    default: return "reverse";
  }
}

/**
 * Cold edits (switch part "coldEdits", goalClip/editCold.ts): which accounts
 * post them. An edit page has several kinds and posts a different one per
 * goal (picked from the post's goals, `postKey`), so the feed never shows the
 * same kind twice in a row from one page. A montage of one goal is the angles
 * edit; a cold or angles edit of several goals is the montage.
 */
export const COLD_BY_PERSONA: Record<string, ClipStyle[]> = {
  // Edit pages: every kind.
  edits: ["cold", "aura", "angles", "rewind", "cold", "montage"],
  hype: ["aura", "cold", "aura"],
  pov: ["cold", "aura", "angles"],
  matchday: ["cold", "angles", "montage"],
  commentBot: ["cold", "rewind"],
  // Meme pages: the rewind ("wait… run it back").
  meme: ["rewind", "cold"], ratio: ["rewind"], nostalgia: ["rewind"], sundayLeague: ["rewind"],
  // Numbers pages: the stat card.
  ranker: ["statCard", "cold"], xg: ["statCard"], facts: ["statCard"], rater: ["statCard"], quiz: ["statCard"],
  wonderkid: ["statCard", "montage"],
  // Clip pages: every angle, every goal.
  clips: ["angles", "montage"],
  // Young fans and streamers make aura edits.
  kidFan: ["aura"], streamer: ["cold", "aura"],
};

/** A post's goals as one string: picks which cold edit a page posts of them. */
export function coldPostKey(clips: readonly string[] = [], synth: readonly { seed: string }[] = []): string {
  return `${clips.join(",")}|${synth.map(g => g.seed).join(",")}`;
}

/** The cold edit an account posts, or undefined (it posts what it did before). */
export function coldClipStyleFor(author: PostAuthor, postKey = ""): ClipStyle | undefined {
  const list = author.persona ? COLD_BY_PERSONA[author.persona]
    : author.platform === "tiktok" || /edit|loops|tok/i.test(author.handle) ? ["cold", "aura", "angles", "montage", "rewind"] as ClipStyle[]
    : author.archetype === "meme" ? ["rewind", "cold"] as ClipStyle[]
    : author.archetype === "stats" ? ["statCard"] as ClipStyle[]
    : undefined;
  if (!list?.length) return undefined;
  let h = 2166136261;
  const key = `${author.handle}|${postKey}`;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return list[(h >>> 0) % list.length];
}

/** Which of its cuts an account uses: fixed per account, so each one has a
 *  house style and two accounts rarely post the same video. */
export function clipVariantFor(author?: PostAuthor): number {
  const key = author?.handle ?? "";
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
