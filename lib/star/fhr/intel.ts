/**
 * B2b — HOW CLEVER YOUR SIDE IS AGAINST THEIRS (Harry, 20 Oct 2026):
 * "All of this has to scale with level of npc's your teammates intelligence
 * vs opposition. How easy it is to get the ball back." Then, later the same
 * day: "chance count = to build up all of that is all just highlights
 * intelligence and should work together."
 *
 * One number, the GAP between the two sides, decides everything a build-up
 * does with the ball, smoothly (never three buckets):
 *
 *   gap = (your side − theirs) / 20, held between −1 and +1
 *   (85 v 65 → +1, 75 v 75 → 0, 65 v 85 → −1; unknown strengths → 0).
 *
 * What it moves (each a straight line in the gap, so 0 is the middle):
 *   · winning the ball back: how long THEY keep it before you win it
 *     (quicker for the better side), how close your man presses them, how
 *     high up the regain zone it is won, and how often it is a scrappy one
 *     (a poke that runs loose) rather than a clean steal;
 *   · your passing: the time on the ball between touches (quicker and
 *     cleaner for the better side) and which real teams' passing the route
 *     is drawn from (top / mid / bottom of the league, blended);
 *   · their pressing on you: how close their nearest man stands off;
 *   · your runs: how often a run that needs timing is mistimed (caught
 *     offside), and how close to the line a timed run stays.
 *
 * Where the regains happen and how many chances there are is the match's
 * own count (hiddenMatch.ts), which the same two strengths drive; this file
 * decides how they look and play out, and the offsides it calls are real
 * (the move ends, in the match's count too).
 *
 * Pure: no React, no canvas. tests/star/fhrIntel.mts measures it.
 */

/** Strength points that make one whole unit of gap. */
export const INTEL_GAP_POINTS = 20;

/**
 * At even sides: the share of runs that need timing (a man beyond their
 * line at the moment the pass is played) that are mistimed and flagged.
 * Tuned so an even match calls about 0.35 offsides a match in your
 * build-ups (tests/star/fhrIntel.mts; the report has the table).
 */
export const INTEL_MISTIME_EVEN = 0.22;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The gap between the sides, −1 (they are far better) … +1 (you are far better). */
export function sideGap(us?: number, them?: number): number {
  if (us === undefined || them === undefined || !Number.isFinite(us) || !Number.isFinite(them)) return 0;
  return clamp((us - them) / INTEL_GAP_POINTS, -1, 1);
}

export interface FhrIntel {
  /** The gap it was made from. */
  gap: number;
  /** Both strengths were known (else the data's whole-league tables, as before). */
  known: boolean;
  /** × the time on the ball between your touches (lower = quicker, cleaner). */
  touch: number;
  /** × the distance THEIR nearest man presses you from (lower = tighter). */
  pressOnUs: number;
  /** How far their nearest man will come out of his shape to press you (m): further for the better side. */
  pressReachM: number;
  /** How much their whole shape squeezes onto the ball (0 = the data's shape; up = tighter): more for the better side. */
  squeeze: number;
  /** How long they keep the ball before you win it back, seconds [shortest, longest]. */
  oppSpellS: [number, number];
  /** How close your man is to theirs as the regain starts, metres [closest, furthest]. */
  pressOnThemM: [number, number];
  /** Where in the regain's zone it is won: 0 = the deep end, 1 = the end nearest their goal (before a little noise). */
  regainHigh: number;
  /** Chance a regain is scrappy: the challenge pokes it loose and it runs to a team-mate. */
  scrappy: number;
  /** The real teams the route's passing is drawn from (weights, adding to 1). */
  tiers: { top: number; mid: number; bottom: number };
  /** Chance a run that needs timing is mistimed (the flag goes up). */
  mistime: number;
  /** How far onside a timed run is when the pass is played, metres [nearest the line, furthest]. */
  onsideM: [number, number];
}

/** How your side and theirs compare, for the build-up. */
export function fhrIntel(us?: number, them?: number): FhrIntel {
  const known = us !== undefined && them !== undefined && Number.isFinite(us) && Number.isFinite(them);
  const g = sideGap(us, them);
  const lo = 1.5 - 0.7 * g;
  return {
    gap: g,
    known,
    touch: 1 - 0.15 * g,
    pressOnUs: 1 + 0.35 * g,
    pressReachM: 13 - 5 * g,
    squeeze: clamp(0.15 - 0.15 * g, 0, 0.3),
    oppSpellS: [lo, lo + 0.7 + 0.5 * Math.max(0, -g)],
    pressOnThemM: [2.6 - 0.9 * g, 4.6 - 1.4 * g],
    regainHigh: clamp(0.5 + 0.3 * g, 0.1, 0.9),
    scrappy: clamp(0.3 - 0.2 * g, 0.08, 0.6),
    tiers: { top: Math.max(0, g), mid: 1 - Math.abs(g), bottom: Math.max(0, -g) },
    mistime: clamp(INTEL_MISTIME_EVEN * (1 - 0.55 * g), 0.04, 0.5),
    onsideM: [0.35 - 0.15 * g, 1.5 - 0.6 * g],
  };
}
