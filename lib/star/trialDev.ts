import {
  TRIAL_STAGES, recordStage, trialScore, nextStage,
  type TrialProgress, type TrialStage,
} from "./trial";

/**
 * SIMULATING A TRIAL, FOR TESTING ONLY.
 *
 * Requested directly, and the reason is worth keeping in the file because it
 * is the whole spec:
 *
 *   "Just for this part of development — give us a skip to each, or like a sim
 *    each part of the trial button and sim full trial button, so that we can
 *    just test every feature without having to play the full entire trial,
 *    because right now it's stupidly long."
 *
 * The trial is five stages on the live match engine and it is the ONLY way
 * into the scout offers, the signing, the trial reward and the free-agent
 * life. So every one of those downstream screens currently costs a full
 * playthrough to reach once, and a second playthrough to reach at a different
 * score — which is the actual cost being complained about.
 *
 * ── Nothing here is a second scoring model ──
 *
 * These functions decide ONE number: the 0-1 quality a stage is handed. Every
 * other part of a result — the difficulty it was played at, the 0-100 score,
 * whether the trial is over — is `recordStage`'s, untouched, exactly as it is
 * for a stage somebody actually played. (It used to say "the reload haircut"
 * here too; there is no longer such a thing — a resume now costs difficulty
 * rather than score. See `RELOAD_GRACE`.) A simmed
 * trial is therefore a real `TrialProgress` full of real `TrialStageResult`s,
 * and everything downstream (the offers, the free-agent branch, the reward
 * screen) behaves exactly as it would normally. That is deliberate: a dev tool
 * that produced a slightly different shape of result would test the tool
 * rather than the game.
 *
 * ── Obviously synthetic, on purpose ──
 *
 * A level is a FLAT quality across every stage it fills. So a simmed trial
 * reads as five near-identical stage scores — 24, 24, 25, 24, 24 — which no
 * real afternoon ever looks like. They are not perfectly identical only
 * because `stageScore` still prices each stage against its own difficulty
 * roll, which is the honest thing for it to keep doing. No jitter is added on
 * top: a dev tool should be predictable, and "what score will this give me"
 * should be answerable before pressing the button (`simScore` answers it).
 */

export type TrialSimLevel = "poor" | "average" | "great";

/** In the order the toggle shows them: worst to best. */
export const TRIAL_SIM_LEVELS: TrialSimLevel[] = ["poor", "average", "great"];

/**
 * What each level plays like, 0-1.
 *
 * Chosen to land on three genuinely DIFFERENT downstream outcomes rather than
 * three points on a line, because reaching different outcomes cheaply is the
 * entire point of the tool:
 *
 *  - `poor` scores around 24, under `NO_INTEREST_BELOW` (30, scoutOffers.ts).
 *    Nobody signs you — the free-agent life, which is otherwise the hardest
 *    state in the game to reach deliberately.
 *  - `average` scores around 58: somewhere on the middle of the ladder, and
 *    on the part of the curve where whether anybody comes at all is a real
 *    roll rather than a certainty.
 *  - `great` scores around 94, up where the Premier League's own appetite
 *    peaks (96).
 */
export const TRIAL_SIM_QUALITY: Record<TrialSimLevel, number> = {
  poor: 0.25,
  average: 0.60,
  great: 0.97,
};

export const TRIAL_SIM_LABEL: Record<TrialSimLevel, string> = {
  poor: "Poor",
  average: "Average",
  great: "Great",
};

/**
 * Record one stage as if it had been played at `level`.
 *
 * `recordStage` is idempotent, so simming a stage that already has a result
 * returns the trial untouched — the same protection a double-fired callback
 * gets, and it means a mis-tap here can never overwrite something genuinely
 * played.
 *
 * The half-played five-a-side is dropped when the five-a-side is the stage
 * being filled, for exactly the reason `TrialSequence.finishStage` drops it:
 * kept, a stale snapshot rides on the career into every cloud save forever.
 */
export function simStage(
  trial: TrialProgress, stage: TrialStage, level: TrialSimLevel,
): TrialProgress {
  const from = stage === "fiveASide" ? { ...trial, fiveASide: undefined } : trial;
  return recordStage(from, stage, TRIAL_SIM_QUALITY[level]);
}

/**
 * Fill every stage that has no result yet, in order, and hand back the
 * finished trial.
 *
 * Stages already played are left exactly as they are — simming the rest of a
 * trial you are three stages into is the normal way to use this, not an edge
 * case.
 */
export function simRemaining(trial: TrialProgress, level: TrialSimLevel): TrialProgress {
  let out = trial;
  for (const stage of TRIAL_STAGES) {
    if (out.results[stage]) continue;
    out = simStage(out, stage, level);
  }
  return out;
}

/**
 * What the whole trial would come out at if the rest of it were simmed at
 * `level` — so the panel can print the number BEFORE the button is pressed.
 *
 * Runs the real thing and reads the real `trialScore` off it rather than
 * estimating, so the preview can never drift from what the button does.
 */
export function simScore(trial: TrialProgress, level: TrialSimLevel): number {
  return trialScore(simRemaining(trial, level));
}

/** The stage a "skip this one" would fill, or null when the trial is over. */
export function stageToSkip(trial: TrialProgress): TrialStage | null {
  return nextStage(trial);
}
