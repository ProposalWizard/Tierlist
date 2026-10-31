/**
 * YOUR MATCH'S VIDEOS ARE MADE AT FULL TIME (speed pass, 22 Oct 2026).
 *
 * The feed's goal videos used to be started only when the feed opened, so the
 * first one was ready about 12 s later on a slow phone. Now, the moment the
 * match's posts are written (page.tsx, at full time), the posts about YOUR
 * match (the highlights, your goals) start being made in the video worker.
 * The result screens take longer than that, so by the time the feed opens the
 * video is kept on the phone and plays at once.
 *
 * Everything here must match how the post itself asks for its video
 * (components/star/media/Graphics.tsx → GoalVideo.tsx), or the feed would not
 * find the made copy: same cut, same key. `goalVideoKey` is that key, used by
 * both.
 */
import type { StoredPost } from "../media/types";
import { clipStyleFor, clipVariantFor } from "../media/clipStyle";
import { animationsLook } from "../animLook";
import { getClips } from "./store";
import { synthTrack, type SynthGoal } from "./synth";
import { makeEdit, type ClipStyle, type ClipMoves } from "./edit";
import { planAudio, mixAudio } from "./audio";
import { makeVideo, workerReady, videosOnPage } from "./makeVideo";
import type { GoalTrack } from "./track";
import { smoothRecorded } from "./smooth";
import { leoUpdateOn } from "../leoUpdate";
import { commentarySet } from "./commentaryVoice";

/** The one name a goal video is kept under (memory and the phone). A smooth
 *  video (Leo's update "smoothGoals", goalClip/smooth.ts) has its own name, so
 *  it is never mixed up with the stiff one; off, the name is as it always was. */
export function goalVideoKey(style: ClipStyle, variant: number, moves: ClipMoves, clipIds: string[], synth: SynthGoal[] | undefined, handle: string | undefined, smooth = false, better = false, captions?: string[]): string {
  const synthKey = (synth ?? []).map(g => g.seed).join(",");
  // Better videos (Leo's switch part "betterVideos") have their own name, and
  // so does each set of captions; off, the name is as it always was.
  const betterKey = better ? `|better2${captions?.length ? `|${captions.join("/")}` : ""}` : "";
  // "Different commentators": the sound is in the file, so its own name too.
  const voiceKey = commentarySet() === "teams" ? "|teams" : "";
  return `${style}|${variant}|${moves}|${clipIds.join(",")}|${synthKey}|${handle ?? ""}${smooth ? "|smooth" : ""}${betterKey}${voiceKey}`;
}

/** Recorded goals and made ones together, in the order they were scored (as GoalVideo does).
 *  `smooth`: the recordings eased (goalClip/smooth.ts); made goals are smooth already. */
export async function tracksFor(clipIds: string[], synth: SynthGoal[] | undefined, smooth = false): Promise<GoalTrack[]> {
  const made = (synth ?? []).map(synthTrack).filter((t): t is GoalTrack => !!t);
  const got = clipIds.length ? await getClips(clipIds).catch(() => [] as GoalTrack[]) : [];
  const rec = smooth ? smoothRecorded(got) : got;
  return [...rec, ...made].sort((a, b) => a.meta.minute - b.meta.minute);
}

/**
 * Start making the videos of these new posts that are about your match
 * (priority posts first). Never throws; does nothing on a server.
 */
export async function premakeFeedVideos(posts: StoredPost[]): Promise<void> {
  if (typeof window === "undefined") return;
  // Only with the worker: making one on the page would slow the result screens.
  if (!(await workerReady()) || videosOnPage()) return;
  const wanted = posts
    .map(p => {
      const g = p.graphic;
      if (g?.type !== "goalVideo") return null;
      const rank = g.priority ? 2 : g.clips.length > 0 ? 1 : 0;
      return rank > 0 ? { p, g, rank } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
  const moves = animationsLook();
  const smooth = leoUpdateOn("smoothGoals");
  const better = leoUpdateOn("betterVideos");
  for (const { p, g } of wanted) {
    try {
      const style = g.style ?? clipStyleFor({ ...p.author, persona: p.persona }, better);
      const variant = g.variant ?? clipVariantFor(p.author);
      const tracks = await tracksFor(g.clips, g.synth, smooth);
      if (!tracks.length) continue;
      const captions = g.captions;
      const edit = makeEdit(tracks, style, moves, variant, better ? { better, captions } : undefined);
      const credit = { handle: p.author.handle, name: p.author.name, archetype: p.author.archetype, platform: p.author.platform };
      const key = goalVideoKey(style, variant, moves, g.clips, g.synth, credit.handle, smooth, better, captions);
      const audio = await mixAudio(planAudio(edit, undefined, credit)).catch(() => null);
      await makeVideo(key, edit, { credit, audio });
    } catch { /* the feed makes it when it opens, as before */ }
  }
}
