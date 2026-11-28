/**
 * THE GYM'S PROGRESS: Strength, Cardio, Focus and Resilience (Harry, 27 Nov 2026: "a gym based on the GTA 6
 * gym"; phase 2, 28 Nov: "the gym should have a very slow build-up … slow lasting gains are probably the
 * best … with the new stat as well"). docs/research/gym-compound-driving-2026-11-27.md section 3b and
 * docs/research/gym-effects-2026-11-27.md. Pure: no three.js, no screens.
 *
 * GTA 6 runs on days. Our career runs on the WEEK: the gap between one match and the next (week.ts),
 * which is also how a night's sleep works (home3d/sleep.ts). So, as GTA does it but by gaps:
 *
 *  - FOUR STATS, four levels each (level 1 to 4, 100 points a level). Every exercise feeds one or two of them
 *    (STAT_MIX): Strength from the bench, pull-ups, squats, push-ups; Cardio from the treadmill, the ladder,
 *    box jumps; Focus from the heavy bag, the plank, the ladder; RESILIENCE (new) from Nordic curls, the
 *    Copenhagen plank, landing balance and the mobility flow.
 *  - ONE VISIT PER GAP, A RING OF THREE. Each exercise pays once per gap; a visit is any three exercises.
 *    Three that cover at least two stats CLOSE THE RING (a small bonus to each stat you trained). After three,
 *    more training in the same gap pays nothing ("once you close the daily ring, more does nothing").
 *  - THE WORKOUT WINDOW. A visit opens a window over the next WINDOW_GAPS gaps. Train inside it and the points
 *    count in full. Train with no window open (the first visit, or after a lapse) and they count half: that
 *    visit opens the window again. Let it close with no visit and Strength and Cardio slip SLIP points for each
 *    window missed (at most MAX_SLIPS at once), Resilience half that. Focus never slips.
 *  - SLEEP AND PROTEIN. Slept in your bed this gap: points ×1.2. A protein shake this gap: ×1.2. Both: ×1.44.
 *    Lunch's plate (life/lunch.ts: protein ×1.1, balanced ×1.05, the session after it) shares the shake's ×1.2:
 *    shake and plate together never pass FUEL_CEILING.
 *  - NEVER MAXED IN ONE GO. A stat gains at most PER_GAP_MAX points in a gap, so level 1 to 4 takes at least
 *    6 perfect gaps.
 *  - THE BODY FOLLOWS, LATE. Each visit leaves a mark (`trail`) of Strength and Cardio; the body's shape reads
 *    the mark from a window ago (bodyPoints), so looks and stats agree and one missed week never flickers it.
 *
 * WHAT IT DOES TO THE CAREER lives in ./effect.ts, behind GYM_CAREER_EFFECT (OFF). Off, a visit records the
 * gym's own numbers and nothing else on the career moves.
 *
 * Saved as `career.gym` (optional: every older save loads with no gym yet; a phase 1 save gets Resilience 0).
 * Test: tests/star/gym.mts.
 */
import type { CareerState } from "../types";
import type { GameResult, GymGameKind } from "./games";
import { actionsLeft, rest } from "../week";
import { lunchGymLift } from "../life/lunch";

export type GymStat = "strength" | "cardio" | "focus" | "resilience";
export const GYM_STATS: GymStat[] = ["strength", "cardio", "focus", "resilience"];
/** What each exercise feeds (shares add to 1). */
export const STAT_MIX: Record<GymGameKind, Partial<Record<GymStat, number>>> = {
  bench: { strength: 1 }, treadmill: { cardio: 1 }, bag: { focus: 1 },
  pullup: { strength: 1 }, squat: { strength: 1 }, pushup: { strength: 0.7, cardio: 0.3 },
  plank: { strength: 0.5, focus: 0.5 }, nordic: { resilience: 1 }, copenhagen: { resilience: 1 },
  boxjump: { strength: 0.5, cardio: 0.5 }, ladder: { cardio: 0.6, focus: 0.4 },
  landing: { resilience: 0.7, focus: 0.3 }, mobility: { resilience: 1 },
};
/** Each exercise's main stat (the biggest share; the first on a tie): the ring's "stats covered", the screen's colour. */
export const STAT_OF = Object.fromEntries(Object.entries(STAT_MIX).map(([k, m]) => [k, (Object.entries(m) as [GymStat, number][]).sort((a, b) => b[1] - a[1])[0][0]])) as Record<GymGameKind, GymStat>;
export const STAT_NAMES: Record<GymStat, string> = { strength: "Strength", cardio: "Cardio", focus: "Focus", resilience: "Resilience" };

