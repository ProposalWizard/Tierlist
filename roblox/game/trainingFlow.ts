/**
 * Training on the server: the skills screen's rules (components/star/SkillsScreen.tsx),
 * the level select (TrainingLevelSelect) and page.tsx's handleTrain /
 * handleTrainingComplete. A level itself is played on the device
 * (roblox/game/trainingPlay.ts); only its stars (0-3) come back.
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 */
import type { CareerState, Skills } from "../../lib/star/types";
import { starsOf, totalStars, highestUnlocked, applyLevelResult, TRAINING_LEVELS } from "../../lib/star/trainingLevels";
import { trainingLeft, spendTrainingSession, TRAINING_SESSIONS_PER_WEEK } from "../../lib/star/week";
import { getTuning } from "../../lib/star/tuningStore";
import { mechanicOpen, mechanicDef } from "../../lib/star/mechanics";
import { trainingDayOn, trainingDayLeft, recordTrainingDayDrill } from "../../lib/star/story";
import { recordDrill } from "../../lib/star/unlocks";
import { computeStarRating } from "../../lib/star/rating";
import { starsNow, starStatus } from "../../lib/star/starPoints";
import { trainingOverlay } from "../../lib/star/trainingLevelData";

export type TrainingSkill = keyof Skills;

/** SkillsScreen's list, in its order: the skill, its name, its icon, what it does. */
export const SKILL_LABELS: [TrainingSkill, string, string, string][] = [
  ["pace", "Pace", "⚡", "Faster dribbles, more runs into space, quicker Touch Mode chase"],
  ["power", "Power", "💪", "Long shots and stronger crosses"],
  ["technique", "Technique", "🎯", "Ball control, curl, precise strikes"],
  ["vision", "Vision", "👁️", "More team-mates to pass to in every chance"],
  ["freeKick", "Free Kick", "🎪", "Free kicks, corners and penalties, and how many are yours"],
  ["aerial", "Aerial & Acrobatics", "🤸", "Headers and volleys"],
];

/** SkillsScreen's ENERGY_COST (exported as TRAINING_ENERGY_COST). */
export function trainingEnergyCost(): number { return getTuning("energy.trainingCost"); }
export { TRAINING_SESSIONS_PER_WEEK, TRAINING_LEVELS };

/** One skill's card: SkillCard's value, stars, and whether it can be trained now (canTrain / shut). */
export function skillCard(c: CareerState, skill: TrainingSkill): {
  value: number; stars: number; shut: boolean; shutWhy: string | null; canTrain: boolean; why: string | null; highest: number;
} {
  const left = trainingLeft(c);
  const shut = skill === "aerial" && !mechanicOpen(c, "aerial");
  const cost = trainingEnergyCost();
  const value = c.skills[skill];
  const day = trainingDayOn(c) && trainingDayLeft(c).includes(skill);
  const canTrain = !shut && c.energy >= cost && value < 100 && (left > 0 || day);
  const why = shut ? null : value >= 100 ? "Maxed out." : left <= 0 && !day ? "No more sessions this week." : c.energy < cost ? `Needs ${cost} energy.` : null;
  const levels = starsOf(c, skill);
  return {
    value, stars: totalStars(levels), shut,
    shutWhy: shut ? `Opens ${mechanicDef("aerial").when.toLowerCase()}` : null,
    canTrain, why, highest: highestUnlocked(levels),
  };
}

/** TrainingLevelSelect: each level's stars, and which can be played (up to the first with none). */
export function levelList(c: CareerState, skill: TrainingSkill): { level: number; stars: number; open: boolean }[] {
  const levels = starsOf(c, skill);
  const top = highestUnlocked(levels);
  return levels.map((s, i) => ({ level: i + 1, stars: s, open: i + 1 <= top }));
}

/** handleTrain + the level select: may this level be played now? */
export function mayPlayLevel(c: CareerState, skill: TrainingSkill, level: number): boolean {
  const card = skillCard(c, skill);
  return card.canTrain && Number.isInteger(level) && level >= 1 && level <= card.highest && level <= TRAINING_LEVELS;
}

/** What the device needs to play a level: the shared level edits (the website loads them from its table). */
export function levelOverlay(): Record<string, unknown> { return trainingOverlay(); }

/** page.tsx handleTrainingComplete. Returns the career and the points gained. */
export function trainingComplete(career: CareerState, skill: TrainingSkill, level: number, stars: number): { career: CareerState; gained: number; newStars: number } {
  const s = Math.max(0, Math.min(3, Math.round(stars)));
  const res = applyLevelResult(career, skill, level, s);
  const dayDrill = trainingDayOn(career) && trainingDayLeft(career).includes(skill);
  const updated: CareerState = {
    ...res.career,
    lastTrainedWeek: { ...career.lastTrainedWeek, [skill]: career.week },
    energy: Math.max(0, career.energy - trainingEnergyCost()),
    starRating: career.starRating,
  };
  updated.starRating = computeStarRating(updated);
  const drilled = recordDrill(spendTrainingSession(updated), starStatus(career).total, starsNow(career));
  return { career: dayDrill ? recordTrainingDayDrill(drilled, skill) : drilled, gained: res.gained, newStars: res.newStars };
}

/** The website's shared level edits, fetched by the server once (lib/star/trainingLevelStore.ts). */
export { fetchSharedTrainingLevels } from "../../lib/star/trainingLevelStore";
