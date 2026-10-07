/**
 * WHICH 3D CLIP A MAN'S ANIMATION PLAYS (Animations: New, Players: 3D).
 *
 * Leo, 7 Oct 2026: the drawn figures already show every touch, pass, shot,
 * header, block and save (lib/star/actionAnim.ts). The baked 3D figures had
 * only run / kick / dive / celebrate, so most of those moments fell back to
 * the one kick clip or a plain dive. These are the 3D twins, baked into the
 * second sprite atlas (lib/star/sprites.ts, tools/sprites/new/).
 *
 * Pure: no canvas, no React. The match screen asks this file, and only when
 * Animations is New and that family is switched on (animDials.ts) — with
 * Animations: Old none of this is reached and the old clips play exactly as
 * before. Looks only: nothing here is read by the ball, the keeper's save
 * maths or any timing.
 */
import type { SaveResult } from "./canvasEngine";
import { animDuration, ONE_HAND_Z, type ActorAnim } from "./actionAnim";
import type { SpriteClip } from "./sprites";

/** Frames and speed of each new clip, as baked (index.json is the truth; a
 *  test keeps these in step). `strike`: the frame the boot meets the ball. */
export const NEW_CLIP_SHAPE: Record<string, { frames: number; strike?: number }> = {
  touch: { frames: 3 }, passKick: { frames: 4, strike: 1 }, shotKick: { frames: 5, strike: 2 },
  volley: { frames: 4, strike: 2 }, chipKick: { frames: 4, strike: 2 }, header: { frames: 5, strike: 3 },
  block: { frames: 3, strike: 1 }, clearance: { frames: 5, strike: 2 },
};

/** The new clip for an outfield man's animation (by what he did and how). */
export function outfieldClipFor(a: Pick<ActorAnim, "kind" | "mode">): SpriteClip | null {
  if (a.kind === "touch") return "touch";
  if (a.kind === "block") return "block";
  if (a.kind === "save") return null;
  if (a.mode === "header") return "header";
  if (a.kind === "clearance") return "clearance";
  if (a.mode === "volley") return "volley";
  if (a.mode === "chip") return "chipKick";
  if (a.kind === "pass") return "passKick";
  return "shotKick";
}

/**
 * The clip and the time into it, `elapsed` seconds into the animation, or
 * null once it is over. The engine writes a strike down AT the strike, so the
 * clip starts half a frame before its strike frame (the boot coming through)
 * and plays on to its last frame by the end of the animation's own window —
 * the same window the drawn figure uses, so 2D and 3D finish together.
 */
export function outfieldSpriteClip(
  a: Pick<ActorAnim, "kind" | "mode">,
  elapsed: number,
  fps: (clip: SpriteClip) => number,
): { clip: SpriteClip; t: number } | null {
  const clip = outfieldClipFor(a);
  if (!clip) return null;
  const dur = animDuration(a);
  if (!(elapsed >= 0) || elapsed > dur) return null;
  const shape = NEW_CLIP_SHAPE[clip];
  const f = fps(clip);
  if (!shape || !(f > 0)) return null;
  const u = elapsed / dur;
  const first = shape.strike != null ? Math.max(0, shape.strike - 0.5) : 0;
  // Frame position from `first` to just inside the last frame.
  const pos = first + u * (shape.frames - 0.001 - first);
  return { clip, t: pos / f };
}

/** The side a dive goes, from the old dive clip the match already picked. */
export type DiveSide = "R" | "L";
export function sideOfDive(clip: string): DiveSide {
  return clip.endsWith("L") ? "L" : "R";
}

/**
 * The new dive clip for a save played as a dive, or null to keep the old
 * dive (diveR / diveL). A ball up in the corner (or a save the engine played
 * high) is the one-handed stretch; a ball along the grass is the low dive; a
 * palm away at mid height is the parry.
 */
export function keeperDiveClipNew(save: SaveResult | undefined, z: number, high: boolean, side: DiveSide): SpriteClip | null {
  const upper = high || z > ONE_HAND_Z;
  if (upper && (save === "beaten" || save === "push" || save === "parry")) return side === "R" ? "oneHandR" : "oneHandL";
  if (z < 0.6 && save) return side === "R" ? "lowDiveR" : "lowDiveL";
  if (save === "push" || save === "parry") return side === "R" ? "parryR" : "parryL";
  return null;
}

/** A save taken standing (no dive): the catch held to his chest, or the fumble. */
export function keeperStandingClip(save: SaveResult | undefined): SpriteClip | null {
  if (save === "catch") return "catchHold";
  if (save === "fumble") return "fumble";
  return null;
}

/** Getting back up after a dive, `getUp` 0..1 of the way (actionAnim's
 *  KeeperAnimFrame.getUp), as a time into the getUp clip. */
export function keeperGetUpT(getUp: number, frames: number, fps: number): number {
  const g = Math.max(0, Math.min(1, getUp));
  return (g * (frames - 0.001)) / fps;
}
