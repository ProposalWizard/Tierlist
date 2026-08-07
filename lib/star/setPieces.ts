import type { CareerState } from "./types";
import type { KickSkills } from "./canvasEngine";
import type { Selection } from "./selection";

/**
 * SET-PIECE DUTY
 *
 * `skills.freeKick` was trainable, had an achievement for maxing it, appeared in
 * the skills screen and on the dashboard — and was read by no code anywhere. Free
 * kicks and penalties arrived whether or not you would plausibly be the one
 * taking them, and when they did they were struck with your general technique.
 *
 * Duty is now earned, and it is earned RELATIVE TO THE CLUB. A free kick at a
 * mid-table side is yours much earlier than a free kick at the champions, who
 * already have someone who can hit them — which makes a move up the league cost
 * you something as well as paying you, and gives the skill a reason to keep
 * being trained after you have taken over at a small club.
 */

export interface SetPieceDuties {
  freeKicks: boolean;
  penalties: boolean;
  /** What it would take to take the ones you are not on, for the skills screen. */
  freeKickNeeded: number;
  penaltyNeeded: number;
}

/** Reputation counts as well as technique — a star gets handed the ball. */
function effectiveTaker(career: CareerState): number {
  return career.skills.freeKick + career.starRating * 4;
}

function clubStrength(career: CareerState): number {
  return career.league.find(t => t.name === career.player.club)?.strength ?? 70;
}

export function setPieceDuties(career: CareerState, status: Selection = career.status): SetPieceDuties {
  const s = clubStrength(career);
  const freeKickNeeded = Math.max(30, Math.min(88, s - 12));
  const penaltyNeeded = Math.max(25, Math.min(80, s - 20));
  // You have to be on the pitch. A substitute can absolutely take a penalty.
  const onThePitch = status !== "Squad";
  const eff = effectiveTaker(career);
  return {
    freeKicks: onThePitch && eff >= freeKickNeeded,
    penalties: onThePitch && eff >= penaltyNeeded,
    freeKickNeeded,
    penaltyNeeded,
  };
}

/**
 * What you strike a dead ball with.
 *
 * A set piece is a different skill from open play — it is struck standing still,
 * with time, and it is the one strike in football that is purely technique and
 * curl. So the free-kick rating carries most of it, with general technique still
 * counting for something.
 */
export function setPieceSkills(skills: KickSkills, freeKick: number, kind: string): KickSkills {
  if (kind !== "free_kick" && kind !== "penalty") return skills;
  return {
    power: skills.power,
    technique: Math.round(skills.technique * 0.4 + freeKick * 0.6),
  };
}
