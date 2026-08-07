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

/**
 * BEING TAKEN OFF
 *
 * The other half of the manager picking the side, and the half that was
 * completely absent: your rating and your legs decided nothing about how long
 * you stayed on the pitch. You played every minute of every match you started,
 * however badly it was going and however empty you were.
 *
 * Three reasons a manager takes a player off, and this models all three,
 * including the flattering one — being rested with the game won is not a
 * punishment and should not read as one.
 */
export type HookReason = "form" | "legs" | "rested";

export interface HookDecision {
  hooked: boolean;
  reason: HookReason | null;
  message: string;
}

/** Nobody is hooked before the hour, or within a quarter of an hour of coming on. */
const HOOK_EARLIEST = 60;
const HOOK_SETTLE_IN = 15;

export function hookCheck(args: {
  minute: number;
  startMinute: number;
  liveRating: number;
  energy: number;
  /** Your goals minus theirs. */
  scoreDiff: number;
  rng: () => number;
}): HookDecision {
  const none: HookDecision = { hooked: false, reason: null, message: "" };
  if (args.minute < HOOK_EARLIEST) return none;
  if (args.minute - args.startMinute < HOOK_SETTLE_IN) return none;

  // Later is likelier, in all three cases — a manager who was going to change it
  // has more reason to as the clock runs down.
  const late = Math.max(0, Math.min(1, (args.minute - HOOK_EARLIEST) / 30));

  // Empty legs. The steepest of the three, because it is the one the player can
  // see coming in the bar on the HUD and could have managed during the week.
  if (args.energy < 28) {
    const p = (0.16 + late * 0.3) * (1 - args.energy / 28);
    if (args.rng() < p) {
      return { hooked: true, reason: "legs", message: "You are out on your feet — the manager takes you off." };
    }
  }

  // A bad afternoon.
  //
  // The threshold is 6.05 rather than the 5.6 that reads like a poor mark,
  // because of where the rating formula actually LIVES: it starts at 6.0 and the
  // only thing that can pull it down is a defeat, worth 0.3. A contributionless
  // game while losing bottoms out at 5.7, so a 5.6 threshold could never once
  // have fired. Six flat means you have done nothing all afternoon, which is
  // exactly the game a manager changes.
  if (args.liveRating < 6.05) {
    const p = (0.1 + late * 0.22) * Math.min(1, (6.05 - args.liveRating) / 0.4);
    if (args.rng() < p) {
      return { hooked: true, reason: "form", message: "Your number is up. You are replaced." };
    }
  }

  // Game won, legs saved for the next one. A compliment, not a hook.
  if (args.scoreDiff >= 3 && args.minute >= 72) {
    if (args.rng() < 0.14 + late * 0.2) {
      return { hooked: true, reason: "rested", message: "Job done — you get a standing ovation as you come off." };
    }
  }

  return none;
}
