/**
 * The match runs on until it needs you (CanvasMatch's startSimulation).
 *
 * Free kicks and penalties you do not take are handed to whoever does, and the
 * match runs on again. Each of those runs reports what happened in it.
 *
 * THE BUG THIS FIXES (11 Oct 2026, seen 3 times): the loop used to replace
 * `step` with the next run and keep only the LAST run's lines. Every line from
 * the runs before a handed-over set piece was thrown away — goals included.
 * The score (the simulation's own count) still had them, so the stats screen
 * showed a goal the scoreboard (which counts goal lines) never did: "France 2-0"
 * on the board, "3-0" on the stats screen. It looked tied to being taken off
 * late only because the bot that saw it was never the set-piece taker, and a
 * player having that bad a day is the one who gets hooked.
 *
 * Now every run's lines are kept, in the order they happened.
 */
import {
  advanceUntilInvolved, resolveScenario,
  type HiddenMatchEvent, type HiddenMatchInputs, type HiddenMatchState, type ScenarioRequest,
} from "./hiddenMatch";
import type { ScenarioKind } from "./canvasEngine";

export interface StretchStep {
  events: HiddenMatchEvent[];
  request: ScenarioRequest | null;
  fullTime: boolean;
}

/** Penalty and free-kick conversion when somebody else takes it. */
export const HANDED_PEN_CONVERT = 0.76;
export const HANDED_FK_CONVERT = 0.09;

/**
 * Run the match on, handing set pieces you do not take to the taker, until a
 * chance is yours or `stretchEnd` arrives. `lead` are lines to put first (a
 * set piece already handed over before the run). Returns the final step with
 * EVERY line of the stretch in `events`, in order.
 */
export function runStretch(
  st: HiddenMatchState,
  inputs: HiddenMatchInputs,
  rng: () => number,
  stretchEnd: number,
  mayTake: (kind: ScenarioKind) => boolean,
  lead: HiddenMatchEvent[] = [],
  /** Old behaviour (the bug), for the regression test only. */
  dropEarlierRuns = false,
): StretchStep {
  const all: HiddenMatchEvent[] = [...lead];
  const handedOver: HiddenMatchEvent[] = [...lead];
  let step = advanceUntilInvolved(st, inputs, rng, stretchEnd);
  for (let guard = 0; guard < 20; guard++) {
    const kind = step.request?.kinds.length === 1 ? step.request.kinds[0] : null;
    if (!kind || mayTake(kind) || (kind !== "free_kick" && kind !== "penalty")) break;
    // v0.15 item 6: a penalty your side has won is taken LIVE by the team's
    // taker (loadScenario → loadTeammatePenalty), not handed over as a line.
    if (kind === "penalty" && step.request?.penaltyWon) break;

    all.push(...step.events);
    const label = kind === "penalty" ? "penalty" : "free kick";
    const scored = rng() < (kind === "penalty" ? HANDED_PEN_CONVERT : HANDED_FK_CONVERT);
    // resolveScenario is the one place that increments the score for a goal.
    const line: HiddenMatchEvent = scored
      ? { minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true }
      : { minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.` };
    all.push(line);
    handedOver.push(line);
    resolveScenario(st, scored ? "goal" : "saved");
    step = advanceUntilInvolved(st, inputs, rng, stretchEnd);
  }
  all.push(...step.events);
  return { ...step, events: dropEarlierRuns ? [...handedOver, ...step.events] : all };
}
