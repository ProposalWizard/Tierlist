import type { CareerState, MatchStats, GoalEvent, OppGoalEvent, Fixture } from "./types";
import { wageForFixture } from "./wages";
import { sponsorPayPerMatch } from "./economy";
import { getTuning } from "./tuningStore";

// Canonical end-of-match scoring for career mode: turns a match tally
// (chances/goals/assists/passes + the final scoreline) into the MatchStats the
// career flow consumes — rating, star-man, cash and relationship deltas.
// Moved out of the old DOM match engine so the career flow keeps one source of
// truth after that engine was replaced by the canvas engine.
/**
 * The rating a performance is worth so far, before any adjustment for minutes.
 *
 * Pulled out of finaliseMatch so the manager can read the same number mid-match
 * that the scoresheet reads at the end — a hook decision that used a different
 * formula from the rating it is meant to reflect would be indefensible.
 */
export function liveRating(
  chances: number,
  goals: number,
  assists: number,
  passes: number,
  userScore: number,
  oppScore: number,
): number {
  const result = userScore > oppScore ? 0.4 : userScore < oppScore ? -0.3 : 0.1;
  // Reported directly, from a real deliberate test: kicking the ball off the
  // pitch on purpose at literally every chance for a full 90 minutes still
  // finished around a 6.4 — because nothing in this formula had ever
  // measured WASTE. Every chance that produces neither a goal nor an assist
  // is now a real strike against the rating, scaled up the more of them
  // there are — a couple of missed chances in a normal match barely
  // registers, but a whole afternoon of squandering every single one drags
  // the floor down toward a genuinely bad mark, not a shrug.
  const wasted = Math.max(0, chances - (goals + assists));
  const wastePenalty = Math.min(
    getTuning("rating.maxWastePenalty"),
    wasted * getTuning("rating.wastePenaltyPerChance"),
  );
  return Math.max(1, Math.min(10, 6.0 + goals * 1.2 + assists * 0.8 + passes * 0.05 + result - wastePenalty));
}

/**
 * A cameo is judged on less evidence. A substitute who came on for twenty
 * minutes shouldn't be rated as though he'd played the ninety — this
 * regresses `rating` toward a neutral 6.5 in proportion to the minutes NOT
 * played, so a short appearance can neither earn a 9 nor be blamed for a 4.
 * A full match's `minutes` (90) multiplies by exactly 1, so nothing about a
 * full appearance changes.
 *
 * Pulled out of finaliseMatch, same reason liveRating itself was: reported
 * directly that the live in-match "Avg Rat" display (CanvasMatch.tsx) and
 * the final post-match rating could show two different numbers for the
 * SAME tally, because only finaliseMatch applied this regression — the live
 * widget called liveRating() raw. A rating that quietly recalculates the
 * moment the match ends reads as broken, not as "more accurate now" — the
 * live display now applies this exact same step, with the minutes played
 * SO FAR, so the number on screen at the final whistle is the number that
 * ends up on the stats screen, not a preview of it.
 */
export function regressForMinutes(rating: number, minutes: number): number {
  const share = Math.max(0.15, Math.min(1, minutes / 90));
  const regressed = 6.5 + (rating - 6.5) * (0.45 + 0.55 * share);
  return Math.max(1, Math.min(10, regressed));
}

export function finaliseMatch(
  chances: number,
  goals: number,
  assists: number,
  passes: number,
  minutes: number,
  userScore: number,
  oppScore: number,
  career: CareerState,
  goalEvents: GoalEvent[] = [],
  hooked: MatchStats["hooked"] = null,
  oppGoalEvents: OppGoalEvent[] = [],
  /**
   * The fixture this match IS, when the caller has one.
   *
   * Only used to work out this match's share of the week's wage — a wage is
   * a week's wage, paid at the weekend game or split across that week's
   * midweek games (see wages.ts). Optional, and omitting it pays the full
   * wage exactly as before, which is what the /star-match-dev sandbox fork
   * and the standalone match sandbox want: neither is a real fixture in a
   * real season, so neither has a week to share with.
   */
  fixture?: Fixture,
): MatchStats {
  const raw = liveRating(chances, goals, assists, passes, userScore, oppScore);
  const rating = regressForMinutes(raw, minutes);

  const starMan = rating >= 8.5 || goals >= 2;
  // A week's wage, not a match's — see wages.ts. Without a fixture there is
  // no week to divide, so the full wage is the honest answer.
  const wage = fixture ? wageForFixture(career, fixture) : career.contract.wage;
  const goalBonus = goals * career.contract.goalBonus;
  const assistBonusPay = assists * career.contract.assistBonus;
  // Image-rights money from how well your sponsors are being served.
  //
  // WAGE-RELATIVE, not a flat figure — see `sponsorPayPerMatch` (economy.ts)
  // for the full account of what this used to be. The short version: the 14
  // Sep 2026 rescale multiplied this like a one-off fee, but it fires about
  // forty times a season, and the result paid ★10,000 a match at full
  // standing — eight and a half times the entire intended income of a
  // Premier League season, out of one line. It is now exactly the share
  // `TOTAL_INCOME_SHARES.sponsorPerMatch` always claimed it was, scaled by
  // how well the sponsors are actually being served.
  const sponsorPay = sponsorPayPerMatch(wage, career.relationships.sponsors);
  const totalCash = wage + goalBonus + assistBonusPay + sponsorPay;

  let boss = 0, team = 0, fans = 0;
  if (rating >= 8) { boss += 6; fans += 8; team += 3; }
  else if (rating >= 7) { boss += 3; fans += 4; team += 2; }
  else if (rating >= 6) { boss += 1; fans += 1; team += 1; }
  else if (rating >= 5) { boss -= 2; fans -= 2; team -= 1; }
  else { boss -= 5; fans -= 4; team -= 3; }
  if (goals > 0) fans += goals * 3;
  if (assists > 0) { team += assists * 3; fans += assists; }
  if (starMan) { boss += 4; fans += 5; team += 2; }

  return {
    chances,
    goals,
    assists,
    passes,
    minutes,
    hooked,
    rating: Math.round(rating * 10) / 10,
    starMan,
    bossChange: boss,
    teamChange: team,
    fansChange: fans,
    wage,
    goalBonus: goalBonus + assistBonusPay,
    sponsorPay,
    totalCash,
    homeScore: userScore,
    awayScore: oppScore,
    goalEvents,
    oppGoalEvents,
  };
}
