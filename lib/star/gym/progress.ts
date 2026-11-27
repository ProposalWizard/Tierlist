/**
 * THE GYM'S PROGRESS: Strength, Cardio, Focus (Harry, 27 Nov 2026: "a gym based on the GTA 6 gym";
 * docs/research/gym-compound-driving-2026-11-27.md section 3b). Pure: no three.js, no screens.
 *
 * GTA 6 runs on days. Our career runs on the WEEK: the gap between one match and the next (week.ts),
 * which is also how a night's sleep works (home3d/sleep.ts). So, as GTA does it but by gaps:
 *
 *  - THREE STATS, four levels each (level 1 to 4, 100 points a level). Strength from the bench,
 *    Cardio from the treadmill, Focus from the heavy bag (keeping the cursor in the zone).
 *  - ONE VISIT PER GAP. A visit's RING has three parts, one per machine. Each machine pays once per
 *    gap; closing all three closes the ring (a small bonus to all three). More training in the same
 *    gap pays nothing ("once you close the daily ring, more does nothing").
 *  - THE WORKOUT WINDOW. A visit opens a window over the next WINDOW_GAPS gaps. Train inside it and
 *    the points count in full. Train with no window open (the first visit, or after a lapse) and
 *    they count half: that visit opens the window again. Let it close with no visit and Strength and
 *    Cardio slip back SLIP points for each window missed (at most MAX_SLIPS at once). Focus never slips.
 *  - SLEEP AND PROTEIN. Slept in your bed this gap (sleep.ts lastSleep): points ×1.2. A protein shake
 *    at the water cooler this gap: ×1.2. Both: ×1.44.
 *  - NEVER MAXED IN ONE GO. A perfect gap gives a stat at most PER_GAP_MAX points, so level 1 to 4
 *    takes at least 6 perfect gaps.
 *
 * THE CAREER EFFECT IS OFF (GYM_CAREER_EFFECT = "off"): Harry has not yet decided "should the gym
 * change energy only, or Power and Pace too?". Off, a visit records the gym's own numbers and nothing
 * else on the career moves: no week's action spent, no energy, no skills. The two other settings are
 * built and tested so the answer is one line: "energy" (a visit is one of the week's things, like
 * Rest, and gives back a share of Rest's energy by how well it went, never more than Rest) and
 * "energyPowerPace" (that, plus +1 Power on each Strength level up and +1 Pace on each Cardio level up).
 *
 * Saved as `career.gym` (optional: every older save loads with no gym yet). Test: tests/star/gym.mts.
 */
import type { CareerState } from "../types";
import type { GameResult, GymGameKind } from "./games";
import { actionsLeft, rest } from "../week";

export type GymStat = "strength" | "cardio" | "focus";
export const GYM_STATS: GymStat[] = ["strength", "cardio", "focus"];
export const STAT_OF: Record<GymGameKind, GymStat> = { bench: "strength", treadmill: "cardio", bag: "focus" };
export const STAT_NAMES: Record<GymStat, string> = { strength: "Strength", cardio: "Cardio", focus: "Focus" };

export const LEVEL_POINTS = 100;
export const MAX_LEVEL = 4;
/** Level 4 is the top: points stop there. */
export const MAX_POINTS = (MAX_LEVEL - 1) * LEVEL_POINTS;
/** Points a perfect go on one machine gives, inside the window. */
export const MACHINE_POINTS = 40;
/** Closing the ring (all three machines in one gap): this much more to each stat, times the visit's average quality. */
export const RING_BONUS = 10;
/** The most one stat can gain in one gap (a perfect machine + the ring + sleep + protein). */
export const PER_GAP_MAX = 50;
/** How many gaps after a visit the window stays open. */
export const WINDOW_GAPS = 2;
/** Points Strength and Cardio lose for each window missed. */
export const SLIP = 30;
export const MAX_SLIPS = 3;
export const SLEEP_BOOST = 1.2;
export const PROTEIN_BOOST = 1.2;
/** Outside the window a visit counts this much. */
export const COLD_START = 0.5;

