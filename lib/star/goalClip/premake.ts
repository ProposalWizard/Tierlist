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

/** The one name a goal video is kept under (memory and the phone). */
export function goalVideoKey(style: ClipStyle, variant: number, moves: ClipMoves, clipIds: string[], synth: SynthGoal[] | undefined, handle: string | undefined): string {
  const synthKey = (synth ?? []).map(g => g.seed).join(",");
  return `${style}|${variant}|${moves}|${clipIds.join(",")}|${synthKey}|${handle ?? ""}`;
}

/** Recorded goals and made ones together, in the order they were scored (as GoalVideo does). */
export async function tracksFor(clipIds: string[], synth: SynthGoal[] | undefined): Promise<GoalTrack[]> {
  const made = (synth ?? []).map(synthTrack).filter((t): t is GoalTrack => !!t);
  const rec = clipIds.length ? await getClips(clipIds).catch(() => [] as GoalTrack[]) : [];
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
  for (const { p, g } of wanted) {
    try {
      const style = clipStyleFor(p.author);
      const variant = clipVariantFor(p.author);
      const tracks = await tracksFor(g.clips, g.synth);
      if (!tracks.length) continue;
      const edit = makeEdit(tracks, style, moves, variant);
      const credit = { handle: p.author.handle, name: p.author.name };
      const key = goalVideoKey(style, variant, moves, g.clips, g.synth, credit.handle);
      const audio = await mixAudio(planAudio(edit)).catch(() => null);
      await makeVideo(key, edit, { credit, audio });
    } catch { /* the feed makes it when it opens, as before */ }
  }
}
