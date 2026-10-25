/**
 * HOW GOOD EACH CLUB'S PITCH IS (Leo, 22 Oct 2026, chat 4).
 *
 * "Really dry on a bad pitch, like a bad lower-league stadium, means less
 * bounce and the ball stops dead at worst." Plan: "Premier League grounds are
 * perfect, a National League ground in a dry spell can be poor."
 *
 * Built but shown ONLY on /star-weather-dev for now (plan 4a). The career
 * match never reads it.
 *
 * Quality 0..1 (1 = a perfect Premier League surface), from:
 *  - the division: the money for groundsmen, undersoil heating and hybrid
 *    grass falls away down the pyramid (PL 1.0 … Step 3 0.40);
 *  - the ground's size (CLUB_DATABASE / the club sheets): a 2,500-seat
 *    ground is a community pitch, a 30,000 one has a full ground staff;
 *  - the club's training-facility rating (1-10), a stand-in for how much it
 *    spends on its grass;
 *  - a small fixed per-club wobble (±0.05), so two clubs of one size differ.
 * The Premier League is always 1: every top-flight pitch is hybrid grass.
 */
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { profileOf } from "./data/clubProfiles";
import { divisionOf, PREMIER_LEAGUE_CLUBS, type Division } from "./clubs";

const BASE: Record<Division, number> = {
  premier: 1, champions: 0.98, europa: 0.96, championship: 0.9, pool: 0.85,
  league_one: 0.8, league_two: 0.7, national_league: 0.6,
  national_league_north: 0.5, national_league_south: 0.5,
  step3_north: 0.4, step3_south: 0.4,
};

function wobble(club: string): number {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) { h ^= club.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 4294967295 - 0.5) * 0.1;
}

export interface ClubPitch {
  club: string;
  division: Division | null;
  capacity: number | null;
  /** 0..1, 1 perfect. */
  quality: number;
  /** "perfect" | "good" | "fair" | "poor" | "very poor". */
  word: PitchWord;
}

export type PitchWord = "perfect" | "good" | "fair" | "poor" | "very poor";

export function pitchWord(q: number): PitchWord {
  if (q >= 0.95) return "perfect";
  if (q >= 0.8) return "good";
  if (q >= 0.62) return "fair";
  if (q >= 0.45) return "poor";
  return "very poor";
}

/** One club's home pitch. */
export function clubPitch(club: string): ClubPitch {
  // A Premier League club in Europe is tagged "champions"/"europa" by divisionOf.
  const division: Division | null = PREMIER_LEAGUE_CLUBS.includes(club) ? "premier" : divisionOf(club);
  const real = CLUB_DATABASE[club];
  const sheet = real ? undefined : profileOf(club);
  const capacity = real?.capacity ?? sheet?.capacity ?? null;
  const training = real?.trainingRating ?? sheet?.training;
  if (division === "premier") return { club, division, capacity, quality: 1, word: "perfect" };
  let q = division ? BASE[division] : 0.65;
  if (capacity != null) {
    if (capacity < 3000) q -= 0.08;
    else if (capacity < 6000) q -= 0.04;
    else if (capacity > 30000) q += 0.06;
    else if (capacity > 20000) q += 0.04;
  }
  if (training != null) q += Math.max(-0.04, Math.min(0.06, (training - 3) * 0.02));
  q += wobble(club);
  q = Math.round(Math.max(0.25, Math.min(0.99, q)) * 100) / 100;
  return { club, division, capacity, quality: q, word: pitchWord(q) };
}

/** The ground on the day: a dry spell bakes it, rain soaks it. */
export type Ground = "dry" | "normal" | "wet";

/**
 * The ground on a match day. Dry spells come at the ends of the season
 * (August-September, April-May: about 1 week in 3), never in winter. Seeded
 * so a fixture always has the same ground. Not read by the career yet.
 */
export function groundFor(season: number, week: number, raining: boolean): Ground {
  if (raining) return "wet";
  const edge = week <= 6 || week >= 34;
  if (!edge) return "normal";
  let h = Math.imul(season * 7307 + week * 131 + 17, 2654435761) >>> 0;
  h ^= h >>> 15;
  return (h % 100) < 35 ? "dry" : "normal";
}

/** The pre-match line: "Pitch: poor, dry". "Pitch: perfect" on a normal day. */
export function pitchLabel(quality: number, ground: Ground): string {
  const w = pitchWord(quality);
  // A perfect pitch is watered: a dry spell changes nothing, so it is not said.
  return ground === "normal" || (ground === "dry" && w === "perfect") ? `Pitch: ${w}` : `Pitch: ${w}, ${ground}`;
}