/** "off": the gym changes nothing on the career (until Harry decides). */
export type GymEffectMode = "off" | "energy" | "energyPowerPace";
export const GYM_CAREER_EFFECT: GymEffectMode = "off";
/** In "energy" modes: a perfect visit gives back this share of what Rest would. */
export const GYM_ENERGY_SHARE = 0.6;

/** A gap between matches: (season, week), as home3d/sleep.ts keys a night's sleep. */
export interface Gap { season: number; week: number }

export interface GymState {
  v: 1;
  points: Record<GymStat, number>;
  /** The gap of the last visit (the window runs from it), absent before the first. */
  last?: Gap;
  /** This gap's ring: which machines are done, and how well. Cleared on a new gap. */
  ring?: { gap: Gap; done: Partial<Record<GymGameKind, number>>; closed: boolean; protein?: boolean };
  /** Visits ever, rings closed ever (for a badge or the phone's Fitness app). */
  visits: number;
  rings: number;
}

export function newGym(): GymState {
  return { v: 1, points: { strength: 0, cardio: 0, focus: 0 }, visits: 0, rings: 0 };
}
/** The career's gym (a new one on an old save, never mutating it). */
export function gymOf(c: Pick<CareerState, "gym">): GymState {
  const g = c.gym;
  if (!g || g.v !== 1) return newGym();
  return { ...newGym(), ...g, points: { ...newGym().points, ...g.points } };
}

export const levelOf = (points: number) => Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, points) / LEVEL_POINTS));
/** How far to the next level, 0..1 (1 at level 4). */
export const levelShare = (points: number) => levelOf(points) >= MAX_LEVEL ? 1 : (Math.max(0, points) % LEVEL_POINTS) / LEVEL_POINTS;

const sameGap = (a?: Gap, b?: Gap) => !!a && !!b && a.season === b.season && a.week === b.week;
export const gapOf = (c: Pick<CareerState, "season" | "week">): Gap => ({ season: c.season, week: c.week });

/**
 * How many windows closed between the last visit and `now` with no visit. Same season: every
 * WINDOW_GAPS gaps past the window is one more. A new season (the summer): one for the summer,
 * plus the gaps since the season began.
 */
export function missedWindows(last: Gap | undefined, now: Gap): number {
  if (!last) return 0;
  let gaps: number;
  if (now.season === last.season) gaps = now.week - last.week;
  else if (now.season > last.season) gaps = WINDOW_GAPS + 1 + Math.max(0, now.week - 1);
  else return 0;
  if (gaps <= WINDOW_GAPS) return 0;
  return Math.min(MAX_SLIPS, Math.ceil((gaps - WINDOW_GAPS) / WINDOW_GAPS));
}
/** Is the window open at `now` (a visit in the last WINDOW_GAPS gaps, this one included)? */
export function windowOpen(g: GymState, now: Gap): boolean {
  if (!g.last) return false;
  if (sameGap(g.last, now)) return true;
  return g.last.season === now.season && now.week > g.last.week && now.week - g.last.week <= WINDOW_GAPS;
}
/** Gaps left in the window after this one (0 = this is its last gap; -1 = closed). For the phone's countdown. */
export function windowLeft(g: GymState, now: Gap): number {
  if (!windowOpen(g, now)) return -1;
  return WINDOW_GAPS - (now.week - g.last!.week);
}

/** The gym as it stands at `now`: any slips from missed windows taken. (A view: saved on the next visit.) */
export function gymAt(g0: GymState, now: Gap): { gym: GymState; slipped: number } {
  const n = missedWindows(g0.last, now);
  if (!n) return { gym: g0, slipped: 0 };
  const points = { ...g0.points };
  for (const s of ["strength", "cardio"] as GymStat[]) points[s] = Math.max(0, points[s] - SLIP * n);
  // the window has been dealt with: the slips are taken once
  return { gym: { ...g0, points, last: undefined }, slipped: n };
}

