/**
 * The goal-video sound plans that must never change while the "Different
 * commentators" part is off. Shared by make-plan-golden.mts (writes the
 * snapshot, run once before a change) and tests/star/commentators.mts
 * (compares against it).
 *
 *   npx tsx scripts/commentary/make-plan-golden.mts   # rewrite the snapshot (only on purpose)
 */
import { readFileSync } from "node:fs";
import { trackFromStored, type GoalTrack, type ClipMeta } from "../../lib/star/goalClip/track";
import { makeEdit, type ClipStyle, type ClipMoves, type Edit } from "../../lib/star/goalClip/edit";

const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`../../tests/star/fixtures/goalClips/${f}`, import.meta.url), "utf8"))) as GoalTrack;

/** Different goals from the two recordings: the finish, the score, a late moment. */
const METAS: Partial<ClipMeta>[] = [
  {},
  { how: "header", scoreAfter: [1, 0], youAreHome: true, minute: 12 },
  { how: "long_range", scoreAfter: [1, 1], youAreHome: false, minute: 40 },
  { how: "penalty", scoreAfter: [2, 1], youAreHome: true, minute: 55 },
  { how: "free_kick", scoreAfter: [4, 0], youAreHome: true, minute: 70 },
  { how: "rebound", scoreAfter: [1, 3], youAreHome: true, minute: 75 },
  { how: "one_on_one", scoreAfter: [2, 1], youAreHome: true, minute: 89, isYou: true, late: "winner" },
  { how: "chip", scoreAfter: [2, 2], youAreHome: false, minute: 90, isYou: true, late: "level" },
  { how: "corner", scoreAfter: [3, 2], youAreHome: true, minute: 82 },
];

export function planCases(): { name: string; edit: Edit }[] {
  const base = [load("scramble.json"), load("lay-off.json")];
  const out: { name: string; edit: Edit }[] = [];
  const styles: ClipStyle[] = ["broadcast", "reverse", "fan", "tiktok"];
  const moves: ClipMoves[] = ["old", "new"];
  base.forEach((tr, ti) => {
    METAS.forEach((m, mi) => {
      const t: GoalTrack = { ...tr, meta: { ...tr.meta, ...m, id: `${tr.meta.id}-m${mi}` } };
      for (const st of styles) for (const mv of moves) for (const v of [0, 1, 2]) {
        out.push({ name: `t${ti} m${mi} ${st} ${mv} v${v}`, edit: makeEdit([t], st, mv, v) });
      }
    });
  });
  // Two reels (several goals in one video).
  for (const st of ["broadcast", "reverse", "tiktok"] as ClipStyle[]) {
    const a = { ...base[0], meta: { ...base[0].meta, ...METAS[2], id: "reel-a" } };
    const b = { ...base[1], meta: { ...base[1].meta, ...METAS[6], id: "reel-b" } };
    out.push({ name: `reel ${st}`, edit: makeEdit([a, b], st, "old", 0) });
  }
  return out;
}
