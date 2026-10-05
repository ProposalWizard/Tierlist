import type { ScenarioKind } from "./canvasEngine";
import { CX, PEN_SPOT_Y } from "./pitch";

/**
 * WHAT A DRIBBLE EARNS — the chance that follows the first-person run.
 *
 * Leo, 5 Oct 2026: "obvs better chance reward for dribbling more waves then
 * passing compared to like passing after 1/3 waves." One ladder for every way
 * the run can end well: a pass after some of the waves, a pass after all of
 * them, getting clear, getting clear having beaten seven or more men.
 *
 * Why the KIND is chosen here, not left to the position: while
 * EVEN_KIND_MIX is on (lib/star/kindMix.ts), a chained chance ignores where
 * the ball is and is dealt from the even bag. So the old "beat 7+ → a chance
 * near the penalty spot" reward was, in practice, a random kind like any
 * other. CanvasMatch now passes this kind straight to makeChance
 * (`{ from: "kind" }`), so the ladder is real.
 *
 * Kinds are ordered by how often the player scores from them, measured end
 * to end in tests/star/README.md (finishing): one_on_one 55.7%, cutback
 * 37.3%, through_ball 35.8%, byline_cross 14.7%. long_range and
 * midfield_pass are the modest end — a shot from distance, or a move that
 * still has to be built.
 */

export type DribbleRewardTier = 0 | 1 | 2 | 3 | 4;

export interface DribbleReward {
  tier: DribbleRewardTier;
  kind: ScenarioKind;
  /** Where the move picks up (pitch metres from the goal line) — for the
   *  chain and the commentary; the kind decides the picture. */
  pos: { x: number; y: number };
  ambition: number;
}

/** Metres from goal per tier — the "how far out" a tier stands for. */
export const TIER_DEPTH: Record<DribbleRewardTier, number> = { 0: 36, 1: 31, 2: 25, 3: 19, 4: PEN_SPOT_Y };

const TIER_KINDS: Record<DribbleRewardTier, [ScenarioKind, number][]> = {
  0: [["midfield_pass", 0.5], ["long_range", 0.5]],
  1: [["long_range", 0.4], ["through_ball", 0.3], ["byline_cross", 0.3]],
  2: [["through_ball", 0.4], ["cutback", 0.4], ["tight_angle", 0.2]],
  3: [["cutback", 0.45], ["one_on_one", 0.35], ["tight_angle", 0.2]],
  4: [["one_on_one", 0.7], ["cutback", 0.3]],
};

/**
 * The tier a run's ending earns.
 *  - passed before beating any wave: 0
 *  - passed with under half the waves beaten (1 of 3, 1 of 4): 1
 *  - passed with half or more beaten, not all: 2
 *  - passed after every wave, or clear with fewer than 7 men beaten: 3
 *  - clear having beaten 7 or more men: 4
 */
export function dribbleRewardTier(o: { cleared: boolean; menBeaten: number; wavesBeaten: number; totalWaves: number }): DribbleRewardTier {
  if (o.cleared) return o.menBeaten >= 7 ? 4 : 3;
  const total = Math.max(1, o.totalWaves);
  const f = o.wavesBeaten / total;
  if (f >= 1) return 3;
  if (f >= 0.5) return 2;
  if (o.wavesBeaten > 0) return 1;
  return 0;
}

export function dribbleReward(
  o: { cleared: boolean; menBeaten: number; wavesBeaten: number; totalWaves: number; mateX?: number },
  rng: () => number,
): DribbleReward {
  const tier = dribbleRewardTier(o);
  const table = TIER_KINDS[tier];
  let r = rng(), kind = table[table.length - 1][0];
  for (const [k, w] of table) { if (r < w) { kind = k; break; } r -= w; }
  // Wide where the ball went wide (the team-mate's side), tighter in as the
  // tier climbs; a little jitter in depth so it is not the same spot twice.
  const side = o.mateX !== undefined ? Math.max(-10, Math.min(10, o.mateX - CX)) : (rng() - 0.5) * 12;
  const x = CX + side * (1 - tier * 0.15);
  const y = TIER_DEPTH[tier] + (rng() - 0.5) * 3;
  return { tier, kind, pos: { x, y }, ambition: 1 };
}