export interface ExerciseOut {
  gym: GymState;
  stat: GymStat;
  /** Points this exercise added (after the window, sleep, protein, and the gap's cap). */
  gained: number;
  /** The ring closed with this one (the bonus went to all three). */
  ringClosed: boolean;
  /** Bonus points the ring gave each stat. */
  ringBonus: number;
  /** Levels gained, by stat (Strength 2 → 3 = { strength: 1 }). */
  levelUps: Partial<Record<GymStat, number>>;
  /** Why nothing was gained (the machine is done this gap, the ring is closed). */
  why?: "machineDone" | "ringClosed";
  /** Windows missed before this visit, taken off now. */
  slipped: number;
  /** The window was closed, so it counted half (and opened it again). */
  cold: boolean;
  words: string;
}

/**
 * One machine done. `slept`: you slept this gap (sleep.ts). Pure; returns a new gym.
 */
export function doExercise(g0: GymState, now: Gap, result: Pick<GameResult, "kind" | "quality">, o: { slept?: boolean } = {}): ExerciseOut {
  const stat = STAT_OF[result.kind];
  const { gym: g1, slipped } = gymAt(g0, now);
  const ring = g1.ring && sameGap(g1.ring.gap, now) ? { ...g1.ring, done: { ...g1.ring.done } } : { gap: now, done: {}, closed: false };
  const base = { stat, gained: 0, ringClosed: false, ringBonus: 0, levelUps: {}, slipped, cold: false };
  if (ring.closed) return { ...base, gym: { ...g1, ring }, why: "ringClosed", words: "Today's ring is already closed. More training does nothing until after the next match." };
  if (ring.done[result.kind] !== undefined) return { ...base, gym: { ...g1, ring }, why: "machineDone", words: `${STAT_NAMES[stat]} is done for this week. Try another machine.` };
  const open = windowOpen(g1, now);
  const cold = !open;
  const mult = (cold ? COLD_START : 1) * (o.slept ? SLEEP_BOOST : 1) * (ring.protein ? PROTEIN_BOOST : 1);
  const q = Math.max(0, Math.min(1, result.quality));
  ring.done[result.kind] = q;
  const before = { ...g1.points };
  const points = { ...g1.points };
  // what this stat has gained this gap already (only from this machine, as each machine pays once)
  const add = (s: GymStat, n: number, already: number) => {
    const room = Math.max(0, PER_GAP_MAX - already);
    const v = Math.min(room, n, MAX_POINTS - points[s]);
    points[s] += Math.max(0, v);
    return Math.max(0, v);
  };
  const gained = add(stat, Math.round(MACHINE_POINTS * q * mult), 0);
  let ringClosed = false, ringBonus = 0;
  const kinds: GymGameKind[] = ["bench", "treadmill", "bag"];
  if (kinds.every((k) => ring.done[k] !== undefined)) {
    ring.closed = true; ringClosed = true;
    const avg = kinds.reduce((a, k) => a + (ring.done[k] ?? 0), 0) / 3;
    ringBonus = Math.round(RING_BONUS * avg * mult);
    for (const s of GYM_STATS) {
      const machine = kinds.find((k) => STAT_OF[k] === s)!;
      const already = Math.round(MACHINE_POINTS * (ring.done[machine] ?? 0) * mult);
      add(s, ringBonus, Math.min(PER_GAP_MAX, already));
    }
  }
  const levelUps: Partial<Record<GymStat, number>> = {};
  for (const s of GYM_STATS) { const d = levelOf(points[s]) - levelOf(before[s]); if (d > 0) levelUps[s] = d; }
  const firstOfGap = Object.keys(ring.done).length === 1;
  const gym: GymState = { ...g1, points, ring, last: now, visits: g1.visits + (firstOfGap ? 1 : 0), rings: g1.rings + (ringClosed ? 1 : 0) };
  const ups = Object.keys(levelUps) as GymStat[];
  const words = [
    `${STAT_NAMES[stat]} +${gained}${cold ? " (window closed: half points; it is open again now)" : ""}.`,
    ringClosed ? `Ring closed: +${ringBonus} to all three.` : `${3 - Object.keys(ring.done).length} more machine${3 - Object.keys(ring.done).length === 1 ? "" : "s"} to close today's ring.`,
    ...ups.map((s) => `${STAT_NAMES[s]} level ${levelOf(points[s])}!`),
    slipped ? `You'd missed ${slipped} workout window${slipped === 1 ? "" : "s"}: Strength and Cardio slipped ${SLIP * slipped}.` : "",
  ].filter(Boolean).join(" ");
  return { gym, stat, gained, ringClosed, ringBonus, levelUps, slipped, cold, words };
}

