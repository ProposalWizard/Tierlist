import type { CareerState } from "./types";

/**
 * REPUTATION — ONE NUMBER, 0-100.
 *
 * Rebuilt 21 Sep 2026. It used to be four separate bars (world, club,
 * government, shareholders), and two of them — club and government — were
 * read by nothing at all. The owners: "it's a lot easier for the user if
 * reputation is just one number that goes up and down."
 *
 * It answers one question: DO THE PEOPLE WHO RUN FOOTBALL TRUST YOU? That
 * is a different thing from fame (fame.ts — how many people know your
 * name). A scandal makes you MORE famous and LESS trusted; a quiet,
 * dependable club captain is trusted without being famous.
 *
 * It matters on the ownership/politics side of the game:
 *
 *   any   buy shares; the higher it is, the more votes lean your way
 *   30+   club boards take your recommendations seriously
 *   60+   you may propose Rule Book changes (influence still required)
 *   90+   you may stand for president of the FA / UEFA / FIFA / CONMEBOL
 */

export const REPUTATION_START = 20;
export const REPUTATION_RECOMMEND_MIN = 30;
export const REPUTATION_PROPOSE_RULES_MIN = 60;
export const REPUTATION_PRESIDENCY_MIN = 90;

/** Every event that moves it, in one table so the numbers can be read and
 *  argued with in one place. Signed: positive raises, negative lowers. */
export const REPUTATION_EVENTS = {
  voteHeld: 2,
  overruledVote: -5,
  recommendationAdopted: 1,
  ownedClubBeatExpectations: 3,
  ownedClubTrophyOrPromotion: 5,
  ownedClubRelegated: -4,
  personalTrophy: 2,
  cleanSeason: 1,
  goodCause: 2,
  caughtCheating: -15,
  mergedClubs: -20,
  transferRequest: -2,
} as const;

export function clampReputation(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}

/** Move reputation by `delta`, clamped. */
export function changeReputation(rep: number, delta: number): number {
  return clampReputation(rep + delta);
}

/** Same, on a whole career. */
export function withReputation(career: CareerState, delta: number): CareerState {
  return { ...career, reputation: changeReputation(career.reputation, delta) };
}

/** How strongly a vote leans your way: -1 at 0 reputation, +1 at 100. */
export function reputationVoteBias(rep: number): number {
  return (clampReputation(rep) - 50) / 50;
}

/**
 * A save from before 21 Sep 2026 stores the old four-bar object. The owners
 * agreed the new single number starts as the AVERAGE of the four.
 */
export function migrateReputation(old: unknown): number {
  if (typeof old === "number") return clampReputation(old);
  if (old && typeof old === "object") {
    const vals = ["world", "club", "government", "shareholders"]
      .map(k => (old as Record<string, unknown>)[k])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (vals.length > 0) return clampReputation(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return REPUTATION_START;
}

/** A plain-English label for the one bar. */
export function reputationLabel(rep: number): string {
  const r = clampReputation(rep);
  if (r >= REPUTATION_PRESIDENCY_MIN) return "Establishment";
  if (r >= REPUTATION_PROPOSE_RULES_MIN) return "Respected";
  if (r >= REPUTATION_RECOMMEND_MIN) return "Trusted";
  if (r >= 15) return "Unproven";
  return "Distrusted";
}
