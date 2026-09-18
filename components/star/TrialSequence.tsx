"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TRIAL_STAGES, STAGE_LABEL, nextStage, recordStage, beginStage, trialScore,
  trialComplete, difficultyFor, keeperBonusFor,
  type TrialProgress, type TrialStage,
} from "@/lib/star/trial";
import { dribbleSetup, dribbleQuality, attemptSeed } from "@/lib/star/trialStages";
import { simRemaining, TRIAL_SIM_QUALITY, type TrialSimLevel } from "@/lib/star/trialDev";
import DevTrialPanel from "./DevTrialPanel";
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

  /**
   * ── SAY WHICH STAGE IS ACTUALLY OPEN ──
   *
   * This component is the only thing in the game that knows a stage SCREEN has
   * appeared, which is why `beginStage` asks for it here. Without the call the
   * anti-cheat cannot tell the two kinds of resume apart: walking out of a
   * half-played stage (which should cost) and a phone quietly evicting a
   * backgrounded tab while you sit on a result card (which should not).
   *
   * Marked when the stage a screen is being shown for CHANGES, not on every
   * render — `beginStage` is idempotent anyway, but an effect that fired every
   * render would write to the career on every frame of a React update.
   *
   * It deliberately does not fire while a result card is up: between stages is
   * exactly the state that is meant to be free, and marking the next stage as
   * open before you have pressed the button to walk into it would charge you
   * for closing the app on the card. And it never fights the result writes —
   * `recordStage` clears the marker itself, and the guard below means this
   * effect will not immediately re-set it, because by then `showingResult` is
   * up and `open` is null.
   */
  const open = showingResult ? null : stage;
  const markedRef = useRef<TrialStage | null>(null);
  useEffect(() => {
    if (!open || markedRef.current === open) return;
    markedRef.current = open;
    onTrial(beginStage(trial, open));
    // `trial` is deliberately not a dependency: this fires on the stage
    // changing, not on every edit to the trial it is writing to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  /**
   * ── DEV ONLY: fill every remaining stage and go straight to the offers ──
   *
   * Deliberately NOT routed through `finishStage`: that one records a single
   * stage and then shows its result card, which is the right beat for a stage
   * you actually played and the wrong one for "I never want to see the trial,
   * take me to the offers". It also skips the 1.4-second pause `finishStage`
   * holds the final card for — there is nothing to admire about a number you
   * did not earn.
   *
   * Everything else is identical to a played trial: `simRemaining` writes real
   * results through the real `recordStage`, and `onComplete` is handed the
   * real `trialScore`, so the offers screen cannot tell the difference. See
   * lib/star/trialDev.ts.
   */
  const simAll = useCallback((level: TrialSimLevel) => {
    const next = simRemaining(trial, level);
    onTrial(next);
    setShowingResult(null);
    onComplete(trialScore(next), next);
  }, [trial, onTrial, onComplete]);

  /** The dev tool, on every stage screen and on the between-stages card, so it
   *  is never more than one tap away from wherever the trial has stalled. */
  const devPanel = (
    <DevTrialPanel
      trial={trial}
      stage={stage}
      onSkipStage={level => { if (stage) finishStage(stage, TRIAL_SIM_QUALITY[level]); }}
      onSimTrial={simAll}
    />
  );

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
      {/* ── Says where you are in the TRIAL, not which stage this is ──
          Every stage screen already prints its own name and its own rep count,
          so repeating them here produced two near-identical headers stacked on
          top of each other — "PENALTIES 0/5" directly above "PENALTIES 1/5",
          the first counting stages and the second counting kicks. Spotted in a
          screenshot; the text-only playtest read both lines and never noticed
          they were the same shape. */}
      <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/45">
        <span>Trial day</span>
        <span>
          {stage ? `Stage ${done.length + 1} of ${TRIAL_STAGES.length}` : "Complete"}
        </span>
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
        {devPanel}
        <div className="rounded-2xl bg-white/5 p-5 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-white/60">
            {STAGE_LABEL[showingResult]}
          </div>
          <div className="mt-2 text-5xl font-black tabular-nums">{r.score}</div>
          <div className="mt-1 text-[11px] font-bold text-white/60">out of 100</div>
          {/* ── What this line is, now that the score is not difficulty-scaled ──
              It used to be load-bearing: the score really was `quality ×
              (0.70 + 0.60 × difficulty)`, so a 70 on a hard afternoon and a 70
              on an easy one were different performances and hiding which was
              which made the number feel arbitrary. `stageScore` is now
              `100 × quality × (0.95 + 0.05 × difficulty)` — perfect play is
              worth 95-100 whatever the day — so difficulty barely moves the
              score at all and this is no longer an explanation of it.
              It stays because it is still TRUE and still worth saying: it
              reads `TrialStageResult.difficulty`, which still stores the full
              difficulty the stage was actually played at, reload bump and all.
              It tells you what the afternoon asked of you, not how the number
              was arrived at. */}
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
        {devPanel}
        {/* `pace` is RUNNING SPEED — the run's own header says so. This used
            to be handed `skills.power`, which is a different stat and meant
            your actual pace never reached the one stage that is entirely
            about it. And `waveSizes` is passed so the men you are scored
            against are the men actually on the screen: without it the run
            picks its own waves and `dribbleQuality` divided by a number
            unrelated to them, so beating everyone could score 0.72 while
            beating three of nine scored 1.0. Both caught in review. */}
        {/* ── Seeded, like everything else in the trial ──
            `trial.ts`'s own header says it outright: "one seed on the career,
            every roll derived from it, nothing regenerated." The dribbling
            stage was the one place that was not true — with no `seed` prop the
            run falls back to `Date.now() ^ Math.random()`, so it re-rolled on
            every attempt and the file's claim was false for a fifth of the
            trial.
            `attemptSeed` rather than `trial.seed` for the same reason as the
            vision and penalty stages: the run is reproducible while you are
            playing it, and a resume genuinely gets new waves at the bumped
            difficulty rather than a replay of the run you just watched. */}
        <FirstPersonDribble
          embedded
          seed={attemptSeed(trial)}
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
        {devPanel}
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
        {devPanel}
        <TrialPenalties trial={trial} skills={skills} onDone={q => finishStage("penalties", q)} />
      </div>
    );
  }

  if (stage === "freeKicks") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        {devPanel}
        <TrialFreeKicks trial={trial} skills={skills} onDone={q => finishStage("freeKicks", q)} />
      </div>
    );
  }

  if (stage === "vision") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4 text-white">
        {progress}
        {devPanel}
        <TrialVision trial={trial} onDone={q => finishStage("vision", q)} />
      </div>
    );
  }

  // Every stage in TRIAL_STAGES is handled above; this is the unreachable
  // arm that keeps the switch honest if a sixth is ever added.
  return null;
}