/** A protein shake at the water cooler: this gap's points ×1.2 (once per gap; does nothing after the ring closes). */
export function takeProtein(g0: GymState, now: Gap): GymState {
  const ring = g0.ring && sameGap(g0.ring.gap, now) ? g0.ring : { gap: now, done: {}, closed: false };
  return { ...g0, ring: { ...ring, protein: true } };
}

// ── the career (behind the flag) ───────────────────────────────────────────

export interface GymCareerOut {
  career: CareerState;
  out: ExerciseOut;
  /** What changed on the career outside the gym's own numbers (all zero while the flag is off). */
  energy: number;
  power: number;
  pace: number;
  spentAction: boolean;
}

/** Slept in your 3D bed this gap (home3d/sleep.ts). */
const sleptNow = (c: CareerState) => !!c.lastSleep && c.lastSleep.season === c.season && c.lastSleep.week === c.week;

/**
 * One machine done in a career. The gym's own numbers are always saved (`career.gym`). The rest
 * follows `mode` (default GYM_CAREER_EFFECT, "off"): nothing, or the visit as one of the week's
 * things with some energy back, or that plus Power/Pace on level ups.
 */
export function gymExercise(c: CareerState, result: Pick<GameResult, "kind" | "quality">, mode: GymEffectMode = GYM_CAREER_EFFECT): GymCareerOut {
  const now = gapOf(c);
  const g0 = gymOf(c);
  const wasVisited = !!g0.ring && sameGap(g0.ring.gap, now) && Object.keys(g0.ring.done).length > 0;
  const out = doExercise(g0, now, result, { slept: sleptNow(c) });
  let career: CareerState = { ...c, gym: out.gym };
  let energy = 0, power = 0, pace = 0, spentAction = false;
  if (mode !== "off" && !out.why) {
    // the first machine of the gap is the week's visit: one of the week's things, like Rest
    if (!wasVisited) {
      if (actionsLeft(career) > 0) {
        const restE = rest(career).energy - career.energy; // what Rest would give now
        const give = Math.max(0, Math.min(restE, Math.round(restE * GYM_ENERGY_SHARE * Math.max(0, Math.min(1, result.quality)))));
        career = { ...career, weekActions: actionsLeft(career) - 1, energy: Math.min(100, career.energy + give) };
        energy = give; spentAction = true;
      }
    }
    if (mode === "energyPowerPace" && career.skills) {
      const up = out.levelUps;
      power = up.strength ?? 0; pace = up.cardio ?? 0;
      if (power || pace) career = { ...career, skills: { ...career.skills, power: Math.min(99, career.skills.power + power), pace: Math.min(99, career.skills.pace + pace) } };
    }
  }
  return { career, out, energy, power, pace, spentAction };
}

/** For the phone's Fitness app (later) and the test page: the three stats, the ring and the window at `now`. */
export function gymView(g0: GymState, now: Gap) {
  const { gym, slipped } = gymAt(g0, now);
  const ring = gym.ring && sameGap(gym.ring.gap, now) ? gym.ring : null;
  return {
    stats: GYM_STATS.map((s) => ({ stat: s, name: STAT_NAMES[s], level: levelOf(gym.points[s]), share: levelShare(gym.points[s]), points: gym.points[s] })),
    ring: { done: (["bench", "treadmill", "bag"] as GymGameKind[]).filter((k) => ring?.done[k] !== undefined), closed: !!ring?.closed, protein: !!ring?.protein },
    window: windowLeft(g0, now),
    slipping: slipped,
  };
}
