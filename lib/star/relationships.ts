import { POST_L, POST_R, GOAL_H } from "./pitch";

/**
 * RELATIONSHIPS — how boss, team, fans and your own happiness move
 * (Mikey, 4 Oct 2026, the relationships revamp; plan:
 * patch-notes/mikey/plans/relationships.html).
 *
 * Before this, an average player had boss, team and fans all at 100 within
 * about 20 matches, so the relationship games had nothing left to raise.
 * Three rules now:
 *  - A match's change (matchStats.ts's table) is scaled: a gain shrinks the
 *    closer the bar is to 100, a loss shrinks the closer it is to 0, and every
 *    gain is REL_GAIN_SCALE of the table. Simulated over 200 careers each,
 *    after one season (46 matches): struggling ~40, average ~68-82, good
 *    ~80-97; only a great player reaches 100.
 *  - Slow drift back towards the middle: above 60 a bar loses 1 every third
 *    match, below 40 it gains 1 every second match.
 *  - Fractions are kept (career.relCarry), so a small gain still counts once
 *    it adds up.
 *
 * Happiness has one job: how much energy resting gives back
 * (happinessEnergyFactor). It is not bought or played for: it is the average
 * of your boss, team and fans (Mikey, 5 Oct 2026: "your happiness should be
 * determined by your relationships… those become an average"). Always read it
 * through happinessOf; `career.happiness` is kept in step but never trusted.
 */

export type RelKey = "boss" | "team" | "fans";
export const REL_KEYS: RelKey[] = ["boss", "team", "fans"];

/** Every match gain is this share of the table's number. */
export const REL_GAIN_SCALE = 0.65;
/** Above this a bar drifts down; below DRIFT_LOW it drifts up. */
export const DRIFT_HIGH = 60;
export const DRIFT_LOW = 40;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** A raw change (the table's number) as it lands on a bar at `value`. */
export function scaledChange(value: number, raw: number): number {
  if (raw > 0) return raw * REL_GAIN_SCALE * Math.max(0, 1 - value / 105);
  if (raw < 0) return raw * (0.4 + value / 160);
  return 0;
}

/** One bar after a match: the scaled change, the kept fraction, then the
 *  drift. `matchNo` is a running count of matches (for the drift's rhythm). */
export function stepBar(value: number, carry: number, raw: number, matchNo: number): { value: number; carry: number } {
  const exact = value + carry + scaledChange(value, raw);
  let next = clamp(Math.round(exact));
  let rest = next === 0 || next === 100 ? 0 : exact - next;
  rest = Math.max(-0.5, Math.min(0.5, rest));
  next = drift(next, matchNo);
  return { value: next, carry: rest };
}

/** The slow pull back towards the middle, once per match (played or missed). */
export function drift(value: number, matchNo: number): number {
  if (value > DRIFT_HIGH && matchNo % 3 === 0) return value - 1;
  if (value < DRIFT_LOW && matchNo % 2 === 0) return value + 1;
  return value;
}

/** Your happiness: the average of boss, team and fans, 0-100. */
export function happinessOf(c: { relationships?: { boss: number; team: number; fans: number } }): number {
  const r = c.relationships;
  if (!r) return 50;
  return clamp(Math.round((r.boss + r.team + r.fans) / 3));
}

/** How much of the usual energy resting gives back: 0.7× at 0 happiness,
 *  1× at 50, 1.3× at 100. Used for rest days between matches and Rest. */
export function happinessEnergyFactor(happiness: number | undefined): number {
  const h = clamp(happiness ?? 50);
  return 0.7 + h * 0.006;
}

/** What a relationship game pays: more when the bar is low, less when it's
 *  high (Harry, 1 Oct 2026: "the higher up you go, the harder it is").
 *  A loss costs 1 (the boss chat 2). `roll` is 0-1 (only used above 85). */
export function gameReward(won: boolean, current: number, roll: number, kind?: string): number {
  if (!won) return kind === "boss" ? -2 : -1;
  if (current < 40) return 6;
  if (current < 70) return 4;
  if (current <= 85) return 2;
  return roll < 0.5 ? 1 : 0;
}

/** Each relationship game once a week. */
export function gamePlayedThisWeek(played: { week: number; season: number; kinds: string[] } | undefined, season: number, week: number, kind: string): boolean {
  return !!played && played.season === season && played.week === week && played.kinds.includes(kind);
}

/** The woodwork challenge (relgames/WoodworkChallenge.tsx): is the ball
 *  touching a post or the bar this step? Ball radius plus half a post. */
const FRAME_HIT = 0.22;
export function touchingFrame(b: { x: number; y: number; z: number }): boolean {
  if (b.y > 0.6 || b.y < -0.3) return false;
  const nearPost = (Math.abs(b.x - POST_L) < FRAME_HIT || Math.abs(b.x - POST_R) < FRAME_HIT) && b.z < GOAL_H + FRAME_HIT;
  const nearBar = Math.abs(b.z - GOAL_H) < FRAME_HIT && b.x > POST_L - FRAME_HIT && b.x < POST_R + FRAME_HIT;
  return nearPost || nearBar;
}
