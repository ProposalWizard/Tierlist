import type { CareerState, Skills } from "./types";

/**
 * TRAINING LEVELS — New Star Soccer's ladder (Mikey, 25 Sep 2026).
 *
 * Every skill has 30 fixed levels. A level is the same picture every time it
 * is played, so it can be learnt. You get three tries: in on the first is
 * three stars, the second two, the third one, none is nothing. Any star on a
 * level unlocks the next. Stars are what raise the skill:
 *
 *   skill = 40 + round(stars × 60 / 90)
 *
 * so all 90 stars (30 × 3) take a skill from 40 to exactly 100, and a star is
 * worth two thirds of a point. Only NEW stars count — replaying a level you
 * already have three stars on can't be farmed.
 *
 * Decided with the build: 30 levels; age does not change what a star is
 * worth; every skill starts at 40; matches no longer give skill points.
 *
 * Skills still fall (not training for a while, age from 30 — careerFlow.ts).
 * Stars are never taken away, and passing any unlocked level wins lost
 * points back, one per star earned on that attempt, up to what your stars
 * are worth.
 */

export const TRAINING_LEVELS = 30;
export const SKILL_START = 40;
export const SKILL_MAX = 100;
const MAX_STARS = TRAINING_LEVELS * 3;

export type TrainingStars = Partial<Record<keyof Skills, number[]>>;

/**
 * How hard a level is, on the old 0-100 drill scale the drill builders
 * (trainingDrills.ts) already understand. Level 1 is the drill a 40 player
 * used to get; level 30 is the drill a 100 player used to get.
 */
export function levelDifficulty(level: number): number {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  return SKILL_START + ((n - 1) * (SKILL_MAX - SKILL_START)) / (TRAINING_LEVELS - 1);
}

/** The fixed seed that makes a level the same picture every time. */
export function levelSeed(skill: keyof Skills, level: number): number {
  let h = 2166136261;
  for (const ch of `${skill}:${level}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Stars for getting it on this try (0-based). */
export function starsForTry(tryIndex: number): number {
  return Math.max(0, 3 - tryIndex);
}

/** What a number of stars is worth as a skill value. */
export function skillFromStars(stars: number): number {
  const s = Math.max(0, Math.min(MAX_STARS, stars));
  return SKILL_START + Math.round((s * (SKILL_MAX - SKILL_START)) / MAX_STARS);
}

/**
 * The stars an old save is treated as having already earned, so nobody loses
 * what they had: whole levels at three stars, then whatever is left on the
 * next one. A skill at 70 is 45 stars — levels 1-15 at three stars.
 */
export function starsFromSkill(value: number): number[] {
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(((value - SKILL_START) * MAX_STARS) / (SKILL_MAX - SKILL_START))));
  const out = Array.from({ length: TRAINING_LEVELS }, () => 0);
  for (let i = 0; i < TRAINING_LEVELS; i++) out[i] = Math.max(0, Math.min(3, stars - i * 3));
  return out;
}

/** This career's stars for one skill, filling in an old save from its number. */
export function starsOf(career: CareerState, skill: keyof Skills): number[] {
  const saved = career.trainingStars?.[skill];
  if (saved && saved.length === TRAINING_LEVELS) return saved;
  return starsFromSkill(career.skills[skill]);
}

export function totalStars(levels: number[]): number {
  return levels.reduce((a, b) => a + b, 0);
}

/** The highest level you may play: every level up to the first with no star. */
export function highestUnlocked(levels: number[]): number {
  const firstEmpty = levels.findIndex((s) => s === 0);
  return firstEmpty < 0 ? TRAINING_LEVELS : firstEmpty + 1;
}

/**
 * Bank one attempt at a level. Returns the updated career (skills and stars
 * only — the caller spends the action and the energy).
 */
export function applyLevelResult(
  career: CareerState,
  skill: keyof Skills,
  level: number,
  stars: number,
): { career: CareerState; gained: number; newStars: number } {
  const before = starsOf(career, skill);
  const i = Math.max(0, Math.min(TRAINING_LEVELS - 1, level - 1));
  const after = [...before];
  after[i] = Math.max(before[i], Math.max(0, Math.min(3, stars)));
  const newStars = after[i] - before[i];

  const oldCeiling = skillFromStars(totalStars(before));
  const newCeiling = skillFromStars(totalStars(after));
  const current = career.skills[skill];
  // Points lost to decay or age come back one per star on this attempt.
  const winBack = Math.max(0, Math.min(oldCeiling - current, stars));
  const value = Math.min(SKILL_MAX, Math.min(newCeiling, current + winBack + (newCeiling - oldCeiling)));
  const next = Math.max(current, value);

  return {
    career: {
      ...career,
      skills: { ...career.skills, [skill]: next },
      trainingStars: { ...(career.trainingStars ?? {}), [skill]: after },
    },
    gained: next - current,
    newStars,
  };
}
