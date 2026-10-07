import type { CareerState, MatchStats, GoalEvent, OppGoalEvent, Fixture } from "./types";
import { wageForFixture } from "./wages";
import { sponsorPayFor } from "./sponsorDeals";
import { getTuning } from "./tuningStore";
import { capRel } from "./relationships";

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
 * FAIR RATINGS (item 26, v0.15).
 *
 * liveRating counts every chance that was not a goal or an assist as wasted —
 * including a pass that found its man and a dribble past your defender, so a
 * good pass cost 0.35 and earned 0.05. Measured: a starter averaged 5.14
 * (5.98 with that fixed). Here only a REAL miss costs you — a shot that did
 * not go in, or the ball lost (tackled, cut out, run out of play) — and a
 * completed pass or a dribble won is a plus. Same 6.0 start, same goal /
 * assist / result values, same waste penalty and cap.
 *
 * `parts` lists every thing that moved it off 6.0 (kept for tests and tools;
 * the post-match screen shows the list of your chances instead).
 */
export interface FairTally {
  goals: number;
  assists: number;
  /** Passes that reached a team-mate (including ones he then scored or missed from). */
  passes: number;
  /** Runs where you beat your man and got through. */
  dribbles: number;
  /** Your own shots that did not go in. */
  misses: number;
  /** Balls you lost: tackled, a pass cut out, a run that ended in a tackle. */
  lost: number;
  // ── The ratings revamp (Mikey, 6 Oct 2026) ──
  // Each of these is a part of the total above it. Whatever is not split out
  // counts as the plain kind: a goal in the box, a medium pass, a shot off
  // target. So an old tally with none of them still rates sensibly.
  /** Goals from the penalty spot / from the six-yard box / from outside the box. */
  goalsPen?: number; goalsTap?: number; goalsOut?: number;
  /** Completed passes that were safe / ambitious (the rest are medium). */
  passesSafe?: number; passesAmb?: number;
  /** Misses that were saved, blocked or hit the frame / penalties missed /
   *  one-on-ones not scored (the rest went off target). */
  missesOn?: number; missesPen?: number; misses1v1?: number;
}
export interface RatingPart { label: string; value: number }

export const DRIBBLE_RATING = 0.15;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * FAIR RATINGS, REVAMPED (Mikey, 6 Oct 2026). Start at 6.0; each chance adds
 * what its ending is worth (every value is a "Match Rating" dial in tuning.ts):
 *
 *   goal: penalty +0.72, six-yard box +0.85, rest of the box +1.0, outside +1.25
 *   assist +0.8, on top of the pass that made it
 *   completed pass: safe +0.10, medium +0.15, ambitious +0.25
 *   dribble won +0.15
 *   shot saved / blocked / off the frame −0.20, off target −0.35
 *   one-on-one not scored −0.75, penalty missed −0.72
 *   ball lost −0.30
 *
 * then the result (win +0.4, draw +0.1, defeat −0.3). Misses and lost balls
 * together take off at most rating.maxWastePenalty.
 */
