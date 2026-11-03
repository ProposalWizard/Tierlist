/**
 * NO POST TALKS ABOUT A VIDEO IT DOES NOT SHOW (Leo, 31 Oct 2026: "NO MORE
 * TWEETS ABOUT VIDEOS THAT DONT HAVE VIDEOS U CAN WATCH").
 *
 * `impliesVideo` reads a post's words the way a person would: does this line
 * point at something to watch (a clip, an edit, a replay, "watch this", a
 * stream, 🎥)? With the switch part "footballTwitter" on, feed.ts never keeps
 * such a post unless it carries a playable goal video (`hasPlayableVideo`).
 * tests/star/feedVideoRule.mts scans seasons of posts with the same words.
 */
import type { GraphicSpec, StoredPost } from "../types";

const VIDEO_WORDS = new RegExp([
  "\\bvideos?\\b", "\\bclips?\\b", "\\bclipping (this|it|that)\\b", "\\bedits?\\b", "\\bedited\\b",
  "\\bwatch\\b", "\\bwatch(ed)? (it|this|that) back\\b", "\\breplays?\\b", "\\bfootage\\b", "\\bfilmed\\b",
  "\\bslow[- ]?mo\\b", "\\b(this|that|another|the other|every) angle\\b", "\\bhighlights?\\b", "\\bsound on\\b", "\\breel\\b",
  "\\bstream\\b", "\\bstreaming\\b", "\\blive now\\b", "\\blive reaction\\b", "\\bfull reaction\\b",
  "\\breact(s)? live\\b", "\\bon the channel\\b", "\\bpov\\b", "\\bwait for it\\b", "\\bduet\\b", "\\bstitch\\b",
  "\\bpress play\\b", "\\brewind\\b", "\\bon (a )?loop\\b", "\\bframe by frame\\b", "\\bcamera\\b", "\\bcam\\b",
  "🎥", "📹", "📼", "▶", "🎞",
].join("|"), "i");

/** Do these words point at something to watch? */
export function impliesVideo(text: string): boolean {
  return VIDEO_WORDS.test(text);
}

/** A goal video with at least one goal in it (recorded or made). */
export function graphicPlays(g: GraphicSpec | undefined): boolean {
  if (!g) return false;
  const v = g as { type?: string; clips?: unknown[]; synth?: unknown[] };
  if (v.type === "gotmPoll") return true; // the Goal of the Month card plays each goal
  if (v.type !== "goalVideo" && v.type !== "thumbnail") return false;
  return ((v.clips?.length ?? 0) + (v.synth?.length ?? 0)) > 0;
}

/** The post shows a playable video: its own, or the one it quotes. */
export function hasPlayableVideo(p: Pick<StoredPost, "graphic" | "quote">): boolean {
  return graphicPlays(p.graphic) || graphicPlays(p.quote?.graphic);
}

/** Every piece of text on a post that could mention a video. */
export function postWords(p: Pick<StoredPost, "text" | "quote" | "thread">): string {
  return [p.text, ...(p.thread ?? []).map(r => r.text)].join("\n");
}

/** Breaks Leo's rule: talks about a video and shows none. */
export function breaksVideoRule(p: StoredPost): boolean {
  return impliesVideo(postWords(p)) && !hasPlayableVideo(p);
}
