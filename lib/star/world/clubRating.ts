import type { LeagueSquad } from "../types";
import type { CareerDivision } from "../calendar";
import { profileOf } from "../data/clubProfiles";

/**
 * HOW GOOD A CLUB IS (Mikey, 19 Oct 2026: "use the data that we already have
 * … most importantly, their actual squad ratings … for the leagues that
 * don't have real squad ratings, use other data such as current reputation").
 *
 * Two answers, in this order:
 *   1. A real squad (11 or more real players): the average of its best XI,
 *      to one decimal. Real FC 27 squads measured 19 Oct 2026: Arsenal 87,
 *      Man City 85, Liverpool 83 … Hull 74, Coventry 73.
 *   2. No real squad (invented players, or none fetched): the club's
 *      division level, moved by its club data against the rest of that
 *      division — current reputation 70%, historical reputation 15%,
 *      transfer spending 15% (all 1-10 in the club sheets) — at most ±4.
 *
 * An invented squad's own XI is NOT used: its ratings come from a hash of the
 * club's name (leagueSquads.ts generatedSquad), so it says nothing about the
 * club. Pure.
 */

/** A division's level for a club with no real squad: the game's own
 *  division averages (leagueSquads.ts avgOverallFor, promotion.ts). */
export type RatingTier = CareerDivision | "step3";

export const DIVISION_LEVEL: Record<RatingTier, number> = {
  premier: 78,
  championship: 70,
  league_one: 63,
  league_two: 58,
  national_league: 55,
  national_league_north: 53,
  national_league_south: 53,
  step3: 50,
};

/** Points of rating per point of club-data score above the division's mean. */
const DATA_SLOPE = 1.6;
/** Club data moves a club at most this far from its division's level. */
const DATA_CAP = 4;
/** Real players needed before a squad counts as real. */
const REAL_PLAYERS = 11;

/** Is this one of the game's invented players? (leagueSquads.ts generatedSquad) */
export function isInventedPlayer(id: string): boolean {
  return id.startsWith("gen:");
}

/** The best XI's average, to one decimal, when the squad is real; else null. */
export function squadRating(squad: LeagueSquad | undefined): number | null {
  if (!squad || squad.players.length < REAL_PLAYERS) return null;
  const real = squad.players.filter(p => !isInventedPlayer(p.id)).length;
  if (real < REAL_PLAYERS) return null;
  const xi = squad.players.slice(0, 11);
  return Math.round((xi.reduce((s, p) => s + p.overall, 0) / xi.length) * 10) / 10;
}

/** A club's data score, 1-10. Absent data reads as the middle of the scale. */
export function dataScore(club: string): number {
  const p = profileOf(club);
  const cur = p?.currentRep ?? 3;
  const hist = p?.historicalRep ?? cur;
  const spend = p?.transferSpending ?? cur;
  return cur * 0.7 + hist * 0.15 + spend * 0.15;
}

const meanCache = new Map<string, number>();

function meanScore(peers: readonly string[]): number {
  const key = peers.join("|");
  const hit = meanCache.get(key);
  if (hit !== undefined) return hit;
  const m = peers.length ? peers.reduce((s, c) => s + dataScore(c), 0) / peers.length : 3;
  if (meanCache.size > 64) meanCache.clear();
  meanCache.set(key, m);
  return m;
}

/**
 * A club with no real squad: its division's level (or the level its club
 * sheet gives, for the regional divisions and Step 3), moved by its data
 * against `peers` (the clubs it shares that division with).
 */
export function dataRating(club: string, division: RatingTier, peers: readonly string[]): number {
  const given = profileOf(club)?.avgRating;
  const regional = division === "national_league_north" || division === "national_league_south" || division === "step3";
  const base = (regional && given !== undefined ? given : DIVISION_LEVEL[division]) ?? 60;
  const shift = Math.max(-DATA_CAP, Math.min(DATA_CAP, (dataScore(club) - meanScore(peers)) * DATA_SLOPE));
  return Math.round((base + shift) * 10) / 10;
}

/** The one answer: real squad first, club data otherwise. */
export function rateClub(
  club: string, squad: LeagueSquad | undefined, division: RatingTier, peers: readonly string[],
): number {
  return squadRating(squad) ?? dataRating(club, division, peers);
}