export const LEVEL_POINTS = 100;
export const MAX_LEVEL = 4;
/** Level 4 is the top: points stop there. */
export const MAX_POINTS = (MAX_LEVEL - 1) * LEVEL_POINTS;
/** Points a perfect go on one exercise gives (shared out by STAT_MIX), inside the window. */
export const MACHINE_POINTS = 40;
/** Closing the ring: this much more to each stat trained in it, times the visit's average quality. */
export const RING_BONUS = 10;
/** A visit is this many exercises; the ring closes when they cover at least RING_STATS stats. */
export const RING_SIZE = 3;
export const RING_STATS = 2;
/** The most one stat can gain in one gap. */
export const PER_GAP_MAX = 50;
/** How many gaps after a visit the window stays open. */
export const WINDOW_GAPS = 2;
/** Points Strength and Cardio lose for each window missed (Resilience loses half; Focus none). */
export const SLIP = 30;
export const SLIP_SHARE: Record<GymStat, number> = { strength: 1, cardio: 1, resilience: 0.5, focus: 0 };
export const MAX_SLIPS = 3;
export const SLEEP_BOOST = 1.2;
export const PROTEIN_BOOST = 1.2;
/** The shake and lunch's plate together (life/lunch.ts lunchGymLift) never pass this: one ceiling, never stacked. */
export const FUEL_CEILING = 1.2;
/** The shake times the plate, capped at FUEL_CEILING. */
export const fuelMult = (shake: boolean, plate = 1) => Math.min(FUEL_CEILING, (shake ? PROTEIN_BOOST : 1) * Math.max(1, plate));
/** Outside the window a visit counts this much. */
export const COLD_START = 0.5;

/** The career effect's switch (./effect.ts reads it): "off" until Harry decides. "energy" and "energyPowerPace"
 *  are phase 1's two options; "mix" is phase 2's option C (slow lasting gains, a next-match lift, Resilience). */
export type GymEffectMode = "off" | "energy" | "energyPowerPace" | "mix";
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
  /** This gap's ring: which exercises are done and how well, what each stat has gained. Cleared on a new gap. */
  ring?: { gap: Gap; done: Partial<Record<GymGameKind, number>>; closed: boolean; protein?: boolean; gained?: Partial<Record<GymStat, number>> };
  /** Visits ever, rings closed ever (for a badge or the phone's Fitness app). */
  visits: number;
  rings: number;
  /** Strength and Cardio as each visit left them (newest last, a few kept): the body reads the one a window ago. */
  trail?: { gap: Gap; strength: number; cardio: number }[];
}

export function newGym(): GymState {
  return { v: 1, points: { strength: 0, cardio: 0, focus: 0, resilience: 0 }, visits: 0, rings: 0 };
}
/** The career's gym (a new one on an old save, never mutating it; a phase 1 gym gets Resilience 0). */
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
/** Gaps from a to b (a new season counts as the window and more: a summer is a long gap). */
function gapsBetween(a: Gap, b: Gap): number {
  if (b.season === a.season) return b.week - a.week;
  if (b.season > a.season) return WINDOW_GAPS + 1 + Math.max(0, b.week - 1);
  return -1;
}

/**
 * How many windows closed between the last visit and `now` with no visit. Same season: every
 * WINDOW_GAPS gaps past the window is one more. A new season (the summer): one for the summer,
 * plus the gaps since the season began.
 */
export function missedWindows(last: Gap | undefined, now: Gap): number {
  if (!last) return 0;
  const gaps = gapsBetween(last, now);
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
  const points = { ...newGym().points, ...g0.points };
  for (const s of GYM_STATS) points[s] = Math.max(0, points[s] - Math.round(SLIP * SLIP_SHARE[s]) * n);
  // the window has been dealt with: the slips are taken once
  return { gym: { ...g0, points, last: undefined }, slipped: n };
}

export interface ExerciseOut {
  gym: GymState;
  /** The exercise's main stat. */
  stat: GymStat;
  /** Points this exercise added in all (after the window, sleep, protein, and the gap's cap). */
  gained: number;
  /** Points by stat this exercise added (before the ring's bonus). */
  by: Partial<Record<GymStat, number>>;
  /** The ring closed with this one (the bonus went to each stat trained in it). */
  ringClosed: boolean;
  /** Bonus points the ring gave each stat it covered. */
  ringBonus: number;
  /** Levels gained, by stat (Strength 2 → 3 = { strength: 1 }). */
  levelUps: Partial<Record<GymStat, number>>;
  /** Why nothing was gained (the exercise is done this gap, the visit's three are done). */
  why?: "machineDone" | "ringClosed" | "ringFull";
  /** Windows missed before this visit, taken off now. */
  slipped: number;
  /** The window was closed, so it counted half (and opened it again). */
  cold: boolean;
  words: string;
}

