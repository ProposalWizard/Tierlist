import type { CareerDivision } from "./calendar";
import { matchweeksFor } from "./calendar";
import { offerWageFor, offerStanding, weeklyWageFor } from "./economy";
import { startNegotiation, type NegotiationState } from "./negotiation";
import { STAGE_LABEL, TRIAL_STAGES, trialScore, type TrialProgress, type TrialStage } from "./trial";

/**
 * THE CONVERSATION BEFORE THE CONTRACT.
 *
 * ── What was wrong ──
 *
 * The trial ended and the game cut straight to a newspaper full of offers.
 * Nobody ever said anything to you. The one man who had actually stood on
 * the touchline and watched you play for an afternoon — the reason the
 * whole opening exists — never opened his mouth, and the first thing you
 * learned about your own performance was a number on a back page.
 *
 * So: he sits you down first. He says what he thought, he says what he is
 * prepared to pay, and then you haggle over it. The newspaper still
 * follows, unchanged — it is the payoff and it stays the payoff.
 *
 * ── What is reused, and why nothing here is a second negotiation engine ──
 *
 * `negotiation.ts` already is one: a real round-based haggle where the
 * counterpart anchors away from the fair value, concedes a little each
 * round scaled by a mood, and walks away if you push a mood that has
 * already gone. `NegotiationScreen.tsx` already draws it as two desks with
 * the counterpart's mood on an actual face. Both are used here exactly as
 * they are, with `mode: "selling"` — you are the one with something to sell
 * and the club is the buyer who opens below what it is worth.
 *
 * This file's whole job is to work out WHAT NUMBER goes into that engine,
 * and to give the manager something true to say.
 *
 * ── The one place the existing engine genuinely does not fit, and the fix ──
 *
 * `cleanRound` (negotiation.ts) rounds every position the counterpart takes
 * to a sayable number — steps of ★100 below ★5,000, with a hard floor of one
 * step. That is right for transfer fees, which is what it was written for.
 * It is catastrophic for a WEEKLY WAGE at the bottom of this game's ladder:
 * a National League first contract is ★10-★48 a week, so every position in
 * the negotiation would round to ★100 and a floor of ★100 would be ten times
 * the real wage.
 *
 * negotiation.ts is not this lane's file to change, and forking it for one
 * rounding helper would be exactly the second engine this was told not to
 * build. So the negotiation is conducted in the unit that makes the existing
 * rounding sensible: **the season's wages**, weekly × `matchweeksFor` — a
 * real, already-defined season length (38 or 46), not an invented constant.
 * ★10 a week becomes ★460 for the season, where ★100 steps are granularity
 * rather than distortion. The agreed figure is divided straight back down to
 * a weekly wage, which is the only number the rest of the game ever sees.
 */

/** What the fair weekly wage is worth over a whole season at this level. */
export function seasonWeeks(division: CareerDivision): number {
  return matchweeksFor(division);
}

export function weeklyToSeason(weekly: number, division: CareerDivision): number {
  return Math.max(1, Math.round(weekly * seasonWeeks(division)));
}

export function seasonToWeekly(season: number, division: CareerDivision): number {
  return Math.max(1, Math.round(season / seasonWeeks(division)));
}

// ═══════════════════════════════════════════════════════════════════════
//  WHAT YOU ARE WORTH TO THEM
// ═══════════════════════════════════════════════════════════════════════

/**
 * The afternoon, put on the same 0-100 scale a CLUB is measured on.
 *
 * `offerStanding(reputation, strengthStep)` (economy.ts) already has exactly
 * the right shape for a first contract, and it wants two things: how well
 * known you are, and how big a step up this club is for you. A trialist has
 * no reputation and no club, so both have to come from the one thing that
 * does exist — the trial score.
 *
 * Reputation is the easy half: what the football world knows about you IS
 * the afternoon they watched, so the score goes in directly.
 *
 * The step is this function. A trial score maps onto the same ladder the
 * offers themselves come off — the bottom of the range is National League
 * standard, the top is Premier League standard — so signing for a club at
 * your own level is a step of zero, and signing for one well above you is a
 * real step up that costs you standing, which is what it should.
 *
 * The consequence, and the whole point: a better trial raises the wage
 * TWICE — once through reputation, and again by shrinking the step. That is
 * "a great trial means a stronger hand" as an actual mechanism rather than
 * a sentence.
 */
export const TRIALIST_STRENGTH_FLOOR = 42;   // National League standard
export const TRIALIST_STRENGTH_CEILING = 80; // Premier League standard

export function trialistStrength(trialScore: number): number {
  const s = Math.max(0, Math.min(100, Number.isFinite(trialScore) ? trialScore : 0)) / 100;
  return TRIALIST_STRENGTH_FLOOR + s * (TRIALIST_STRENGTH_CEILING - TRIALIST_STRENGTH_FLOOR);
}

/**
 * The fair weekly wage for this deal — what the negotiation is anchored on.
 *
 * Straight through `offerWageFor`, the one function every other contract in
 * the game is priced by. Nothing is invented here and nothing bypasses the
 * ladder: whatever is agreed at the end of the haggle still has to have
 * started from this.
 */
