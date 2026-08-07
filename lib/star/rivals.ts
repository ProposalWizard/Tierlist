/**
 * DERBIES
 *
 * Every fixture was the same fixture. The one against the club down the road
 * counted for exactly as much as a Tuesday night against a mid-table side, which
 * is the one thing about football everybody knows is not true.
 *
 * A derby changes nothing about how the match is played and everything about
 * what it is worth. §17.11: "Not every fixture should carry equal weight… The
 * player's emotional investment should naturally increase alongside the
 * importance of the fixture." So: the same football, louder consequences.
 */

/**
 * Who each club hates, as a fixed symmetric pairing.
 *
 * Derived from the division rather than a hardcoded list, so it works whatever
 * clubs a career is set up with. Alphabetical order, paired off in twos — stable
 * across seasons, symmetric by construction (if they are your rivals, you are
 * theirs), and never a club paired with itself. With an odd number of teams the
 * last one is left without a derby, which is better than inventing a
 * one-sided rivalry.
 */
export function rivalMap(clubs: string[]): Map<string, string> {
  const sorted = [...clubs].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    map.set(sorted[i], sorted[i + 1]);
    map.set(sorted[i + 1], sorted[i]);
  }
  return map;
}

export function rivalOf(club: string, clubs: string[]): string | null {
  return rivalMap(clubs).get(club) ?? null;
}

export function isDerby(club: string, opponent: string, clubs: string[]): boolean {
  return rivalOf(club, clubs) === opponent;
}

/**
 * How much more a derby is worth.
 *
 * Applied to the relationship swings, not to the football. Winning one is worth
 * roughly double to the supporters and half again to the dressing room; losing
 * one costs the same way. The manager is the least moved of the three, because
 * three points are three points to him.
 */
export const DERBY_MULTIPLIER = {
  fans: 2.0,
  team: 1.5,
  boss: 1.15,
} as const;

/** A line for the team sheet. */
export function derbyLabel(opponent: string): string {
  return `Derby day. ${opponent}.`;
}