/** Stats the ring's exercises cover (by their main stat). */
export const ringStats = (done: Partial<Record<GymGameKind, number>>) => Array.from(new Set((Object.keys(done) as GymGameKind[]).map((k) => STAT_OF[k])));

/**
 * One exercise done. `slept`: you slept this gap (sleep.ts). Pure; returns a new gym.
 */
export function doExercise(g0: GymState, now: Gap, result: Pick<GameResult, "kind" | "quality">, o: { slept?: boolean; plate?: number } = {}): ExerciseOut {
  const stat = STAT_OF[result.kind];
  const { gym: g1, slipped } = gymAt(gymOf({ gym: g0 }), now);
  const ring = g1.ring && sameGap(g1.ring.gap, now) ? { ...g1.ring, done: { ...g1.ring.done }, gained: { ...(g1.ring.gained ?? {}) } } : { gap: now, done: {} as Partial<Record<GymGameKind, number>>, closed: false, gained: {} as Partial<Record<GymStat, number>> };
  const base = { stat, gained: 0, by: {}, ringClosed: false, ringBonus: 0, levelUps: {}, slipped, cold: false };
  const nDone = Object.keys(ring.done).length;
  if (ring.closed) return { ...base, gym: { ...g1, ring }, why: "ringClosed", words: "Today's ring is already closed. More training does nothing until after the next match." };
  if (nDone >= RING_SIZE) return { ...base, gym: { ...g1, ring }, why: "ringFull", words: `You've done your ${RING_SIZE} for this week. More training does nothing until after the next match.` };
  if (ring.done[result.kind] !== undefined) return { ...base, gym: { ...g1, ring }, why: "machineDone", words: `${STAT_NAMES[stat]} from this one is done for this week. Try something else.` };
  const open = windowOpen(g1, now);
  const cold = !open;
  const mult = (cold ? COLD_START : 1) * (o.slept ? SLEEP_BOOST : 1) * fuelMult(!!ring.protein, o.plate);
  const q = Math.max(0, Math.min(1, result.quality));
  ring.done[result.kind] = q;
  const before = { ...g1.points };
  const points = { ...g1.points };
  const add = (s: GymStat, n: number) => {
    const room = Math.max(0, PER_GAP_MAX - (ring.gained[s] ?? 0));
    const v = Math.max(0, Math.min(room, n, MAX_POINTS - points[s]));
    points[s] += v;
    ring.gained[s] = (ring.gained[s] ?? 0) + v;
    return v;
  };
  const by: Partial<Record<GymStat, number>> = {};
  let gained = 0;
  for (const [s, share] of Object.entries(STAT_MIX[result.kind]) as [GymStat, number][]) {
    const v = add(s, Math.round(MACHINE_POINTS * share * q * mult));
    by[s] = v; gained += v;
  }
  let ringClosed = false, ringBonus = 0;
  const kinds = Object.keys(ring.done) as GymGameKind[];
  if (kinds.length >= RING_SIZE && ringStats(ring.done).length >= RING_STATS) {
    ring.closed = true; ringClosed = true;
    const avg = kinds.reduce((a, k) => a + (ring.done[k] ?? 0), 0) / kinds.length;
    ringBonus = Math.round(RING_BONUS * avg * mult);
    const trained = new Set<GymStat>(kinds.flatMap((k) => Object.keys(STAT_MIX[k]) as GymStat[]));
    for (const s of Array.from(trained)) add(s, ringBonus);
  }
  const levelUps: Partial<Record<GymStat, number>> = {};
  for (const s of GYM_STATS) { const d = levelOf(points[s]) - levelOf(before[s]); if (d > 0) levelUps[s] = d; }
  const firstOfGap = kinds.length === 1;
  const trail = [...(g1.trail ?? []).filter((m) => !sameGap(m.gap, now)), { gap: now, strength: points.strength, cardio: points.cardio }].slice(-6);
  const gym: GymState = { ...g1, points, ring, last: now, visits: g1.visits + (firstOfGap ? 1 : 0), rings: g1.rings + (ringClosed ? 1 : 0), trail };
  const ups = Object.keys(levelUps) as GymStat[];
  const left = RING_SIZE - kinds.length;
  const words = [
    `${(Object.entries(by) as [GymStat, number][]).map(([s, v]) => `${STAT_NAMES[s]} +${v}`).join(", ")}${cold ? " (window closed: half points; it is open again now)" : ""}.`,
    ringClosed ? `Ring closed: +${ringBonus} to what you trained.`
      : left > 0 ? `${left} more exercise${left === 1 ? "" : "s"} to close today's ring${ringStats(ring.done).length < RING_STATS && left === 1 ? " (pick another kind of training)" : ""}.`
      : `Three done, but all one kind of training: the ring needs two kinds.`,
    ...ups.map((s) => `${STAT_NAMES[s]} level ${levelOf(points[s])}!`),
    slipped ? `You'd missed ${slipped} workout window${slipped === 1 ? "" : "s"}: Strength and Cardio slipped ${SLIP * slipped}.` : "",
  ].filter(Boolean).join(" ");
  return { gym, stat, gained, by, ringClosed, ringBonus, levelUps, slipped, cold, words };
}

