"use client";
import { useCallback, useMemo, useState } from "react";
import {
  TRIAL_STAGES, STAGE_LABEL, nextStage, recordStage, trialScore, trialComplete,
  difficultyFor, keeperBonusFor, type TrialProgress, type TrialStage,
} from "@/lib/star/trial";
import { dribbleSetup, dribbleQuality } from "@/lib/star/trialStages";
import FiveASide from "./FiveASide";
import FirstPersonDribble from "./FirstPersonDribble";
import TrialPenalties from "./stages/TrialPenalties";
import TrialFreeKicks from "./stages/TrialFreeKicks";
import TrialVision from "./stages/TrialVision";
import { stageQualityFrom, type FiveASideSummary } from "@/lib/star/fiveASide/score";
import type { FiveMatchState } from "@/lib/star/fiveASide/match";

/**
 * THE TRIAL, STAGE BY STAGE.
 *
 * Walks you through the five stages in order, writes each result onto the
 * career THE INSTANT it is decided, and hands the final number to whatever
 * decides who signs you.
 *
 * ── The rule this whole screen is shaped by ──
 *
 * Decided directly, and it is why there is no "are you sure" anywhere here:
 *
 *   "The more important thing from a refresh is that they don't lose progress.
 *    If people want to cheat we shouldn't necessarily stop them, but it should
 *    be difficult."
 *
 * So: nothing is held in this component that matters. A stage's result goes to
 * the career as soon as it exists, which means closing the app between stages
 * costs nothing, and closing it MID-stage costs you that stage's attempts and
 * nothing else. There is no lockout — re-opening simply makes what is left
 * quietly harder, which `difficultyFor` handles and this screen never mentions.
 */

export interface TrialSequenceProps {
  trial: TrialProgress;
  /** Every change to the trial, immediately — the caller saves it. */
  onTrial: (trial: TrialProgress) => void;
  /** The whole trial is done, here is what the scouts saw (0-100). */
  onComplete: (score: number, trial: TrialProgress) => void;
  playerName: string;
  /** Pace is here because the dribbling stage is entirely about it — see the
   *  note at its call site. */
  skills?: { power: number; technique: number; pace: number };
}

