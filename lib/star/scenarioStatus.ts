/**
 * WHERE A SCENARIO ACTUALLY IS, AND WHETHER IT IS TUNING ANYTHING.
 *
 * Three different things were being confused for each other, and the screen
 * never said which was which:
 *
 *   DRAFT      dragged but not saved. Lives in this browser's localStorage
 *              and nowhere else. Nobody else can see it, and it does NOT
 *              feed the auto-tuner.
 *   SAVED      written to Supabase. Every device sees it within seconds, no
 *              deploy. It DOES feed the auto-tuner. But it exists in exactly
 *              one database — restore an old backup and it is gone.
 *   COMMITTED  also written into the code (authoredScenarios.json) as a real
 *              git commit. Reviewable, revertible, survives anything that
 *              happens to the database, and ships inside every build.
 *
 * And a fourth state that matters because it is easy to be caught by:
 *
 *   MODIFIED   committed once, then edited and saved again. The database has
 *              the new one, the code still has the old one. Whoever builds
 *              from the code gets the stale copy until it is committed again.
 *
 * Asked for directly: "there should also be a very clear sign if something
 * has been committed or not committed, and if something is being used to
 * tune the auto tuner or not tune it."
 */

import { AUTHORED_SCENARIOS } from "./authoredScenarios";
import type { MatchScenario } from "./scenarios";

export type ScenarioState = "draft" | "saved" | "committed" | "modified";

export interface ScenarioStatus {
  state: ScenarioState;
  /** Plain English for a badge. */
  label: string;
  /** Is this in the GAME's dataset? Only a committed copy is. */
  tuning: boolean;
}

/**
 * `tuning` answers ONE question now: is this in the game?
 *
 * A saved scenario used to count, because the game read the browser's cached
 * copy of the saved list. It doesn't any more — the game plays the committed
 * dataset only, identical for every player (see authoredChance.ts's dataset
 * note) — so saved-but-not-committed is visible to the team in the dev tools
 * and not in the game until it is committed. A modified one is in the game,
 * as the OLDER committed copy.
 */
const STATUS: Record<ScenarioState, Omit<ScenarioStatus, "state">> = {
  draft: { label: "Draft — this browser only", tuning: false },
  saved: { label: "Saved — in the game once committed", tuning: false },
  committed: { label: "Committed — in the game", tuning: true },
  modified: { label: "Saved — the game still has the older copy", tuning: true },
};

/**
 * Is the committed copy the same picture as this one?
 *
 * Compared on what a scenario IS — where the ball and the players are, and
 * how it is framed — not on `updatedAt`. A re-save with no change bumps the
 * timestamp, and calling that "modified" would put a scenario in the pending
 * list that has nothing pending about it.
 */
export function samePicture(a: MatchScenario, b: MatchScenario): boolean {
  if (a.ball.x !== b.ball.x || a.ball.y !== b.ball.y) return false;
  if (a.players.length !== b.players.length) return false;
  const ca = a.camera, cb = b.camera;
  if (ca.centerX !== cb.centerX || ca.centerY !== cb.centerY
    || ca.viewHeight !== cb.viewHeight || ca.facing !== cb.facing) return false;
  // Players are written in a stable order by frameToMatchScenario, so an
  // index-wise walk is right and far cheaper than sorting both.
  for (let i = 0; i < a.players.length; i++) {
    const pa = a.players[i], pb = b.players[i];
    if (pa.id !== pb.id || pa.side !== pb.side || pa.x !== pb.x || pa.y !== pb.y) return false;
  }
  return true;
}

/** The state of one saved scenario. `null` means nothing is saved under that
 *  id at all — the caller decides whether that is a draft or just untouched. */
export function statusOf(saved: MatchScenario | null | undefined): ScenarioStatus {
  if (!saved) return { state: "draft", ...STATUS.draft };
  const committed = AUTHORED_SCENARIOS[saved.id];
  if (!committed) return { state: "saved", ...STATUS.saved };
  // The code holding a NEWER copy than the shared list is not "the game has
  // the older copy" — it is the other way round (a commit made without a
  // save). Reading it as modified told everyone the opposite of the truth,
  // and put the older copy on the Commit all list, to be written back over
  // the newer one.
  if ((committed.updatedAt ?? 0) > (saved.updatedAt ?? 0)) return { state: "committed", ...STATUS.committed };
  return samePicture(saved, committed)
    ? { state: "committed", ...STATUS.committed }
    : { state: "modified", ...STATUS.modified };
}

/**
 * Everything saved that the code does not have, or has an older copy of —
 * the list the "Commit to repo" button sends in ONE commit.
 *
 * Batching is the whole point. Vercel rebuilds production on every commit to
 * main, so committing one scenario at a time is one deploy each. Asked for
 * directly: "imagine all three of us are doing a bunch of scenarios… we did
 * 100, we've pressed Save on all of them… we commit, and it's one
 * production."
 */
export function pendingCommit(all: MatchScenario[]): MatchScenario[] {
  return all.filter((s) => {
    const st = statusOf(s).state;
    return st === "saved" || st === "modified";
  });
}

/**
 * One copy per id — the NEWEST. For merging the committed file with the
 * shared list: whichever was written last is the real picture, so a commit
 * that never reached the database still shows as what it is.
 */
export function newestById(list: MatchScenario[]): MatchScenario[] {
  const by = new Map<string, MatchScenario>();
  for (const sc of list) {
    const have = by.get(sc.id);
    if (!have || (sc.updatedAt ?? 0) >= (have.updatedAt ?? 0)) by.set(sc.id, sc);
  }
  return Array.from(by.values());
}