/** A protein shake at the water cooler: this gap's points ×1.2 (once per gap; does nothing after the ring closes). */
export function takeProtein(g0: GymState, now: Gap): GymState {
  const ring = g0.ring && sameGap(g0.ring.gap, now) ? g0.ring : { gap: now, done: {}, closed: false };
  return { ...g0, ring: { ...ring, protein: true } };
}

/**
 * The points the BODY shows at `now` (./body.ts turns them into a shape): Strength and Cardio as they stood a
 * window ago (the newest visit at least WINDOW_GAPS gaps back), with any slips since taken, never above the
 * points now. Before that first mark: nothing yet (the build you chose, as it is).
 */
export function bodyPoints(g0: GymState | undefined, now: Gap): { strength: number; cardio: number } {
  if (!g0) return { strength: 0, cardio: 0 };
  const { gym } = gymAt(gymOf({ gym: g0 }), now);
  const old = (gym.trail ?? []).filter((m) => { const d = gapsBetween(m.gap, now); return d >= WINDOW_GAPS; });
  const m = old[old.length - 1];
  if (!m) return { strength: 0, cardio: 0 };
  return { strength: Math.min(m.strength, gym.points.strength), cardio: Math.min(m.cardio, gym.points.cardio) };
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
 * One exercise done in a career. The gym's own numbers are always saved (`career.gym`). The rest follows
 * `mode` (default GYM_CAREER_EFFECT, "off"): nothing; or ("energy") the visit as one of the week's things with
 * some energy back; or ("energyPowerPace") that plus Power/Pace on level ups; or ("mix", option C) the visit as
 * one of the week's things and nothing else here: its gains are read at match time (./effect.ts).
 */
export function gymExercise(c: CareerState, result: Pick<GameResult, "kind" | "quality">, mode: GymEffectMode = GYM_CAREER_EFFECT): GymCareerOut {
  const now = gapOf(c);
  const g0 = gymOf(c);
  const wasVisited = !!g0.ring && sameGap(g0.ring.gap, now) && Object.keys(g0.ring.done).length > 0;
  // lunch's plate (protein ×1.1, balanced ×1.05) for the session after it, sharing the shake's ×1.2 ceiling
  const out = doExercise(g0, now, result, { slept: sleptNow(c), plate: lunchGymLift(c) });
  let career: CareerState = { ...c, gym: out.gym };
  let energy = 0, power = 0, pace = 0, spentAction = false;
  if (mode !== "off" && !out.why) {
    // the first exercise of the gap is the week's visit: one of the week's things, like Rest
    if (!wasVisited && actionsLeft(career) > 0) {
      if (mode === "mix") {
        career = { ...career, weekActions: actionsLeft(career) - 1 };
        spentAction = true;
      } else {
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

/** For the phone's Fitness app (later) and the test page: the four stats, the ring and the window at `now`. */
export function gymView(g0: GymState, now: Gap) {
  const { gym, slipped } = gymAt(gymOf({ gym: g0 }), now);
  const ring = gym.ring && sameGap(gym.ring.gap, now) ? gym.ring : null;
  const done = ring ? (Object.keys(ring.done) as GymGameKind[]) : [];
  return {
    stats: GYM_STATS.map((s) => ({ stat: s, name: STAT_NAMES[s], level: levelOf(gym.points[s]), share: levelShare(gym.points[s]), points: gym.points[s] })),
    ring: { done, size: RING_SIZE, stats: ringStats(ring?.done ?? {}), closed: !!ring?.closed, protein: !!ring?.protein },
    window: windowLeft(g0, now),
    slipping: slipped,
  };
}
