import type { Reputation } from "./types";

/**
 * REPUTATION — PHASE 1 OF STAR_POWER_POLITICS.MD.
 *
 * Five separate standings were asked for (world, club, fan, government,
 * shareholder), explicitly not one number — modelled on the Life tab's
 * existing relationship bars. Fan reputation is `relationships.fans`
 * itself, extended rather than duplicated (see the brief's own §5), so this
 * file only owns the four that had nowhere else to live: world, club,
 * government, shareholders.
 *
 * This phase ships the stat and two modest real hooks into things that
 * already happen every season — winning silverware, and the board's own
 * verdict on how the season went. Nothing here feeds a vote yet: there is
 * no voting engine (that's Phase 2), no governing-body investment (Phase
 * 4), and no boardroom-specific track record beyond the season judgement
 * already computed for the boss relationship (that's Phase 3). Government
 * and shareholder reputation are real fields from day one, but nothing
 * moves them yet — there is nothing in the game for them to be a
 * relationship WITH until later phases exist.
 */

export function clampReputation(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function nudgeReputation(rep: Reputation, changes: Partial<Record<keyof Reputation, number>>): Reputation {
  const next = { ...rep };
  for (const key of Object.keys(changes) as (keyof Reputation)[]) {
    const delta = changes[key];
    if (delta) next[key] = clampReputation(next[key] + delta);
  }
  return next;
}

/**
 * How much a season's silverware nudges world reputation.
 *
 * Reuses the exact `trophyFame`/`honourFame` figures `advanceSeason` already
 * computes for `career.fame` — that number is deliberately unbounded (fame
 * keeps climbing for as long as a career runs), where reputation is a
 * bounded 0-100 bar, so this scales it down hard rather than reusing it
 * directly. A Premier League title (trophyFame 25) is worth 5 points of
 * world reputation; an individual honour (honourFame 4 each) is worth 1.
 */
export function worldReputationFromSeason(trophyFame: number, honourFame: number): number {
  return Math.round(trophyFame / 5 + honourFame / 4);
}

/**
 * How much the board's own verdict on the season (see `judgeSeason` in
 * expectations.ts) nudges CLUB reputation — the "strong boardroom track
 * record" hook named directly in the brief. Deliberately its own scale, not
 * a reuse of `bossChange`: the boss bar is a fast-moving personal
 * relationship, club reputation should be the slower-moving, more
 * institutional cousin of it, so the same season swings it by less
 * (bossChange tops out at ±18; this tops out at ±8).
 */
export function clubReputationFromSeason(judgementScore: number): number {
  return Math.round(judgementScore * 8);
}