export function fairWageFor(
  club: string, division: CareerDivision, clubStrength: number, trialScoreOutOf100: number,
): number {
  return offerWageFor(
    club, division, trialScoreOutOf100,
    clubStrength - trialistStrength(trialScoreOutOf100),
    0,
  );
}

/** How well thought of the club's own offer says you are — shown in the
 *  conversation so "they rate you" is a number rather than a mood. */
export function standingFor(clubStrength: number, trialScoreOutOf100: number): number {
  return offerStanding(trialScoreOutOf100, clubStrength - trialistStrength(trialScoreOutOf100));
}

// ═══════════════════════════════════════════════════════════════════════
//  WHAT HE ACTUALLY SAYS
// ═══════════════════════════════════════════════════════════════════════

export interface ManagerTalk {
  club: string;
  division: CareerDivision;
  /** His verdict, three or four short lines. */
  lines: string[];
  /** The stage he singles out as your best, and your worst. */
  best: TrialStage | null;
  worst: TrialStage | null;
  /** The fair weekly wage, and what he actually opens with (below it). */
  fairWeekly: number;
  openingWeekly: number;
  /** The negotiation, already opened at exactly the number he just said, so
   *  the conversation and the haggle cannot disagree. Handed to
   *  NegotiationScreen as `initialState`. */
  negotiation: NegotiationState;
}

function bestAndWorst(trial: TrialProgress): { best: TrialStage | null; worst: TrialStage | null } {
  let best: TrialStage | null = null, worst: TrialStage | null = null;
  let bestScore = -1, worstScore = 101;
  for (const stage of TRIAL_STAGES) {
    const r = trial.results[stage];
    if (!r) continue;
    if (r.score > bestScore) { bestScore = r.score; best = stage; }
    if (r.score < worstScore) { worstScore = r.score; worst = stage; }
  }
  // One stage played is not a best AND a worst — that reads as a contradiction.
  if (best === worst) worst = null;
  return { best, worst };
}

/**
 * The man who watched you, talking.
 *
 * Every line is driven by something real: the score he actually saw, the
 * stage you were genuinely best at, the stage you were genuinely worst at,
 * and the division his club is in. Nothing here is a generic
 * congratulations — a 38 gets told it was a 38.
 */
export function managerTalkFor(args: {
  trial: TrialProgress;
  club: string;
  division: CareerDivision;
  clubStrength: number;
  playerFirstName: string;
  rng: () => number;
}): ManagerTalk {
  const { trial, club, division, clubStrength, playerFirstName, rng } = args;
  const score = trialScore(trial);
  const { best, worst } = bestAndWorst(trial);

  const fairWeekly = fairWageFor(club, division, clubStrength, score);
  const negotiation = startNegotiation(
    weeklyToSeason(fairWeekly, division), "selling", rng,
  );
  const openingWeekly = seasonToWeekly(negotiation.theirPosition, division);

  const opener = score >= 85
    ? `${playerFirstName}. I have been doing this a long time and I do not say this often — that was the best afternoon anybody has had on that pitch this year.`
    : score >= 70
      ? `${playerFirstName}. Sit down. I liked what I saw, and I do not say that to be kind.`
      : score >= 50
        ? `${playerFirstName}. There is something there. It is rough, and it is there.`
        : `${playerFirstName}. I will be straight with you, because nobody else will be.`;

  const onBest = best
    ? score >= 50
      ? `The ${STAGE_LABEL[best].toLowerCase()} — that is the bit I keep thinking about.`
      : `The ${STAGE_LABEL[best].toLowerCase()} was the one thing that stood up.`
    : "";

  const onWorst = worst
    ? `The ${STAGE_LABEL[worst].toLowerCase()} is nowhere near it yet. We would work on that every day.`
    : "";

  const onClub = `We are ${club}. You would be training with us from Monday.`;

  return {
    club, division,
    lines: [opener, onBest, onWorst, onClub].filter(Boolean),
    best, worst,
    fairWeekly,
    openingWeekly,
    negotiation,
  };
}

/**
 * What the manager will not go below, whatever happens at the table.
 *
 * A walkout is real and it costs you the offer — but a deal agreed at an
 * absurd number would break the wage ladder just as surely as ignoring the
 * curve in the first place. `weeklyWageFor(club, division, 0)` is the
 * bottom of the club's own band, and no professional contract can land
 * under it.
 */
export function wageFloorFor(club: string, division: CareerDivision): number {
  return weeklyWageFor(club, division, 0);
}

/** The agreed weekly wage, from whatever the negotiation closed at — or
 *  `null` when the talks broke down, which really does mean no deal. */
export function agreedWeeklyWage(
  finalSeasonPrice: number | null, club: string, division: CareerDivision,
): number | null {
  if (finalSeasonPrice === null) return null;
  return Math.max(wageFloorFor(club, division), seasonToWeekly(finalSeasonPrice, division));
}
