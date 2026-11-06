/**
 * A VIDEO POST ALWAYS HAS A VIDEO (Leo, 31 Oct 2026: "NO MORE TWEETS ABOUT
 * VIDEOS THAT DONT HAVE VIDEOS U CAN WATCH").
 *
 * Recorded goals live on the phone that played the match (IndexedDB), not in
 * the save. Opened on another device, a post's recordings are missing and the
 * video used to vanish, leaving its words. With Football Twitter on, a goal
 * video post carries `standIn`: one made goal per recording, same order. Any
 * recording this phone lacks is replaced by its made goal.
 */
import { getClips } from "../goalClip/store";
import { synthTrack, type SynthGoal } from "../goalClip/synth";
import type { GoalTrack } from "../goalClip/track";

export async function recordedOrStandIn(clipIds: string[], standIn?: SynthGoal[]): Promise<GoalTrack[]> {
  if (!standIn || standIn.length !== clipIds.length) return getClips(clipIds);
  const each = await Promise.all(clipIds.map(id => getClips([id]).catch(() => [] as GoalTrack[])));
  const out: GoalTrack[] = [];
  each.forEach((found, i) => {
    if (found.length) out.push(found[0]);
    else { const t = synthTrack(standIn[i]); if (t) out.push(t); }
  });
  return out;
}
