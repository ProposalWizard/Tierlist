import type { CareerState, Skills } from "./types";
import { applyLevelResult, TRAINING_LEVELS } from "./trainingLevels";
import { getTuning } from "./tuningStore";

/**
 * THE SKILLS A LEVEL IS PLAYED WITH (Harry, 20 Oct 2026, on the Training
 * levels page's "your skills" slider: "Surely it should just be auto —
 * playing a level 20 skill would mean you have the 19 levels completed
 * before it?").
 *
 * So there is no slider. Level N plays with the skills a player has after
 * finishing levels 1 to N-1, worked out with the career's own rule
 * (trainingLevels.ts applyLevelResult: a skill is 40 + stars × 60 / 90, only
 * new stars count), from a new career's starting skills (tuning.ts
 * startingSkills, 40 each).
 *
 * What a level can't know, and the honest average taken:
 *  - How many stars each earlier level got (1-3: first, second or third
 *    try). We take the middle, 2 stars each (AUTO_STARS). At level 20 that
 *    is 65; 1 star each would be 53, 3 stars each 78.
 *  - How far the OTHER skills have got. We take the same point on their own
 *    ladders: a player who trains all five evenly.
 *  - Boots, stat cans and age. Not counted.
 */

export const AUTO_STARS = 2;

/** Every skill, in the order the screen lists them. */
export const SKILL_ORDER: (keyof Skills)[] = ["power", "technique", "freeKick", "pace", "vision", "aerial"];

export const SKILL_LABEL: Record<keyof Skills, string> = {
  power: "Power", technique: "Technique", freeKick: "Free kick", pace: "Pace", vision: "Vision", aerial: "Aerial",
};

/** A new career's skills (tuning.ts startingSkills.*). */
export function startingSkills(): Skills {
  return {
    pace: getTuning("startingSkills.pace"),
    power: getTuning("startingSkills.power"),
    technique: getTuning("startingSkills.technique"),
    vision: getTuning("startingSkills.vision"),
    freeKick: getTuning("startingSkills.freeKick"),
    aerial: getTuning("startingSkills.aerial"),
  };
}

/**
 * The skills at the start of `level`: every skill trained through levels
 * 1 to level-1 at `stars` stars each, by the career's own rule.
 */
export function skillsAtLevel(level: number, stars = AUTO_STARS, start: Skills = startingSkills()): Skills {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  let career = { skills: { ...start } } as unknown as CareerState;
  for (const k of SKILL_ORDER) {
    for (let done = 1; done < n; done++) career = applyLevelResult(career, k, done, stars).career;
  }
  return { ...career.skills };
}

/**
 * Which of your skills each drill actually reads (the rest change nothing):
 *  - Power, Technique: how hard you can hit it (Power) and how much it bends
 *    (Technique) — the real strike (CanvasMatch via EngineFeature).
 *  - Free kick: Power, and a dead ball is struck with Free kick blended over
 *    Technique (setPieces.ts setPieceSkills: 60% free kick, 40% technique).
 *  - Pace: none — the level sets how quick you run ("Your speed").
 *  - Vision: none.
 *  - Aerial: a header or volley is struck with Power and Technique like any
 *    shot; Aerial softens a mis-hit and sets a header's pace (aerial.ts),
 *    once the match hands it to the strike (see aerial.ts, "NOT YET LIVE").
 */
export const DRILL_READS: Record<keyof Skills, (keyof Skills)[]> = {
  power: ["power", "technique"],
  technique: ["power", "technique"],
  freeKick: ["power", "technique", "freeKick"],
  pace: [],
  vision: [],
  aerial: ["power", "technique", "aerial"],
};

/** "Power 65 · Technique 65" — the skills this drill reads, at this level. */
export function playsWithLine(drill: keyof Skills, level: number, stars = AUTO_STARS): string {
  const s = skillsAtLevel(level, stars);
  return DRILL_READS[drill].map(k => `${SKILL_LABEL[k]} ${s[k]}`).join(" · ");
}
