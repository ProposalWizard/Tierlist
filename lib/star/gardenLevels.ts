/**
 * GARDEN LEVELS — the garden grows as you play in it (Harry, 21 Oct 2026, answer 2: "Riding field unlock → a
 * garden level: XP from garden training drills and casino play; levels give more space and areas (horse riding,
 * race track, fast travel to your house, …)"; earlier: "garden levels by star pass / club size").
 *
 *   level 1  the garden as it is today (nothing new)
 *   level 2  a gate in the west wall, a lane, a new paddock and stable with your horse (ride it)
 *   level 3  the riding field: a jump course with poles, a timed lap and a best time
 *   level 4  a small race track round the field (a flat gallop lap, its own best time)
 *   level 5  a signpost: fast travel to your house, the garden or the field
 *
 * XP comes from the garden's own training drills (the pitch behind the gate, components/star/Training3D.tsx) and
 * from casino play (bets placed in a visit, horse races run). A week can give at most WEEK_CAP, so a level is
 * weeks of play, not one sitting. Pure: no screens, no 3D. Saved small on the career (`career.gardenXp`, absent
 * on every older save = level 1, 0 XP). The 3D side: lib/star/garden3d/levelZones.ts. Test:
 * tests/star/gardenLevels.mts.
 */
import type { CareerState } from "./types";
import { energyNow, lapTraining } from "./garden3d/riding";

export type GardenArea = "garden" | "paddock" | "field" | "track" | "signpost";

export interface GardenLevelDef {
  level: 1 | 2 | 3 | 4 | 5;
  /** XP needed to reach this level from the one before (level 1: 0). */
  need: number;
  /** What this level opens. */
  opens: GardenArea;
  /** The name on the chip and the sign at the locked gate. */
  name: string;
}

export const GARDEN_LEVELS: readonly GardenLevelDef[] = [
  { level: 1, need: 0, opens: "garden", name: "Your garden" },
  { level: 2, need: 300, opens: "paddock", name: "Paddock and stable" },
  { level: 3, need: 600, opens: "field", name: "Riding field" },
  { level: 4, need: 1000, opens: "track", name: "Race track" },
  { level: 5, need: 1500, opens: "signpost", name: "Fast travel" },
];
export const GARDEN_MAX_LEVEL = 5;

/** XP each thing gives. A drill: base + per star (0-3 stars). The casino: per bet placed, per horse race run. */
export const GARDEN_XP = {
  drill: 40,
  drillStar: 10,
  casinoBet: 15,
  /** A casino visit counts at most this many bets. */
  casinoBetsMax: 6,
  horseRace: 20,
} as const;
/** The most XP one week (career.season + career.week) can give. */
export const WEEK_CAP = 250;

/** What is saved on the career. Small: a few numbers. */
export interface GardenProgress {
  /** All the XP ever earned. */
  xp: number;
  /** The week the week's XP belongs to ("season-week"), and how much it has given. */
  wk?: string;
  wkXp?: number;
  /** Best lap times, in milliseconds, on the course (jumps and poles) and the race track. */
  bestCourse?: number;
  bestTrack?: number;
  /** Laps finished, all time. */
  laps?: number;
  /** The stable horse's energy (0-100) when you own no horse, and the week it was last set. */
  stableEnergy?: number;
  stableAt?: string;
  /** Rides that trained you this week (the training effect, behind its flag: lib/star/garden3d/riding.ts). */
  trainWk?: string;
  trainN?: number;
}

export type XpSource =
  | { kind: "drill"; stars?: number }
  | { kind: "casino"; bets: number }
  | { kind: "horseRace" };

export const weekKey = (c: Pick<CareerState, "season" | "week">) => `${c.season ?? 1}-${c.week ?? 0}`;

/** The progress on a career; an old save has none: level 1, 0 XP. */
export function gardenProgress(c: Pick<CareerState, "gardenXp">): GardenProgress {
  const g = c.gardenXp;
  if (!g || typeof g !== "object" || !Number.isFinite(g.xp)) return { xp: 0 };
  return { ...g, xp: Math.max(0, Math.floor(g.xp)) };
}

/** XP a thing gives, before the week's cap. */
export function xpFor(src: XpSource): number {
  if (src.kind === "drill") return GARDEN_XP.drill + GARDEN_XP.drillStar * Math.max(0, Math.min(3, Math.round(src.stars ?? 0)));
  if (src.kind === "casino") return GARDEN_XP.casinoBet * Math.max(0, Math.min(GARDEN_XP.casinoBetsMax, Math.floor(src.bets)));
  return GARDEN_XP.horseRace;
}

/** The career with that XP added (capped per week). Nothing else on the career changes. */
export function addGardenXp(c: CareerState, src: XpSource): CareerState {
  const raw = xpFor(src);
  if (raw <= 0) return c;
  const g = gardenProgress(c);
  const wk = weekKey(c);
  const used = g.wk === wk ? g.wkXp ?? 0 : 0;
  const gain = Math.max(0, Math.min(raw, WEEK_CAP - used));
  if (gain <= 0) return c;
  return { ...c, gardenXp: { ...g, xp: g.xp + gain, wk, wkXp: used + gain } };
}

