import type { CareerState } from "./types";
import { mulberry32 } from "./season";
import { clubNameSeed } from "./squadData";
import { loadLineup } from "./lineupStore";

/**
 * THE MANAGER
 *
 * Your standing with "the boss" was a relationship with nobody. It had no name,
 * it never changed hands, and a number you had spent five seasons building could
 * not be taken away by anything except your own form.
 *
 * There is a man in the job now, and he can lose it. A bad enough season and the
 * board sack him, and the one who walks in has never picked you — everything you
 * built with the last one goes with him. It is the harshest thing in the career
 * and it is the most true: it is how a settled player becomes a squad player
 * without kicking a ball differently.
 *
 * He also has a way of doing things. A manager who trusts his players is slower
 * to drop you and slower to bring you back; one who rotates is the opposite.
 * That is the whole of it — no hidden tactics, nothing you cannot see on the
 * dashboard.
 */

const FIRST = ["Alan", "Roberto", "Klaus", "Diego", "Sean", "Marcelo", "Henrik", "Paul", "Gianluca", "Owen", "Bruno", "Terry"];
const LAST = ["Whitfield", "Marchetti", "Voss", "Almeida", "Doherty", "Ferreira", "Lindberg", "Ashcroft", "Bianchi", "Pryce", "Salgado", "Hobbs"];

export type ManagerStyle = "trusting" | "demanding" | "rotational";

export interface Manager {
  name: string;
  style: ManagerStyle;
  /** The season he took over. */
  since: number;
  /** How he described the job when he arrived. */
  arrival: string;
}

const STYLE_BLURB: Record<ManagerStyle, string> = {
  trusting: "Picks a side and sticks with it. Slow to drop you, slow to bring you back.",
  demanding: "Expects a lot, every week. Form is the only currency with him.",
  rotational: "Rotates freely. Nobody is guaranteed, and nobody is frozen out.",
};

/**
 * How a manager's way of doing things bends selection.
 *
 * Deliberately small and symmetric: a trusting manager is harder to lose your
 * place with AND harder to win it back from, so no style is simply better. It
 * shifts the bar rather than the player.
 */
export const STYLE_SELECTION: Record<ManagerStyle, { start: number; bench: number }> = {
  trusting: { start: -4, bench: -4 },
  demanding: { start: +5, bench: +2 },
  rotational: { start: 0, bench: -6 },
};

export function makeManager(career: CareerState, club: string, season: number): Manager {
  const rng = mulberry32(clubNameSeed(club) + season * 7717 + Math.round(career.starRating * 7));
  // Rolled either way, so the style/tenure sequence below never shifts
  // depending on whether a real name is on file for this club.
  const generatedName = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
  const roll = rng();
  const style: ManagerStyle = roll < 0.38 ? "trusting" : roll < 0.72 ? "demanding" : "rotational";
  // Typed in for this club on the Squad Builder / Lineups screen (see
  // lineupStore.ts) — use the real name on the touchline instead of a
  // fictional one when there is one on file. Everything else about him
  // (style, tenure, whether he gets sacked) is still simulated; only the
  // database has no real managers, not the game.
  const real = loadLineup(club)?.manager?.trim();
  return {
    name: real || generatedName,
    style,
    since: season,
    arrival: STYLE_BLURB[style],
  };
}

export function styleBlurb(style: ManagerStyle): string {
  return STYLE_BLURB[style];
}

/**
 * What a new manager thinks of you before he has seen you play.
 *
 * Not a full reset to zero — he has watched the tapes, and a player with a real
 * reputation walks in with something. But nothing like the relationship you had
 * with the man who just left, which is the entire point.
 */
export function bossOnArrival(career: CareerState): number {
  return Math.round(Math.max(35, Math.min(68, 42 + career.starRating * 5)));
}

export interface SackVerdict {
  sacked: boolean;
  reason: string;
}

/**
 * Whether the board have seen enough.
 *
 * Judged on the season the club just had, not on you — a manager is not sacked
 * because one of his forwards had a quiet year. A manager in his first season
 * gets more rope, because sacking someone after nine months for a squad he
 * inherited is the kind of thing that reads as arbitrary even when it is
 * realistic.
 */
export function sackCheck(career: CareerState, seasonScore: number): SackVerdict {
  const m = career.manager;
  if (!m) return { sacked: false, reason: "" };
  const firstSeason = career.season - m.since < 1;
  const bar = firstSeason ? -0.72 : -0.45;
  if (seasonScore <= bar) {
    return {
      sacked: true,
      reason: seasonScore <= -0.8
        ? `${m.name} is sacked. The board had seen enough long before the end.`
        : `${m.name} is sacked after a season below what the board wanted.`,
    };
  }
  return { sacked: false, reason: "" };
}