export default function TrialSequence({
  trial, onTrial, onComplete, playerName, skills = { power: 40, technique: 40, pace: 40 },
}: TrialSequenceProps) {
  const stage = nextStage(trial);
  const [showingResult, setShowingResult] = useState<TrialStage | null>(null);

  /** One stage is over. Record it, show what it was worth, move on. */
  const finishStage = useCallback((which: TrialStage, quality: number) => {
    // The half-played five-a-side is dropped once the stage is over. It only
    // ever existed so closing the app mid-match did not lose it; kept, it
    // rides on the career into every cloud save forever, and the last
    // passage's snapshot is stale anyway (this runs in the same tick as the
    // one that wrote it).
    const from = which === "fiveASide" ? { ...trial, fiveASide: undefined } : trial;
    const next = recordStage(from, which, quality);
    onTrial(next);
    setShowingResult(which);
    if (trialComplete(next)) {
      // Shown for a beat first — the number is the whole point of the day.
      window.setTimeout(() => onComplete(trialScore(next), next), 1400);
    }
  }, [trial, onTrial, onComplete]);

  const dribble = useMemo(() => dribbleSetup(trial), [trial]);

  const done = TRIAL_STAGES.filter(s => trial.results[s]);
  const progress = (
    <div className="mb-3">
      <div className="flex items-center gap-1">
        {TRIAL_STAGES.map(s => {
          const r = trial.results[s];
          const current = s === stage;
          return (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                r ? "bg-emerald-400" : current ? "bg-white/70" : "bg-white/15"
              }`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
        <span>{stage ? STAGE_LABEL[stage] : "Trial complete"}</span>
        <span>{done.length} / {TRIAL_STAGES.length}</span>
      </div>
    </div>
  );

  // ── Between stages: what that one was worth ────────────────────────────
  if (showingResult && trial.results[showingResult]) {
    const r = trial.results[showingResult]!;
    const finished = trialComplete(trial);
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6 text-white">
        {progress}
        <div className="rounded-2xl bg-white/5 p-5 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-white/60">
            {STAGE_LABEL[showingResult]}
          </div>
          <div className="mt-2 text-5xl font-black tabular-nums">{r.score}</div>
          <div className="mt-1 text-[11px] font-bold text-white/60">out of 100</div>
          {/* Difficulty is shown because the whole scoring rule is "relative to
              what was asked" — a 70 against a hard afternoon means more than a
              70 against an easy one, and hiding that makes the number feel
              arbitrary. */}
          <div className="mt-3 text-[11px] font-bold text-white/50">
            {r.difficulty > 0.66 ? "They made that hard."
              : r.difficulty > 0.33 ? "A fair test."
              : "They went easy on you."}
          </div>
        </div>
        {finished ? (
          <div className="mt-5 text-center text-sm font-bold text-white/70">
            That&apos;s the lot, {playerName}. They&apos;re talking about you…
          </div>
        ) : (
          <button
            onClick={() => setShowingResult(null)}
            className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
          >
            Next: {stage ? STAGE_LABEL[stage] : ""} →
          </button>
        )}
      </div>
    );
  }

  if (!stage) return null;

  // ── Taking a man on — the existing first-person run, unmodified ────────
  if (stage === "dribbling") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        {/* `pace` is RUNNING SPEED — the run's own header says so. This used
            to be handed `skills.power`, which is a different stat and meant
            your actual pace never reached the one stage that is entirely
            about it. And `waveSizes` is passed so the men you are scored
            against are the men actually on the screen: without it the run
            picks its own waves and `dribbleQuality` divided by a number
            unrelated to them, so beating everyone could score 0.72 while
            beating three of nine scored 1.0. Both caught in review. */}
        <FirstPersonDribble
          embedded
          pace={skills.pace}
          oppStrength={dribble.oppStrength}
          waveSizes={dribble.waveSizes}
          onComplete={(res: { cleared: boolean; beaten: number }) =>
            finishStage("dribbling", dribbleQuality(res, dribble))}
        />
      </div>
    );
  }

  // ── The five-a-side ────────────────────────────────────────────────────
  if (stage === "fiveASide") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        {/* THEIR keeper carries the adversity, not yours — passing it as
            `keeperStrength` made a sharp keeper defend YOUR goal, so a player
            who drew the bad break was helped by it. Caught in review. */}
        <FiveASide
          embedded
          seed={trial.seed}
          difficulty={difficultyFor(trial, "fiveASide")}
          oppKeeperStrength={40 + difficultyFor(trial, "fiveASide") * 45 + keeperBonusFor(trial, "fiveASide")}
          keeperStrength={55}
          skills={skills}
          resumeFrom={(trial.fiveASide as FiveMatchState | undefined) ?? null}
          onProgress={state => onTrial({ ...trial, fiveASide: state })}
          onComplete={(_summary: FiveASideSummary, state: FiveMatchState) => {
            // `stageQualityFrom` IS the unscaled quality — the trial applies
            // its own difficulty scaling and applying it twice would punish a
            // hard trial twice over. This used to divide the rounded, clamped
            // score back out by the same factor, which is exactly the mistake
            // score.ts's own note describes and is lossy by up to a point.
            finishStage("fiveASide", stageQualityFrom(state));
          }}
        />
      </div>
    );
  }

  // ── Penalties, free kicks, finding the pass ────────────────────────────
  //
  // Each one reports a 0-1 mean quality for the whole stage and nothing else —
  // the difficulty scaling is `recordStage`'s job, and a screen that applied
  // it too would apply it twice (the mistake the five-a-side's own scoring
  // already had to have measured out of it).
  if (stage === "penalties") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        <TrialPenalties trial={trial} skills={skills} onDone={q => finishStage("penalties", q)} />
      </div>
    );
  }

  if (stage === "freeKicks") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        <TrialFreeKicks trial={trial} skills={skills} onDone={q => finishStage("freeKicks", q)} />
      </div>
    );
  }

  if (stage === "vision") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        <TrialVision trial={trial} onDone={q => finishStage("vision", q)} />
      </div>
    );
  }

  // Every stage in TRIAL_STAGES is handled above; this is the unreachable
  // arm that keeps the switch honest if a sixth is ever added.
  return null;
}