export interface GardenLevelInfo {
  level: 1 | 2 | 3 | 4 | 5;
  /** XP into this level, and how much the next one needs (0 at the top). */
  into: number;
  need: number;
  /** 0-1 towards the next level (1 at the top). */
  progress: number;
  /** Every area open at this level. */
  open: GardenArea[];
  /** The next level's area, or null at the top. */
  next: GardenLevelDef | null;
}

/** The level for an XP total. */
export function gardenLevelOf(xp: number): GardenLevelInfo {
  let left = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let i = 1; i < GARDEN_LEVELS.length; i++) {
    if (left < GARDEN_LEVELS[i].need) break;
    left -= GARDEN_LEVELS[i].need;
    level = i + 1;
  }
  const next = GARDEN_LEVELS[level] ?? null;
  const need = next?.need ?? 0;
  return {
    level: level as GardenLevelInfo["level"],
    into: next ? left : 0,
    need,
    progress: next ? left / need : 1,
    open: GARDEN_LEVELS.slice(0, level).map((l) => l.opens),
    next,
  };
}

/** Total XP at the start of a level (for tests and the test page). */
export function xpAtLevel(level: number): number {
  let t = 0;
  for (let i = 1; i < Math.min(level, GARDEN_LEVELS.length); i++) t += GARDEN_LEVELS[i].need;
  return t;
}

/** Is an area open at this XP? */
export const areaOpen = (xp: number, a: GardenArea) => gardenLevelOf(xp).open.includes(a);

/** The chip: "Garden level 2 · 340/600 XP" ("Garden level 5 · max" at the top). */
export function gardenChip(xp: number): string {
  const l = gardenLevelOf(xp);
  return l.next ? `Garden level ${l.level} · ${l.into}/${l.need} XP` : `Garden level ${l.level} · max`;
}

// ── A ride, put back on the career ──

/** What one ride did: the horse's energy at the end, and every lap finished (time in ms). */
export interface RideResult {
  energy: number;
  laps: { kind: "course" | "track"; ms: number }[];
}

/** The ridden horse's energy now: your own horse's, else the stable horse's (refilled by the weeks since). */
export function rideEnergy(c: CareerState): number {
  if (c.horse) return Math.max(0, Math.min(100, c.horse.energy));
  const g = gardenProgress(c);
  return energyNow(g.stableEnergy, g.stableAt, c.season ?? 1, c.week ?? 0);
}

/**
 * The career after a ride: the horse's energy, best times, laps. Training (you and the horse) only while
 * riding.ts RIDE_CAREER_EFFECT is "on" (off: no skill, fitness or horse rating changes at all).
 */
export function applyRide(c: CareerState, r: RideResult): CareerState {
  const g = gardenProgress(c);
  const wk = weekKey(c);
  const energy = Math.max(0, Math.min(100, Math.round(r.energy * 10) / 10));
  const next: GardenProgress = { ...g, laps: (g.laps ?? 0) + r.laps.length };
  for (const l of r.laps) {
    if (l.kind === "course" && (next.bestCourse === undefined || l.ms < next.bestCourse)) next.bestCourse = Math.round(l.ms);
    if (l.kind === "track" && (next.bestTrack === undefined || l.ms < next.bestTrack)) next.bestTrack = Math.round(l.ms);
  }
  let out: CareerState = { ...c, gardenXp: next };
  if (c.horse) out = { ...out, horse: { ...c.horse, energy } };
  else { next.stableEnergy = energy; next.stableAt = wk; }
  // training, lap by lap (nothing while the flag is off)
  let trained = g.trainWk === wk ? g.trainN ?? 0 : 0;
  let fit = 0, hs = 0, hst = 0;
  for (let i = 0; i < r.laps.length; i++) {
    const t = lapTraining(trained);
    if (!t.fitness && !t.horseSpeed) break;
    fit += t.fitness; hs += t.horseSpeed; hst += t.horseStamina; trained++;
  }
  if (fit || hs || hst) {
    next.trainWk = wk; next.trainN = trained;
    out = { ...out, matchFitness: Math.min(100, (out.matchFitness ?? 0) + fit) };
    if (out.horse) out = { ...out, horse: { ...out.horse, speed: Math.min(95, out.horse.speed + hs), stamina: Math.min(95, out.horse.stamina + hst) } };
  }
  return out;
}

/** The stable's horse, when you own none (you ride him in the paddock; he is not yours to race). */
export const STABLE_HORSE_NAME = "Bramble";

/** What the 3D garden needs for its levels, off a career (garden3d/levelZones.ts GardenLevelsOpt). */
export function gardenLevelsOptFor(c: CareerState): { xp: number; horse: { name: string; energy: number; mine: boolean }; bestCourse?: number; bestTrack?: number } {
  const g = gardenProgress(c);
  return {
    xp: g.xp,
    horse: c.horse ? { name: c.horse.name, energy: rideEnergy(c), mine: true } : { name: STABLE_HORSE_NAME, energy: rideEnergy(c), mine: false },
    bestCourse: g.bestCourse,
    bestTrack: g.bestTrack,
  };
}
