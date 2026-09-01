import type { CareerState } from "./types";
import { nextFixtureFor } from "./competitions";
import {
  simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, runDueTransferWindow,
} from "./careerFlow";
import { divisionOf, matchweeksFor, postSeasonFor, fixtureDate, seasonStartYear } from "./calendar";
import { sortLeague, mulberry32 } from "./season";
import { generateRelegationOffers } from "./relegationOffers";
import { acceptOffer } from "./transfers";

/**
 * TESTING A SEASON WITHOUT PLAYING ONE.
 *
 * Requested directly: a real season is thirty-eight to forty-six matches, and
 * a bug three months into a save cannot be reached without playing three
 * months into a save. This jumps a career straight to a chosen week —
 * "December 25th", "two weeks before the end of the season" — by simulating
 * every match in between exactly the way the game already simulates a match
 * you were left out of the squad for (simulateMissedFixture): the club plays
 * it, the division plays its round, transfer windows open on schedule, cups
 * and Europe draw and settle. What it does NOT do is pretend you played any
 * of it — no goals, no rating, no form, no wages beyond the standing weekly
 * one, because you were not out there for any of these matches. It is a
 * fast-forward through the world around you, not a played career.
 *
 * A season boundary crossed along the way is resolved headlessly rather than
 * by showing the ballon-dor/ladder/contract-renewal screens a real rollover
 * would: nobody is retiring, nobody is turning down or accepting a transfer
 * offer they never saw, and an expiring contract is auto-extended rather
 * than renegotiated. See rollOverSilently below for exactly what each of
 * those defaults is and why — every one of them is a simplification that
 * only belongs in this dev tool, never in the real flow in app/star-dev.
 */

export interface SkipTarget {
  season: number;
  /** A fixture-calendar week: 1..matchweeksFor(division), or a post-season slot. */
  week: number;
}

export interface SkipResult {
  career: CareerState;
  /** How many fixtures were simulated to get here. */
  weeksSimulated: number;
  /**
   * The target was past the end of the road this career can actually run —
   * the career retired, or the safety valve below tripped. `career` is
   * wherever the skip actually stopped.
   */
  reachedEnd: boolean;
}

const MAX_FIXTURES = 4000;

export function skipTo(career: CareerState, target: SkipTarget): SkipResult {
  let cur = career;
  let weeksSimulated = 0;

  const targetReached = (c: CareerState): boolean => {
    if (c.season > target.season) return true;
    if (c.season < target.season) return false;
    const fx = nextFixtureFor(c);
    // Stop with the target week's own fixture still unplayed — the point of
    // landing here is to play (or test) it yourself, not to have it already
    // simulated out from under you. Nothing left to play this season is the
    // other way to have arrived: there is nowhere further forward to go
    // without leaving the target season.
    return !fx || fx.week >= target.week;
  };

  for (let i = 0; i < MAX_FIXTURES; i++) {
    if (cur.retired) return { career: cur, weeksSimulated, reachedEnd: true };
    if (targetReached(cur)) return { career: cur, weeksSimulated, reachedEnd: false };

    const fx = nextFixtureFor(cur);
    if (!fx) {
      // The season is fully played out but the target is a later one —
      // roll over and carry on.
      cur = rollOverSilently(cur);
      continue;
    }
    const { career: after } = simulateMissedFixture(cur, fx);
    cur = runDueTransferWindow(after);
    weeksSimulated++;
  }
  // The safety valve — a career should never actually take 4000 fixtures
  // (a hundred-plus seasons) to reach a real target, so tripping this means
  // the loop is not converging rather than that the target was genuinely
  // this far out.
  return { career: cur, weeksSimulated, reachedEnd: true };
}

