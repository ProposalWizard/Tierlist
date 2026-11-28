/**
 * WHAT THE GYM DOES TO THE CAREER: option C, "a mix of A and B" (Harry, 28 Nov 2026: "slow lasting gains are
 * probably the best … a mix of A and B like you said is probably the best way to do it, with the new stat as
 * well. So maybe that's like an injury. We don't even have injuries really though."). The research and its
 * numbers: docs/research/gym-effects-2026-11-27.md section 4. Pure: no screens.
 *
 * BEHIND THE FLAG. progress.ts GYM_CAREER_EFFECT is "off": every function here gives nothing (0, ×1) and the
 * career plays exactly as before. "mix" switches all three layers on. Tests and the soak flip it for one run
 * with setGymEffectForTest (never the game).
 *
 *  1. SLOW LASTING GAINS (A). Strength level 1/2/3/4 adds Power +0/+1/+3/+5; Cardio level adds Pace the same.
 *     Never more than +5 each. Built over many weeks (a stat gains at most 50 a gap, 100 a level) and lost when
 *     the window lapses (progress.ts: 30 points a missed window). A separate "Gym +n" on top of the trained
 *     skill, not added into it: the star rating is untouched.
 *  2. THE NEXT MATCH (B, small). Trained this gap: Power and Pace +1 for the next match; the ring closed: +2.
 *     Gone after the whistle (the ring belongs to this gap only).
 *  3. RESILIENCE (the new stat). With injuries switched off (injurySwitch.ts) it means, today:
 *       - LATE LEGS: energy spent after the 60th minute is cut by 0 / 5 / 10 / 15% (level 1-4), given back at
 *         the final whistle (creditMatchResult). A full Medium match spends 20 of its 60 after the hour, so at
 *         most 3 energy back.
 *       - RECOVERY: rest days between matches give 0 / 3 / 5 / 8% more energy (Sat to Sat: 48 → up to 52).
 *       - THE INJURY HOOK (for the injury system to come): resilienceInjuryScale() is 1 / 0.92 / 0.85 / 0.75,
 *         the share of today's injury chance a player at that level keeps (Nordic and Copenhagen work cut
 *         hamstring and groin injuries in trials). creditMatchResult already multiplies its injury roll by
 *         it; with INJURIES_ON false that roll never happens, so it changes nothing yet.
 *
 * Where each one is read: Power in the played match (app/star-dev/page.tsx effectivePower) and in "Sim this
 * match" (simMatch.ts), Pace in "Sim this match" (the played match's runner reads career.skills.pace in the
 * engine: the hook is gymSkillBonus(career).pace, not wired there, the engine lane's call). Energy and the
 * injury hook in careerFlow.ts creditMatchResult. Test: tests/star/gym.mts. Soak: scripts/gym/soak.mts.
 */
import type { CareerState } from "../types";
import { GYM_CAREER_EFFECT, gymOf, gymAt, gapOf, levelOf, type GymEffectMode, type GymState } from "./progress";

let override: GymEffectMode | null = null;
/** For tests and the soak only: run as if the flag were `m` (null: the real flag). */
export function setGymEffectForTest(m: GymEffectMode | null) { override = m; }
export const gymEffectMode = (): GymEffectMode => override ?? GYM_CAREER_EFFECT;
const on = () => gymEffectMode() === "mix";

export const LASTING_BONUS = [0, 1, 3, 5] as const;
export const MATCH_LIFT = { trained: 1, ring: 2 } as const;
export const LATE_DRAIN_CUT = [0, 0.05, 0.1, 0.15] as const;
export const RECOVERY_BOOST = [0, 0.03, 0.05, 0.08] as const;
export const INJURY_SCALE = [1, 0.92, 0.85, 0.75] as const;
/** The minute after which Resilience saves energy. */
export const LATE_MINUTE = 60;

function gymNow(c: Pick<CareerState, "gym" | "season" | "week">): GymState {
  return gymAt(gymOf(c), gapOf(c)).gym;
}
const lv = (p: number) => levelOf(p) - 1;

/** The gym's Power and Pace on top of the trained skills for the next match (0 while the flag is off). */
export function gymSkillBonus(c: Pick<CareerState, "gym" | "season" | "week">): { power: number; pace: number; lasting: { power: number; pace: number }; lift: number } {
  const none = { power: 0, pace: 0, lasting: { power: 0, pace: 0 }, lift: 0 };
  if (!on() || !c.gym) return none;
  const g = gymNow(c);
  const lasting = { power: LASTING_BONUS[lv(g.points.strength)], pace: LASTING_BONUS[lv(g.points.cardio)] };
  const now = gapOf(c);
  const ring = g.ring && g.ring.gap.season === now.season && g.ring.gap.week === now.week ? g.ring : null;
  const lift = !ring || !Object.keys(ring.done).length ? 0 : ring.closed ? MATCH_LIFT.ring : MATCH_LIFT.trained;
  return { power: lasting.power + lift, pace: lasting.pace + lift, lasting, lift };
}

/** Your Resilience level (1-4; 1 while the flag is off). */
export function resilienceLevel(c: Pick<CareerState, "gym" | "season" | "week">): number {
  if (!on() || !c.gym) return 1;
  return levelOf(gymNow(c).points.resilience);
}

/**
 * Energy given back at the final whistle: the share of what was spent after minute LATE_MINUTE that
 * Resilience saves. `spent` is the match's whole spend, `minutes` how long you were on (the spend is taken as
 * even per minute, as energy.ts drains it).
 */
export function lateEnergyBack(c: Pick<CareerState, "gym" | "season" | "week">, spent: number, minutes: number): number {
  const cut = LATE_DRAIN_CUT[resilienceLevel(c) - 1];
  if (!cut || spent <= 0 || minutes <= 0) return 0;
  // on from the start for `minutes` (a sub's late minutes are all late: he came on with fresh legs, so none)
  const late = Math.max(0, Math.min(minutes, 90) - LATE_MINUTE) / Math.min(minutes, 90);
  return spent * late * cut;
}

/** Rest days' energy times this (1 while the flag is off). */
export function recoveryScale(c: Pick<CareerState, "gym" | "season" | "week">): number {
  return 1 + RECOVERY_BOOST[resilienceLevel(c) - 1];
}

/**
 * THE INJURY HOOK: the share of the injury chance this player keeps (1 while the flag is off). Any future
 * injury system multiplies its chance by this; creditMatchResult's roll already does.
 */
export function resilienceInjuryScale(c: Pick<CareerState, "gym" | "season" | "week">): number {
  return INJURY_SCALE[resilienceLevel(c) - 1];
}
