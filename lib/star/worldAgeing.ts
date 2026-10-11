import type { LeaguePlayer, LeagueSquad, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { FIRST_NAMES, LAST_NAMES } from "./squadData";
import { averageStartingXIRating, TRAINING_TIER_MULTIPLIER, FREE_AGENTS_CLUB } from "./leagueSquads";
import { shortNameOf } from "./realSquad";
import { fakeFaceFor } from "./fakeFaces";

/**
 * A WORLD THAT AGES.
 *
 * Before this, only YOUR age went up. Every other footballer in the game —
 * the rest of your division, the wider world, your own team-mates — stayed
 * the same man at the same age with the same rating for all twenty seasons
 * (Leo, 5 Oct 2026: "20 seasons on the squads are the same people at the
 * same ages"). Run once a season, at the rollover (careerFlow.ts
 * advanceSeason), after growWonderkids:
 *
 *  - everybody gets a year older;
 *  - his rating moves along an age curve: young men grow (faster at a club
 *    with a better training ground), 25–28 hold, 29+ decline, faster from 33;
 *    the six stats move with the rating, pace falling first;
 *  - from 33 men retire, each at his own fixed age (33–40, keepers later);
 *  - each man who retires is replaced, in his own position, by an invented
 *    16–19-year-old ("regen") rated to the club's level.
 *
 * Every roll is keyed off the player's own id and the season, never a shared
 * stream. So the same real player ages the same way in every copy of him
 * (your own `career.squad` and your club's `leagueSquads` entry), and a
 * squad fetched fresh from the database in season 9 can be brought up to
 * date (catchUpFetchedSquads) to the same answer it would have reached by
 * living through those eight rollovers.
 */

/** Seasons are aged from this age onward if the player has no age at all
 *  (an invented squad): a stable 20–32, off his id. An invented squad's
 *  ratings are flat, not shaped by age, so it is read as grown men —
 *  younger, they would all "grow" into ratings the club never had. */
export function startingAgeFor(key: string): number {
  return 20 + Math.floor(hash01(`${key}|age`) * 13);
}

/** How likely each retirement age is, 33 to 40 (sums to 1). Rising from 33,
 *  nearly everyone gone by 38, nobody past 40. Keepers two years later. */
export const RETIREMENT_AGE_WEIGHTS: [number, number][] = [
  [33, 0.08], [34, 0.14], [35, 0.22], [36, 0.22], [37, 0.16], [38, 0.10], [39, 0.06], [40, 0.02],
];
export const KEEPER_EXTRA_YEARS = 2;

/** The age at which this man plays his last season. Fixed for life. */
export function retirementAgeFor(key: string, position: string): number {
  const s = hash01(`${key}|retire`);
  let acc = 0;
  let age = 40;
  for (const [a, w] of RETIREMENT_AGE_WEIGHTS) {
    acc += w;
    if (s < acc) { age = a; break; }
  }
  return position === "GK" ? age + KEEPER_EXTRA_YEARS : age;
}

/** Mean rating change in the season he turns `age + 1`. */
export function meanAgeChange(age: number): number {
  if (age <= 17) return 4.5;
  if (age === 18) return 4;
  if (age === 19) return 3.5;
  if (age === 20) return 3;
  if (age === 21) return 2.5;
  if (age === 22) return 2;
  if (age === 23) return 1.5;
  if (age === 24) return 1;
  if (age === 25) return 0.5;
  if (age <= 28) return 0;
  if (age === 29) return -0.4;
  if (age === 30) return -0.9;
  if (age === 31) return -1.4;
  if (age === 32) return -1.9;
  if (age === 33) return -2.6;
  if (age === 34) return -3.1;
  return -3.6;
}

/** Talent: how much of the young-player growth this man gets, 0.5–1.5. */
function talentOf(key: string): number {
  return 0.5 + hash01(`${key}|talent`);
}

/** How far above his club's level a young player's growth can carry him,
 *  for an average talent; talent moves it ±TALENT_SPREAD. */
export const CEILING_ABOVE_LEVEL = 2;
export const TALENT_SPREAD = 8;

/**
 * One season's rating change. Growth is scaled by talent and the club's
 * training ground, and fades out as he nears his own ceiling (his club's
 * level, plus or minus his talent) and the top of the game (a 65 grows in
 * full, an 85 at a fifth). Decline is not scaled. ±1.5 of noise either
 * way, so peers do not move in lockstep.
 */
export function ratingChange(
  age: number, overall: number, rng: () => number, talent: number, trainingMultiplier: number,
  clubLevel?: number,
): number {
  let mean = meanAgeChange(age);
  if (mean > 0) {
    const nearTop = Math.max(0.1, Math.min(1, (90 - overall) / 14));
    const ceiling = clubLevel === undefined ? 99 : clubLevel + CEILING_ABOVE_LEVEL + (talent - 1) * 2 * TALENT_SPREAD;
    const nearCeiling = Math.max(0, Math.min(1, (ceiling - overall) / 5));
    mean *= talent * trainingMultiplier * nearTop * nearCeiling;
  }
  const noise = (rng() + rng() - 1) * 1.5;
  return Math.round(mean + noise);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The six stats, moved with the rating; pace goes first, then physical. */
type StatBag = Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>>;
function shiftedStats<T extends StatBag>(
  p: T, delta: number, age: number,
): Partial<T> {
  const out: Record<string, number> = {};
  const paceExtra = age >= 33 ? -2 : age >= 30 ? -1 : 0;
  const physExtra = age >= 33 ? -1 : 0;
  for (const k of ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const) {
    const v = p[k];
    if (typeof v !== "number" || !v) continue;
    const extra = k === "pace" ? paceExtra : k === "physical" ? physExtra : 0;
    const next = clamp(v + delta + extra, 20, 99);
    if (next !== v) out[k] = next;
  }
  return out as Partial<T>;
}

/** Ids that are never aged or retired: your son is aged by his own rules. */
function exempt(id: string): boolean {
  return id.startsWith("son:");
}

/** A player's key for every roll: the database id, whichever copy he is. */
function keyOfLeague(p: LeaguePlayer, club: string): string {
  return p.id.startsWith("sp_") ? `${club}:${p.id}` : p.id;
}
function keyOfSquad(p: SquadPlayer, club: string): string {
  if (p.sofifaId) return p.sofifaId;
  if (p.id.startsWith("sf_")) return p.id.slice(3);
  return p.id.startsWith("sp_") ? `${club}:${p.id}` : p.id;
}

// A few surnames nobody famous owns, beside the generator's own lists, so
// that seven thousand regens over twenty seasons are not all "Jack Smith".
// The famous ones in LAST_NAMES/FIRST_NAMES are left out: "Andres Modric"
// sitting in a real squad was reported once already (leagueSquads.ts).
const FAMOUS = new Set(["Mbappe", "Modric", "Muller", "Salah", "Firmino", "Mane", "Cancelo", "Zaha", "Sterling",
  "Kovacic", "Perisic", "Werner", "Suarez", "Toney", "Watkins", "Kylian", "Vinicius", "Rodrygo", "Riyad"]);
const EXTRA_SURNAMES = [
  "Hughes", "Dawson", "Price", "Fletcher", "Holt", "Bennett", "Carver", "Lowe", "Pearce", "Doyle",
  "Kerr", "Nolan", "Okafor", "Mensah", "Adeyemi", "Owusu", "Bakari", "Sall", "Ndiaye", "Kamara",
  "Fonseca", "Pires", "Almeida", "Navarro", "Ortega", "Rivas", "Castro", "Vidal", "Romero", "Iglesias",
  "Petit", "Lambert", "Girard", "Roux", "Brandt", "Vogel", "Keller", "Novak", "Horvat", "Larsen",
  "Lindqvist", "Jansen", "De Vries", "Bakker", "Rossi", "Bianchi", "Esposito", "Moretti", "Conti", "Ferri",
];
const REGEN_FIRST = FIRST_NAMES.filter(n => !FAMOUS.has(n));
const REGEN_LAST = [...LAST_NAMES.filter(n => !FAMOUS.has(n)), ...EXTRA_SURNAMES];

function regenName(rng: () => number): string {
  return `${REGEN_FIRST[Math.floor(rng() * REGEN_FIRST.length)]} ${REGEN_LAST[Math.floor(rng() * REGEN_LAST.length)]}`;
}

/** Chance a regen is scouted High Potential, and of those World Class. */
export const REGEN_HIGH_POTENTIAL = 0.06;
export const REGEN_WORLD_CLASS = 0.15;

/** What a regen comes in at, relative to the club's starting XI average. */
export const REGEN_BELOW_LEVEL = 11;

interface Regen {
  id: string; name: string; age: number; overall: number;
  highPotential?: true; worldClassPotential?: true;
}

/** A regen's id: "rg<season>." and a hash of the man he replaced. Short on
 *  purpose — after twenty seasons nearly every saved player is one. */
export function isRegenId(id: string): boolean {
  return /^rg\d+\./.test(id);
}

/**
 * The boy who replaces a retiring man. Same id, name and rating in every
 * copy of the squad (keyed off the season and the man he replaces).
 */
export function makeRegen(retireeKey: string, season: number, clubLevel: number): Regen {
  const id = `rg${season}.${hashInt(retireeKey).toString(36)}${hashInt(`${retireeKey}~`).toString(36).slice(0, 4)}`;
  const rng = mulberry32(hashInt(id));
  const r = rng();
  const age = r < 0.1 ? 16 : r < 0.4 ? 17 : r < 0.75 ? 18 : 19;
  const overall = clamp(Math.round(clubLevel - REGEN_BELOW_LEVEL - (19 - age) * 2 + (rng() * 6 - 3)), 35, 85);
  const name = regenName(rng);
  const hp = rng() < REGEN_HIGH_POTENTIAL;
  const wc = hp && rng() < REGEN_WORLD_CLASS;
  return { id, name, age, overall, ...(hp ? { highPotential: true as const } : {}), ...(wc ? { worldClassPotential: true as const } : {}) };
}

/** One man retired at the rollover — for anyone who wants to tell the story. */
export interface RetiredPlayer {
  club: string;
  id: string;
  name: string;
  age: number;
  position: string;
}

type Aged<T> = { player: T; retired: false } | { player: null; retired: true; age: number };

function ageOne<T extends { id: string; age?: number; overall?: number; position: string; highPotential?: boolean }>(
  p: T, key: string, season: number, trainingMultiplier: number, clubLevel?: number,
): Aged<T> {
  const age = p.age ?? startingAgeFor(key);
  if (age >= retirementAgeFor(key, p.position)) return { player: null, retired: true, age };
  if (typeof p.overall !== "number") return { player: { ...p, age: age + 1 }, retired: false };
  const rng = mulberry32(hashInt(`${key}|${season}`));
  const delta = ratingChange(age, p.overall, rng, talentOf(key), trainingMultiplier, clubLevel);
  const overall = clamp(p.overall + delta, 30, 99);
  return {
    player: { ...p, ...shiftedStats(p as StatBag, overall - p.overall, age), age: age + 1, overall },
    retired: false,
  };
}

/** Best rating first within each position, each keeping the slots that
 *  position already held — so the first eleven stay the starters. */
function reorderByPosition<T extends { position: string; overall?: number }>(players: T[]): T[] {
  const slots = new Map<string, number[]>();
  players.forEach((p, i) => { const s = slots.get(p.position) ?? []; s.push(i); slots.set(p.position, s); });
  const out = players.slice();
  slots.forEach((idx) => {
    const group = idx.map(i => players[i]).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    idx.forEach((i, k) => { out[i] = group[k]; });
  });
  return out;
}

/**
 * The other clubs' squads, one season on. `season` is the season just
 * finished (career.season inside advanceSeason). Squad sizes do not change:
 * every retiree is replaced, in his position, by one regen.
 */
export function ageLeagueSquads(
  squads: LeagueSquad[], season: number,
  trainingTierFor?: (club: string) => 1 | 2 | 3,
  clubLevels: Record<string, number> = {},
): { squads: LeagueSquad[]; retired: RetiredPlayer[]; clubLevels: Record<string, number> } {
  const retired: RetiredPlayer[] = [];
  const levels = { ...clubLevels };
  const out = squads.map(s => {
    if (s.players.length === 0) return s;
    const tierMult = TRAINING_TIER_MULTIPLIER[trainingTierFor?.(s.club) ?? 2];
    const level = clubLevelOf(levels, s);
    const regens = s.club !== FREE_AGENTS_CLUB;
    const players: LeaguePlayer[] = [];
    for (const p of s.players) {
      if (exempt(p.id)) { players.push(p); continue; }
      const key = keyOfLeague(p, s.club);
      const res = ageOne(p, key, season, tierMult, level);
      if (!res.retired) { players.push(res.player); continue; }
      retired.push({ club: s.club, id: p.id, name: p.name, age: res.age, position: p.position });
      if (!regens) continue;
      const r = makeRegen(key, season, level);
      players.push({
        id: r.id, name: r.name, position: p.position, overall: r.overall, goals: 0, assists: 0,
        age: r.age,
        ...(r.highPotential ? { highPotential: true } : {}),
        ...(r.worldClassPotential ? { worldClassPotential: true } : {}),
        // No `image`: every screen draws fakeFaceFor(id) for a man with no
        // photo (lineup.ts, VersusScreen's faceOrFake, CanvasMatch), and
        // leaving it out keeps each regen ~50 bytes smaller in the save.
      });
    }
    return { ...s, players: reorderByPosition(players) };
  });
  return { squads: out, retired, clubLevels: levels };
}

/**
 * The level a club's regens are rated against: its starting-XI average the
 * first time the world aged it, then fixed. Rated against the CURRENT
 * eleven instead, every club drifted upward (a good crop of boys raised
 * the bar for the next crop): measured +7 to +8 in the lower leagues over
 * twenty seasons. Kept on the career (`clubLevels`), a few KB for every club.
 * Fills `levels` in for a club seen for the first time.
 */
export function clubLevelOf(levels: Record<string, number>, squad: LeagueSquad): number {
  const known = levels[squad.club];
  if (typeof known === "number") return known;
  const level = averageStartingXIRating(squad) ?? 65;
  levels[squad.club] = level;
  return level;
}

/**
 * Your own club's dressing room, one season on — the same rolls as the
 * copy of it in leagueSquads, so a man retires (and is replaced by the
 * same boy) in both. `clubLevel` is what a regen is rated against.
 */
export function ageOwnSquad(
  squad: SquadPlayer[], club: string, season: number, clubLevel: number,
  trainingTier: 1 | 2 | 3 = 2,
): { squad: SquadPlayer[]; retired: RetiredPlayer[] } {
  const tierMult = TRAINING_TIER_MULTIPLIER[trainingTier];
  const rated = squad.some(p => typeof p.overall === "number");
  const retired: RetiredPlayer[] = [];
  const out: SquadPlayer[] = [];
  for (const p of squad) {
    if (exempt(p.id)) { out.push(p); continue; }
    const key = keyOfSquad(p, club);
    const res = ageOne(p, key, season, tierMult, clubLevel);
    if (!res.retired) { out.push(res.player); continue; }
    retired.push({ club, id: p.id, name: p.name, age: res.age, position: p.position });
    const r = makeRegen(key, season, clubLevel);
    out.push({
      id: r.id, name: r.name, shortName: shortNameOf(r.name), position: p.position,
      seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, leagueGoals: 0, leagueAssists: 0,
      age: r.age, positions: [p.position], imageUrl: fakeFaceFor(r.id),
      ...(rated ? { overall: r.overall } : {}),
      ...(r.highPotential ? { highPotential: true } : {}),
      ...(r.worldClassPotential ? { worldClassPotential: true } : {}),
    });
  }
  return { squad: rated ? reorderByPosition(out) : out, retired };
}

/**
 * A squad fetched from the database mid-career is the day-one squad. Bring
 * it up to date: the rollovers of seasons `from`..`to` (inclusive), with
 * the same per-player rolls as the real rollovers, so a man who retired in
 * season 4 does not walk back in through a fetch in season 9.
 */
export function catchUpFetchedSquads(
  fresh: LeagueSquad[], from: number, to: number,
  trainingTierFor?: (club: string) => 1 | 2 | 3,
  clubLevels: Record<string, number> = {},
): LeagueSquad[] {
  let out = fresh;
  let levels = clubLevels;
  for (let s = from; s <= to; s++) {
    const r = ageLeagueSquads(out, s, trainingTierFor, levels);
    out = r.squads;
    levels = r.clubLevels;
  }
  return out;
}

/** What the catch-up needs off the career. */
export interface WorldClock {
  season: number;
  /** The season whose rollover first aged the world (absent: never yet). */
  worldAgedSince?: number;
  clubLevels?: Record<string, number>;
}

/** The rollovers this career's world has already lived through. */
function agedSeasons(c: WorldClock): [number, number] | null {
  if (typeof c.worldAgedSince !== "number" || c.worldAgedSince >= c.season) return null;
  return [c.worldAgedSince, c.season - 1];
}

/** A fresh fetch of other clubs, aged to match this career's world. Returns
 *  the same array when there is nothing to catch up. */
export function ageFetchedForCareer(c: WorldClock, fresh: LeagueSquad[]): LeagueSquad[] {
  const span = agedSeasons(c);
  if (!span) return fresh;
  return catchUpFetchedSquads(fresh, span[0], span[1], undefined, c.clubLevels ?? {});
}

/** Your new club's dressing room from a fresh fetch (a transfer, a reload),
 *  aged to match this career's world. */
export function ageOwnFetchedForCareer(c: WorldClock, club: string, squad: SquadPlayer[]): SquadPlayer[] {
  const span = agedSeasons(c);
  if (!span) return squad;
  const rated = squad.filter(p => typeof p.overall === "number").slice(0, 11);
  const level = c.clubLevels?.[club]
    ?? (rated.length ? Math.round(rated.reduce((n, p) => n + (p.overall ?? 0), 0) / rated.length) : 65);
  let out = squad;
  for (let s = span[0]; s <= span[1]; s++) out = ageOwnSquad(out, club, s, level).squad;
  return out;
}

// ── hashing ──

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hash01(s: string): number {
  return hashInt(s) / 4294967296;
}
