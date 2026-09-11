import type { CareerState } from "./types";
import { simulateFixtureScore } from "./season";
import { resolvePenalties } from "./ruleBook";
import { type GoverningBody, canProposeRuleChange } from "./governingBodies";

/**
 * NEW COMPETITION CREATION — PHASE 6 OF STAR_POWER_POLITICS.MD, §4.4 #12.
 *
 * A breakaway Super League of the world's best clubs, or an entirely new
 * cup — "possibly international." Deliberately standalone rather than
 * reusing cups.ts's real FA Cup/League Cup machinery (a 32-club hat draw
 * tied specifically to those two named competitions and the calendar's own
 * cup-week scheduling) — building a brand-new competition risked either
 * warping that tested system to fit a shape it wasn't built for, or half-
 * coupling to it. This is a genuinely new, generic single-elimination
 * bracket instead: real matches, a real winner, resolved statistically
 * (like any competition the player isn't personally in — see euro.ts's own
 * `crownWithoutYou`) rather than played out shot-by-shot, since a brand
 * new competition the player may not even be entered into has nowhere
 * established to hook a live, interactive match into yet. Gated behind the
 * same governing-body-influence bar as PROPOSING a Rule Book change —
 * disruptive, but not the same "overrule anybody" tier as forcing a club's
 * league position (forcedMovement.ts).
 */

export interface CompetitionResult {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  onPenalties: boolean;
}

export interface NewCompetitionState {
  id: string;
  name: string;
  round: number;
  /** The clubs still alive, in next-round match-up order. */
  clubs: string[];
  winner: string | null;
  history: { round: number; results: CompetitionResult[] }[];
}

export function canCreateCompetition(career: CareerState, body: GoverningBody): boolean {
  return canProposeRuleChange(career, body);
}

/** Entrants are trimmed to the largest clean power-of-two bracket a real
 *  knockout needs — never padded with an invented "bye" club that was
 *  never part of this world. */
function bracketSize(entrantCount: number): number {
  if (entrantCount < 2) return 0;
  return Math.pow(2, Math.floor(Math.log2(entrantCount)));
}

export function createCompetition(id: string, name: string, entrants: string[]): NewCompetitionState | { ok: false; reason: string } {
  const size = bracketSize(entrants.length);
  if (size < 2) return { ok: false, reason: "Needs at least two real clubs to hold a competition" };
  const clubs = entrants.slice(0, size);
  return { id, name, round: 0, clubs, winner: clubs.length === 1 ? clubs[0] : null, history: [] };
}

/** Play exactly one round — every tie resolved for real, a draw settled on
 *  penalties (the same quality-weighted coin ruleBook.ts's own no-draws
 *  rule and euro.ts's tie-breaker already use, reused rather than
 *  reinvented a third time). */
export function playCompetitionRound(
  state: NewCompetitionState, strengthOf: (club: string) => number, rng: () => number,
): NewCompetitionState {
  if (state.winner || state.clubs.length < 2) return state;
  const results: CompetitionResult[] = [];
  const nextClubs: string[] = [];
  for (let i = 0; i + 1 < state.clubs.length; i += 2) {
    const home = state.clubs[i], away = state.clubs[i + 1];
    const hs = strengthOf(home), as = strengthOf(away);
    const sc = simulateFixtureScore(hs, as, rng);
    let onPenalties = false;
    let winner: string;
    if (sc.home !== sc.away) winner = sc.home > sc.away ? home : away;
    else { onPenalties = true; winner = resolvePenalties(hs, as, rng) === "a" ? home : away; }
    nextClubs.push(winner);
    results.push({ home, away, homeScore: sc.home, awayScore: sc.away, onPenalties });
  }
  return {
    ...state,
    round: state.round + 1,
    clubs: nextClubs,
    winner: nextClubs.length === 1 ? nextClubs[0] : null,
    history: [...state.history, { round: state.round, results }],
  };
}

/** Play every remaining round at once, straight to a real winner — the
 *  same "resolve the whole thing now" shape euro.ts's own
 *  `crownWithoutYou` already uses for a competition the player has no
 *  personal stake in playing out round by round. */
export function playCompetitionToWinner(
  state: NewCompetitionState, strengthOf: (club: string) => number, rng: () => number,
): NewCompetitionState {
  let s = state;
  let guard = 0;
  while (!s.winner && s.clubs.length >= 2 && guard < 20) { s = playCompetitionRound(s, strengthOf, rng); guard++; }
  return s;
}
