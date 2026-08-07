import type { CareerState } from "./types";

/**
 * TEAM SELECTION
 *
 * `career.status` was set to "1st Team" when the career was created and never
 * touched again. Boss, team and fans moved after every match and fed nothing but
 * achievement checks and dilemma eligibility — you could be on 3 out of 100 with
 * the manager and still start every week.
 *
 * The manager now picks the side. A run of poor ratings and a manager who has
 * lost patience puts you on the bench, and then out of the squad; from there you
 * win your place back, which is the loop those numbers existed for all along.
 *
 * Two things stop it becoming a death spiral, both deliberate:
 *  - a week out of the side softens the manager (his expectations reset), so
 *    being dropped is recoverable without playing;
 *  - the bench is the middle rung, not the floor, so a bad month costs you
 *    minutes before it costs you the squad.
 */

export type Selection = CareerState["status"];

export interface SelectionVerdict {
  status: Selection;
  /** Minute you come on. 0 when you start; 90 when you do not play at all. */
  onAt: number;
  /** The manager's reasoning, shown to the player. */
  reason: string;
  /** 0-100, the standing the decision came from. Shown so it never feels arbitrary. */
  standing: number;
}

/** A player with no recent games is judged on a neutral performance, not a bad one. */
const NEUTRAL_FORM = 6.5;
/** How many games the manager judges you on. */
const FORM_WINDOW = 5;

/**
 * Recent form, over a FIXED five-game window padded with neutral performances.
 *
 * Averaging only the games actually played let a single bad match swing the
 * whole judgement — one 4.2 in your first week benched you, which is not how
 * anybody picks a side. Padding means one poor game moves you a fifth of the
 * way, and it takes a genuine run to cost you your place.
 */
function recentForm(form: number[]): number {
  const recent = form.slice(0, FORM_WINDOW);
  const sum = recent.reduce((s, r) => s + r, 0) + NEUTRAL_FORM * (FORM_WINDOW - recent.length);
  return sum / FORM_WINDOW;
}

const START_AT = 55;    // standing needed to be in the starting eleven
const BENCH_AT = 34;    // …and to make the bench at all

export function selectionStanding(career: CareerState): number {
  const form = recentForm(career.form);
  return Math.max(0, Math.min(100,
    career.relationships.boss * 0.45
    + (form / 10) * 100 * 0.30
    + (career.starRating / 5) * 100 * 0.15
    + career.matchFitness * 0.10,
  ));
}

/**
 * Who the manager picks this week.
 *
 * Deterministic in everything except the minute a substitute comes on, which is
 * seeded off the week so it does not change under a re-render.
 */
export function selectionFor(career: CareerState): SelectionVerdict {
  const standing = selectionStanding(career);
  const form = recentForm(career.form);

  if (standing >= START_AT) {
    return {
      status: "1st Team",
      onAt: 0,
      standing,
      reason: standing >= 78
        ? "First name on the team sheet."
        : "You start.",
    };
  }

  if (standing >= BENCH_AT) {
    // Somewhere in the last half hour. Seeded off the week so it is stable.
    const onAt = 58 + ((career.week * 37 + career.season * 11) % 15);
    return {
      status: "Substitute",
      onAt,
      standing,
      reason: career.relationships.boss < 40
        ? "The manager has left you out. You are on the bench."
        : `Form has dipped (${form.toFixed(1)} avg). You start on the bench.`,
    };
  }

  return {
    status: "Squad",
    onAt: 90,
    standing,
    reason: career.relationships.boss < 30
      ? "You are not in the squad. The manager has made his feelings clear."
      : "You are not in the squad this week.",
  };
}

/**
 * A week spent not playing.
 *
 * You lose sharpness and you are paid, and the manager softens a little —
 * without that last part a bad run could put you somewhere you could never
 * climb out of, because the only thing that raises the boss relationship
 * quickly is playing well.
 */
export const MISSED_WEEK = {
  matchFitness: -7,
  energy: +25,
  boss: +3,
} as const;
