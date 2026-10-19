import type { LeaguePlayer, LeagueSquad, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { FIRST_NAMES, LAST_NAMES } from "./squadData";
import { averageStartingXIRating, TRAINING_TIER_MULTIPLIER, FREE_AGENTS_CLUB } from "./leagueSquads";
import { shortNameOf } from "./realSquad";
import { fakeFaceFor } from "./fakeFaces";
import { madeUpName } from "./nationNames";

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
 *
 * MIKEY'S RULES (18 Oct 2026, "the top waits for you"):
 *  - Until you have played a season for a Championship or Premier League
 *    club, only YOUR club ages. Every other player in the world is frozen:
 *    no age, no growth, no decline, no retirement (careerFlow.ts decides,
 *    `worldAwake`). National teams and Ballon d'Or rivals come from those
 *    frozen squads, so they wait too. Then the whole world ages.
 *  - Unflagged players no longer grow (UNFLAGGED_GROWTH, kept for later);
 *    High / World Class players grow as before (growWonderkids).
 *  - A replacement takes the retired man's nationality and a name from that
 *    country's name bank.
 *  - Each career has its own history: every roll mixes in the career's
 *    `worldSeed` (absent on saves whose world already aged before this, so
 *    those keep exactly the history they had).
 *
 * MIKEY'S AGEING RULES (18 Oct 2026, the 13 answers):
 *  - Decline starts at 31 and is gentle (0.6× Leo's curve). Everyone the
 *    same, whatever his rating; keepers fade at 0.6× of that again.
 *  - Each man rolls once per career how he ages: very well, well, normal,
 *    badly, very badly (AGEING_PROFILES).
 *  - Retirement 35–41, most in the middle; keepers two years later. Never
 *    because his rating fell. A man already 40+ when he first ages (Ronaldo)
 *    plays two more seasons, then goes. A younger man already past his
 *    rolled age plays that first season and retires at its end (Mikey).
 *  - A replacement is 16–20 (any age equally), rated his club's level −13 to
 *    +2 (any value equally), plays the retired man's position (sometimes a
 *    second or third nearby one), and his flags come from the retired man's
 *    best rating in the game (REGEN_FLAG_BANDS).
 *  - Unflagged replacements still grow on Leo's curve, for now.
 */

/**
 * Leo's growth for players with no High / World Class flag (a young man
 * grows by age, a random talent roll and his club's training ground).
 * Off since 18 Oct 2026 (Mikey: "remove it for now, but still remember
 * it"); a player then holds his rating until his decline starts.
 */
export const UNFLAGGED_GROWTH = false;

/** A roll's key, made this career's own by its world seed. */
function seeded(key: string, worldSeed?: number): string {
  return worldSeed ? `${worldSeed}~${key}` : key;
}

/** Seasons are aged from this age onward if the player has no age at all
 *  (an invented squad): a stable 20–32, off his id. An invented squad's
 *  ratings are flat, not shaped by age, so it is read as grown men —
 *  younger, they would all "grow" into ratings the club never had. */
export function startingAgeFor(key: string): number {
  return 20 + Math.floor(hash01(`${key}|age`) * 13);
}

/** How likely each retirement age is, 35 to 41 (sums to 1): most in the
 *  middle, fewer early and late (Mikey, questions 5 and 6). Keepers two
 *  years later (question 7). */
export const RETIREMENT_AGE_WEIGHTS: [number, number][] = [
  [35, 0.06], [36, 0.12], [37, 0.20], [38, 0.24], [39, 0.20], [40, 0.12], [41, 0.06],
];
export const KEEPER_EXTRA_YEARS = 2;
/** A man this old or older the first time he ages (Ronaldo, 41) is given
 *  OLD_STARTER_SEASONS more seasons before he must retire. */
export const OLD_STARTER_AGE = 40;
export const OLD_STARTER_SEASONS = 2;

/** The age at which this man plays his last season. Fixed for life. */
export function retirementAgeFor(key: string, position: string): number {
  const s = hash01(`${key}|retire`);
  let acc = 0;
  let age = 41;
  for (const [a, w] of RETIREMENT_AGE_WEIGHTS) {
    acc += w;
    if (s < acc) { age = a; break; }
  }
  return position === "GK" ? age + KEEPER_EXTRA_YEARS : age;
}

/** Decline starts in the season he turns 32 (Mikey: "decline starts at 31")
 *  and is gentle: Leo's drops, two years later, at DECLINE_SCALE. */
export const DECLINE_START = 31;
export const DECLINE_SCALE = 0.6;
/** Keepers fade less than outfield players (question 7). */
export const KEEPER_DECLINE_SCALE = 0.6;
const LEO_DECLINE = [-0.4, -0.9, -1.4, -1.9, -2.6, -3.1, -3.6];

/** Mean rating change in the season he turns `age + 1`. */
export function meanAgeChange(age: number): number {
  if (age >= DECLINE_START) return LEO_DECLINE[Math.min(LEO_DECLINE.length - 1, age - DECLINE_START)] * DECLINE_SCALE;
  if (age > 25) return 0;
  return leoMeanAgeChange(age);
}

/** Leo's own curve, for growth (and kept as it was for reference). */
export function leoMeanAgeChange(age: number): number {
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

/** How a man ages, rolled once per career (question 4): his decline is
 *  scaled by `decline`. `share` out of 100. */
export const AGEING_PROFILES = [
  { name: "ages very well", share: 10, decline: 0.4 },
  { name: "ages well", share: 20, decline: 0.7 },
  { name: "normal", share: 40, decline: 1 },
  { name: "ages badly", share: 20, decline: 1.4 },
  { name: "ages very badly", share: 10, decline: 1.8 },
] as const;
export function ageingProfileOf(key: string): (typeof AGEING_PROFILES)[number] {
  let r = hash01(`${key}|profile`) * 100;
  for (const p of AGEING_PROFILES) { if (r < p.share) return p; r -= p.share; }
  return AGEING_PROFILES[2];
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
  clubLevel?: number, canGrow = true, declineScale = 1,
): number {
  let mean = meanAgeChange(age);
  // Unflagged growth switched off: up to his decline, he holds.
  if (mean >= 0 && !canGrow) return 0;
  if (mean < 0) {
    // In decline nobody goes up (noise included); how fast is his profile.
    const noise = (rng() + rng() - 1) * 1.5;
    return Math.min(0, Math.round(mean * declineScale + noise));
  }
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
  // An invented club's league copy ("gen:<club>:<i>") is the same man as
  // squad entry "sp_<i>": keyed alike, so both copies of your club retire
  // the same men and get the same boys.
  const gen = /^gen:.+:(\d+)$/.exec(p.id);
  if (gen) return `${club}:sp_${gen[1]}`;
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

/**
 * A replacement's flags, from the retired man's best rating in the game
 * (question 11). Out of 100: World Class, High Potential, the rest none.
 * All three bands confirmed by Mikey (18 Oct 2026).
 */
export const REGEN_FLAG_BANDS: { minPeak: number; worldClass: number; high: number }[] = [
  { minPeak: 87, worldClass: 80, high: 19 },
  { minPeak: 83, worldClass: 10, high: 60 },
  { minPeak: 0, worldClass: 1, high: 5 },
];

/** A replacement starts at his club's level plus a value from this range,
 *  every value equally likely (question 10). */
export const REGEN_LEVEL_RANGE: [number, number] = [-13, 2];
/** His age, every age equally likely (question 9). */
export const REGEN_AGE_RANGE: [number, number] = [16, 20];

/**
 * Positions near each one (question 13): a replacement plays the retired
 * man's position, has a REGEN_SECOND_POSITION chance of a second from
 * `near`, and REGEN_THIRD_POSITION of a third from `near` + `wide`. The
 * game has no wing-backs or wide midfielders, so those are left out.
 */
type Pos = SquadPlayer["position"];
export const NEAR_POSITIONS: Record<Pos, { near: Pos[]; wide: Pos[] }> = {
  GK: { near: [], wide: [] },
  RB: { near: ["LB", "CB"], wide: ["RW", "CDM", "CM", "CAM"] },
  LB: { near: ["RB", "CB"], wide: ["LW", "CDM", "CM", "CAM"] },
  CB: { near: ["CDM", "LB", "RB"], wide: ["CM"] },
  CDM: { near: ["CM", "CB"], wide: ["CAM", "LB", "RB"] },
  CM: { near: ["CDM", "CAM"], wide: ["LW", "RW", "CB"] },
  CAM: { near: ["CM", "ST"], wide: ["LW", "RW", "CDM"] },
  LW: { near: ["RW", "ST", "CAM"], wide: ["CM", "LB"] },
  RW: { near: ["LW", "ST", "CAM"], wide: ["CM", "RB"] },
  ST: { near: ["LW", "RW", "CAM"], wide: ["CM"] },
};
export const REGEN_SECOND_POSITION = 0.25;
export const REGEN_THIRD_POSITION = 0.05;

export function regenPositions(position: Pos, rng: () => number): Pos[] {
  const opts = NEAR_POSITIONS[position] ?? { near: [], wide: [] };
  const r = rng();
  if (!opts.near.length || r >= REGEN_SECOND_POSITION) return [position];
  const second = opts.near[Math.floor(rng() * opts.near.length)];
  if (r >= REGEN_THIRD_POSITION) return [position, second];
  const pool = [...opts.near, ...opts.wide].filter(x => x !== second);
  return [position, second, pool[Math.floor(rng() * pool.length)]];
}

interface Regen {
  id: string; name: string; age: number; overall: number;
  nation?: string; positions: Pos[];
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
export function makeRegen(
  retireeKey: string, season: number, clubLevel: number, nation?: string,
  retiree: { peak?: number; position?: Pos } = {},
): Regen {
  const id = `rg${season}.${hashInt(retireeKey).toString(36)}${hashInt(`${retireeKey}~`).toString(36).slice(0, 4)}`;
  const rng = mulberry32(hashInt(id));
  const [a0, a1] = REGEN_AGE_RANGE;
  const age = a0 + Math.floor(rng() * (a1 - a0 + 1));
  const [l0, l1] = REGEN_LEVEL_RANGE;
  const overall = clamp(Math.round(clubLevel) + l0 + Math.floor(rng() * (l1 - l0 + 1)), 35, 85);
  // From the retired man's country when known, so a Brazilian club gets a
  // Brazilian boy who can play for Brazil.
  const name = nation ? madeUpName(nation, id) : regenName(rng);
  const peak = retiree.peak ?? 0;
  const band = REGEN_FLAG_BANDS.find(b => peak >= b.minPeak) ?? REGEN_FLAG_BANDS[REGEN_FLAG_BANDS.length - 1];
  const f = rng() * 100;
  const wc = f < band.worldClass;
  const hp = wc || f < band.worldClass + band.high;
  const positions = regenPositions(retiree.position ?? "CM", rng);
  return {
    id, name, age, overall, positions, ...(nation ? { nation } : {}),
    ...(hp ? { highPotential: true as const } : {}), ...(wc ? { worldClassPotential: true as const } : {}),
  };
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

/** The fields ageing keeps on a player. */
interface AgeingMarks {
  /** Best rating he has had in the game; only kept once he is below it. */
  peak?: number;
  /** The age he retires at, kept once he is 40+ (see retireAgeOf). */
  retireAt?: number;
}

/**
 * The age this man retires at. A man of OLD_STARTER_AGE+ with no `retireAt`
 * is being aged for the first time (everyone who ages INTO that age has it
 * stamped on the way, below), so he gets OLD_STARTER_SEASONS more seasons.
 */
function retireAgeOf(p: { retireAt?: number; position: string }, key: string, age: number): number {
  if (typeof p.retireAt === "number") return p.retireAt;
  const rolled = retirementAgeFor(key, p.position);
  return age >= OLD_STARTER_AGE ? Math.max(rolled, age + OLD_STARTER_SEASONS) : rolled;
}

function ageOne<T extends { id: string; age?: number; overall?: number; position: string; highPotential?: boolean } & AgeingMarks>(
  p: T, key: string, season: number, trainingMultiplier: number, clubLevel?: number,
): Aged<T> {
  const age = p.age ?? startingAgeFor(key);
  const retireAt = retireAgeOf(p, key, age);
  if (age >= retireAt) return { player: null, retired: true, age };
  const marks: AgeingMarks = age + 1 >= OLD_STARTER_AGE ? { retireAt } : {};
  if (typeof p.overall !== "number") return { player: { ...p, ...marks, age: age + 1 }, retired: false };
  const rng = mulberry32(hashInt(`${key}|${season}`));
  // A real man without a flag holds his rating until his decline
  // (UNFLAGGED_GROWTH off). A replacement boy still grows on Leo's curve
  // until Mikey's own plan for replacements: frozen at his starting rating,
  // every league would sink by about 12 points over 20 seasons.
  const canGrow = UNFLAGGED_GROWTH || isRegenId(p.id);
  const declineScale = ageingProfileOf(key).decline * (p.position === "GK" ? KEEPER_DECLINE_SCALE : 1);
  const delta = ratingChange(age, p.overall, rng, talentOf(key), trainingMultiplier, clubLevel, canGrow, declineScale);
  const overall = clamp(p.overall + delta, 30, 99);
  const best = Math.max(p.peak ?? p.overall, p.overall);
  if (overall < best) marks.peak = best;
  return {
    player: { ...p, ...shiftedStats(p as StatBag, overall - p.overall, age), ...marks, age: age + 1, overall },
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
  worldSeed?: number,
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
      const key = seeded(keyOfLeague(p, s.club), worldSeed);
      const res = ageOne(p, key, season, tierMult, level);
      if (!res.retired) { players.push(res.player); continue; }
      retired.push({ club: s.club, id: p.id, name: p.name, age: res.age, position: p.position });
      if (!regens) continue;
      const r = makeRegen(key, season, level, p.nation ?? squadNation(s.players), { peak: p.peak ?? p.overall, position: p.position });
      players.push({
        id: r.id, name: r.name, position: p.position, overall: r.overall, goals: 0, assists: 0,
        age: r.age,
        ...(r.positions.length > 1 ? { positions: r.positions } : {}),
        ...(r.nation ? { nation: r.nation } : {}),
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
  worldSeed?: number,
): { squad: SquadPlayer[]; retired: RetiredPlayer[] } {
  const tierMult = TRAINING_TIER_MULTIPLIER[trainingTier];
  const rated = squad.some(p => typeof p.overall === "number");
  const retired: RetiredPlayer[] = [];
  const out: SquadPlayer[] = [];
  for (const p of squad) {
    if (exempt(p.id)) { out.push(p); continue; }
    const key = seeded(keyOfSquad(p, club), worldSeed);
    const res = ageOne(p, key, season, tierMult, clubLevel);
    if (!res.retired) { out.push(res.player); continue; }
    retired.push({ club, id: p.id, name: p.name, age: res.age, position: p.position });
    const r = makeRegen(key, season, clubLevel, p.nationality ?? squadNationality(squad), { peak: p.peak ?? p.overall, position: p.position });
    out.push({
      id: r.id, name: r.name, shortName: shortNameOf(r.name), position: p.position,
      seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, leagueGoals: 0, leagueAssists: 0,
      age: r.age, positions: r.positions, imageUrl: fakeFaceFor(r.id),
      ...(r.nation ? { nationality: r.nation } : {}),
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
  worldSeed?: number,
): LeagueSquad[] {
  let out = fresh;
  let levels = clubLevels;
  for (let s = from; s <= to; s++) {
    const r = ageLeagueSquads(out, s, trainingTierFor, levels, worldSeed);
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
  /** This career's own history (see `seeded`); absent on older saves. */
  worldSeed?: number;
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
  return catchUpFetchedSquads(fresh, span[0], span[1], undefined, c.clubLevels ?? {}, c.worldSeed);
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
  for (let s = span[0]; s <= span[1]; s++) out = ageOwnSquad(out, club, s, level, 2, c.worldSeed).squad;
  return out;
}

/** The country most of a squad comes from, for a replacement whose man had
 *  none on record (an invented player at a real club). */
function squadNation(players: { nation?: string }[]): string | undefined {
  return mostCommon(players.map(p => p.nation));
}
function squadNationality(players: { nationality?: string }[]): string | undefined {
  return mostCommon(players.map(p => p.nationality));
}
function mostCommon(xs: (string | undefined)[]): string | undefined {
  const n = new Map<string, number>();
  for (const x of xs) if (x) n.set(x, (n.get(x) ?? 0) + 1);
  let best: string | undefined; let top = 0;
  n.forEach((c, x) => { if (c > top) { top = c; best = x; } });
  return best;
}

/** A career's own world seed, from who you are (never 0). */
export function worldSeedFor(player: { firstName: string; lastName: string; startYear: number; nationality: string; position: string }): number {
  return (hashInt(`${player.firstName} ${player.lastName}|${player.startYear}|${player.nationality}|${player.position}|world`) % 2147483646) + 1;
}

/** Leagues where you have "arrived": a season played here wakes the world. */
export const AWAKE_DIVISIONS: readonly string[] = ["premier", "championship"];

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