/**
 * Everything app/star-dev's ballon-dor → ladder → contract-renewal chain
 * decides interactively, decided here with the same defaults a player who
 * clicked through without incident would have landed on:
 *
 *  - Ballon d'Or: never won by a career that was not actually played.
 *  - Retirement: never taken, even past the age it becomes forced in the
 *    real flow — a save that has aged that far is already well outside what
 *    this tool exists to reach, and stopping the skip there silently would
 *    be a stranger surprise than a player who plays on.
 *  - Relegated out of the whole pyramid (Championship, bottom three): the
 *    real screen shows offers and lets you choose; this takes the first
 *    one, same as `generateRelegationOffers` already sorts best-fit first.
 *  - An ordinary optional transfer window: every offer declined — "stay
 *    put", the same button the real screen defaults a shrug to.
 *  - A contract that ran out this rollover: auto-extended three seasons at
 *    its existing terms rather than renegotiated — the real screen plays a
 *    higher-or-lower card game for the raise, which has nothing to decide
 *    headlessly.
 */
function rollOverSilently(career: CareerState): CareerState {
  let cur = awardLeagueTrophyIfWon(career).career;

  let forcedRelegationMove = false;
  if (divisionOf(cur) === "championship") {
    const bottomThree = sortLeague(cur.league).slice(-3).map(t => t.name);
    if (bottomThree.includes(cur.player.club)) {
      const offers = generateRelegationOffers(cur, mulberry32(cur.season * 8831 + cur.fame));
      if (offers.length > 0) {
        cur = acceptOffer(cur, offers[0]);
        forcedRelegationMove = true;
      }
    }
  }

  // `justTransferred` — a forced relegation move just swapped `cur.contract`
  // to the new club's deal; without this, advanceSeason would pay the
  // stayed-all-season loyalty bonus for the club just left. See its own doc.
  const { career: rolled } = advanceSeason(cur, false, forcedRelegationMove);
  cur = rolled;
  if (forcedRelegationMove && cur.ladderNews) {
    cur = { ...cur, ladderNews: { ...cur.ladderNews, yourMove: null } };
  }

  if (cur.contract.seasonsRemaining <= 0) {
    cur = { ...cur, contract: { ...cur.contract, seasonsRemaining: 3 } };
  }

  return cur;
}

// ── Picking a target from a date or a "N before the end" ask ───────────────

/**
 * Which fixture-calendar week (1..matchweeksFor, or a post-season slot)
 * lands closest to a real date, for THIS career's current division/season —
 * "December 25th" only means something once you know which week that
 * actually is on this save's calendar.
 */
export function weekClosestToDate(career: CareerState, month: number, day: number): number {
  const division = divisionOf(career);
  const weeks = matchweeksFor(division);
  const startYear = seasonStartYear(career.player.startYear, career.season);
  // The season can open in one calendar year and run into the next — "25
  // December" during a 2026/27 season means 25 December 2026, but the whole
  // back half of the season (January onward) is 2027. Trying both and
  // keeping whichever actual fixture date lands closer handles that without
  // this function needing to know the season's shape itself.
  const candidates = [startYear, startYear + 1];
  let best = 1;
  let bestGap = Infinity;
  for (let week = 1; week <= weeks; week++) {
    const played = fixtureDate(career.player.startYear, career.season, week, "saturday", division);
    for (const year of candidates) {
      const target = Date.UTC(year, month, day);
      const gap = Math.abs(played.getTime() - target);
      if (gap < bestGap) { bestGap = gap; best = week; }
    }
  }
  return best;
}

/** N matchweeks before this season's last league round. */
export function weeksBeforeSeasonEnd(career: CareerState, n: number): number {
  return Math.max(1, matchweeksFor(divisionOf(career)) - n);
}

/** The transfer deadline day slots — 31 August and 31 January. */
export function deadlineDayWeek(career: CareerState, window: "summer" | "january"): number {
  return window === "summer"
    ? weekClosestToDate(career, 7, 31)
    : weekClosestToDate(career, 0, 31);
}

/** The very last thing on this season's calendar — final(s) included. */
export function seasonEndWeek(career: CareerState): number {
  const division = divisionOf(career);
  // Play-offs run later than the cup finals in the Championship; everywhere
  // else the domestic cup finals are the last thing on the calendar.
  return division === "championship" ? postSeasonFor(division, 5) : postSeasonFor(division, 2);
}