export function fairRating(t: FairTally, userScore: number, oppScore: number): { rating: number; parts: RatingPart[] } {
  const parts: RatingPart[] = [];
  const add = (label: string, value: number) => { if (Math.abs(value) > 1e-9) parts.push({ label, value }); };
  const g = getTuning;
  const gPen = t.goalsPen ?? 0, gTap = t.goalsTap ?? 0, gOut = t.goalsOut ?? 0;
  const gBox = Math.max(0, t.goals - gPen - gTap - gOut);
  add(plural(gPen, "penalty", "penalties") + " scored", gPen * g("rating.goalPenalty"));
  add(plural(gTap, "tap-in"), gTap * g("rating.goalTapIn"));
  add(plural(gBox, "goal") + " in the box", gBox * g("rating.goalBox"));
  add(plural(gOut, "goal") + " from outside the box", gOut * g("rating.goalOutside"));
  add(plural(t.assists, "assist"), t.assists * 0.8);
  const pSafe = t.passesSafe ?? 0, pAmb = t.passesAmb ?? 0;
  const pMed = Math.max(0, t.passes - pSafe - pAmb);
  add(plural(pSafe, "safe pass", "safe passes"), pSafe * g("rating.passSafe"));
  add(plural(pMed, "pass", "passes"), pMed * g("rating.passMedium"));
  add(plural(pAmb, "ambitious pass", "ambitious passes"), pAmb * g("rating.passAmbitious"));
  add(plural(t.dribbles, "dribble won", "dribbles won"), t.dribbles * DRIBBLE_RATING);
  add(userScore > oppScore ? "win" : userScore < oppScore ? "defeat" : "draw",
    userScore > oppScore ? 0.4 : userScore < oppScore ? -0.3 : 0.1);
  // The costs, capped together.
  const mOn = t.missesOn ?? 0, mPen = t.missesPen ?? 0, m1v1 = t.misses1v1 ?? 0;
  const mOff = Math.max(0, t.misses - mOn - mPen - m1v1);
  const costs: [string, number][] = [
    [plural(m1v1, "one-on-one") + " missed", m1v1 * g("rating.miss1v1")],
    [plural(mPen, "penalty", "penalties") + " missed", mPen * g("rating.missPenalty")],
    [plural(mOff, "shot") + " off target", mOff * g("rating.missOffTarget")],
    [plural(mOn, "shot") + " saved or blocked", mOn * g("rating.missOnTarget")],
    [plural(t.lost, "ball lost", "balls lost"), t.lost * g("rating.lostBall")],
  ];
  let room = g("rating.maxWastePenalty");
  for (const [label, cost] of costs) {
    const c = Math.min(room, cost);
    room -= c;
    add(label, -c);
  }
  const rating = Math.max(1, Math.min(10, 6.0 + parts.reduce((a, p) => a + p.value, 0)));
  return { rating, parts };
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
/**
 * Mikey, 6 Oct 2026: the old pull was too harsh. His numbers, for a full-game
 * 8.0 and a full-game 5.0:
 *
 *   minutes   90   60   45   20
 *   good     8.0  7.8  7.7  7.6
 *   bad      5.0  5.0  5.4  5.9
 *
 * So a good game keeps most of its lift, and a bad one is not softened at all
 * until you have played less than an hour. As a share of the distance from
 * 6.5 that is kept, read straight between his points for any minute (and on
 * the same slope below 20).
 */
const KEEP_GOOD: [number, number][] = [[20, 1.1 / 1.5], [45, 1.2 / 1.5], [60, 1.3 / 1.5], [90, 1]];
const KEEP_BAD: [number, number][] = [[20, 0.6 / 1.5], [45, 1.1 / 1.5], [60, 1], [90, 1]];
function keepShare(points: [number, number][], minutes: number): number {
  const m = Math.max(0, Math.min(90, minutes));
  for (let i = 1; i < points.length; i++) {
    const [m0, k0] = points[i - 1], [m1, k1] = points[i];
    if (m <= m1 || i === points.length - 1) {
      return Math.max(0, Math.min(1, k0 + (k1 - k0) * (m - m0) / (m1 - m0)));
    }
  }
  return 1;
}
export function regressForMinutes(rating: number, minutes: number): number {
  const keep = keepShare(rating >= 6.5 ? KEEP_GOOD : KEEP_BAD, minutes);
  return Math.max(1, Math.min(10, 6.5 + (rating - 6.5) * keep));
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
  /**
   * Item 26: the real misses and dribbles CanvasMatch counted. When given,
   * the rating is the fair one; absent, exactly the old formula.
   */
  tally?: { misses: number; lost: number; dribbles: number } & Partial<Pick<FairTally,
    "goalsPen" | "goalsTap" | "goalsOut" | "passesSafe" | "passesAmb" | "missesOn" | "missesPen" | "misses1v1">>,
): MatchStats {
  const fair = tally
    ? fairRating({ ...tally, goals, assists, passes }, userScore, oppScore)
    : null;
  const raw = fair ? fair.rating : liveRating(chances, goals, assists, passes, userScore, oppScore);
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
  // 30 Sep 2026: sponsor money is now your deals' weekly fees, paid with the
  // wage on the same fixture (lib/star/sponsorDeals.ts). No deals, no money.
  const sponsorPay = sponsorPayFor(career, fixture);
  const totalCash = wage + goalBonus + assistBonusPay + sponsorPay;

  // Mikey, 5 Oct 2026: losses match gains — a bad game costs the mirror of
  // what the same distance above an ordinary game earns — and no bar moves
  // more than MATCH_REL_CAP from one match (goals, assists and star man used
  // to stack a great game to +18).
  let boss = 0, team = 0, fans = 0;
  if (rating >= 8) { boss += 6; fans += 8; team += 3; }
  else if (rating >= 7) { boss += 3; fans += 4; team += 2; }
  // Mikey, 4 Oct 2026: an ordinary game is about 6.5, so 6.0-6.6 moves nothing.
  else if (rating >= 6.7) { boss += 1; fans += 1; team += 1; }
  else if (rating >= 6) { /* an ordinary game */ }
  else if (rating >= 5) { boss -= 3; fans -= 4; team -= 2; }
  else { boss -= 6; fans -= 8; team -= 3; }
  if (goals > 0) fans += goals * 3;
  if (assists > 0) { team += assists * 3; fans += assists; }
  if (starMan) { boss += 4; fans += 5; team += 2; }
  boss = capRel(boss); team = capRel(team); fans = capRel(fans);

  return {
    chances,
    goals,
    assists,
    passes,
    minutes,
    hooked,
    rating: Math.round(rating * 10) / 10,
    rawRating: Math.round(raw * 10) / 10,
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
