/**
 * ADDED TIME (v0.15 plan item 30 — prototype).
 *
 * Harry: "Games should have added time (+1 to +5) and crazy late moments."
 * Matches used to end on the stroke of 90'. Now the fourth official's board
 * goes up with 1 to 5 minutes — 3 or 4 most often — and the clock reads
 * 90+1', 90+2'… until the whistle.
 *
 * The number is rolled once per match from its OWN seed (see
 * addedTimeSeed), never from the random stream the match runs on, so every
 * minute up to 90' plays out exactly as it did before this existed. What
 * happens IN those minutes when you are chasing the game ("Fergie time")
 * lives in hiddenMatch.ts — see its FERGIE_* constants.
 */

/** Chance of +1, +2, +3, +4, +5. */
export const ADDED_TIME_WEIGHTS = [0.1, 0.2, 0.3, 0.25, 0.15] as const;

export function rollAddedTime(rng: () => number): number {
  let r = rng();
  for (let i = 0; i < ADDED_TIME_WEIGHTS.length; i++) {
    r -= ADDED_TIME_WEIGHTS[i];
    if (r < 0) return i + 1;
  }
  return ADDED_TIME_WEIGHTS.length;
}

/** The added time's own seed, derived from the match seed but never sharing its stream. */
export function addedTimeSeed(matchSeed: number): number {
  return (Math.imul(matchSeed >>> 0, 2654435761) ^ 0x5eed90) >>> 0;
}

/**
 * How a minute reads on the clock and down the commentary.
 *
 * Unambiguous for every line whenever it is drawn: up to `regulation` it is
 * the minute; inside the added time it is "90+N"; past that it is extra
 * time, which counts on from 91 exactly as if the added minutes had not
 * happened (the real game's convention).
 */
export function minuteLabel(minute: number, added = 0, regulation = 90): string {
  if (minute <= regulation || added <= 0) return `${minute}`;
  if (minute <= regulation + added) return `${regulation}+${minute - regulation}`;
  return `${minute - added}`;
}
