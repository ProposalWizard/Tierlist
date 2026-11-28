/**
 * THE GYM BOARD — a record on the gym's whiteboard, and one go at beating it
 * (the story "The board", the-gym-board.json, mode "gym"). Not football, so
 * not the match engine: the gym's own mini-games (lib/star/gym/games.ts), one
 * thumb, played as they are in the gym room.
 *
 *   Which lift: the reply you gave him. "The plank. Now." is the plank,
 *   "The bench." is the bench press (the story's reply ids "go" and "bench").
 *   His record on the board, in the game's own words:
 *     plank  26 s braced (out of the 30 s hold)
 *     bench  8 reps, 6 lowered slowly
 *   You beat it with MORE: 27 s braced or better; 8 reps with 7 or 8 lowered slowly.
 *   Measured with the gym's bot thumb (tests/star/lifeModes.mts): a steady thumb
 *   beats both; a thumb that lets go too early breaks the plank at 13 s and
 *   bounces the bar.
 *
 * The result's score is 1 if your name goes on the board, else 0 (the story
 * reads `activity.score>=1`). Pure.
 */
import type { GameState, GymGameKind } from "../gym/games";

export type BoardLift = Extract<GymGameKind, "plank" | "bench">;

export const BOARD_RECORD: Record<BoardLift, { value: number; words: string; need: string }> = {
  plank: { value: 26, words: "26 s braced", need: "Brace for 27 s or more" },
  bench: { value: 14, words: "8 reps, 6 lowered slowly", need: "8 reps, 7 lowered slowly" },
};

/** The lift you picked in the talk ("bench" → bench; anything else → the plank he dared you to). */
export function boardLiftFor(replyId: string | undefined): BoardLift {
  return replyId === "bench" ? "bench" : "plank";
}

/** Your Strength level for the gym game (1-4), from your power. */
export function boardLevel(power: number | undefined): number {
  return Math.max(1, Math.min(4, 1 + Math.floor(((power ?? 50) - 40) / 15)));
}

/** Your number, in the board's units (rounded as the gym's own result line is): seconds braced, or reps + reps lowered slowly. */
export function boardValue(s: GameState): number {
  if (s.kind === "plank") return Math.round(s.braced);
  if (s.kind === "bench") return s.reps + s.clean;
  return 0;
}

/** Your number in words, as the board would write it. */
export function boardWords(s: GameState): string {
  if (s.kind === "plank") return `${Math.round(s.braced)} s braced`;
  if (s.kind === "bench") return `${s.reps} reps, ${s.clean} lowered slowly`;
  return "";
}

export function beatsBoard(lift: BoardLift, s: GameState): boolean {
  return boardValue(s) > BOARD_RECORD[lift].value;
}
