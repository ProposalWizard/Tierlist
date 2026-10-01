"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STAGE_LABEL, nextStage, recordStage, beginStage, trialScore,
  trialComplete, adversityOn, trialStagesFor,
  type TrialProgress, type TrialStage,
} from "@/lib/star/trial";
import {
  dribbleSetup, dribbleQuality, attemptSeed, teachSeen, markTeachSeen,
} from "@/lib/star/trialStages";
import { simRemaining, TRIAL_SIM_QUALITY, type TrialSimLevel } from "@/lib/star/trialDev";
import DevTrialPanel from "./DevTrialPanel";
import FirstPersonDribble from "./FirstPersonDribble";
import TrialPenalties from "./stages/TrialPenalties";
import TrialFreeKicks from "./stages/TrialFreeKicks";
import TrialTechnique from "./stages/TrialTechnique";
import TrialShootout from "./stages/TrialShootout";
import { TeachCard } from "./stages/TrialPenalties";
import type { PenaltyRunupId, FreeKickRunupId } from "@/lib/star/runupStyles";

/**
 * ── NO SCORE BETWEEN DRILLS: 3-2-1 AND ON (1 Oct 2026) ──
 *
 * Harry: "remove the section of the drill that gives them a score of 100
 * after each drill... literally go 3-2-1 drill, 3-2-1 drill, just keep it
 * moving... even if we were going to calculate that in the background, we
 * don't need it to be shown to them because the score pulls them out."
 *
 * So between stages there is a short countdown naming what is next, and then
 * the next stage simply starts. Every result is still worked out and written
 * to the career the instant it exists — the offers are decided by exactly the
 * same number — it is just never put on screen mid-trial. The scouts'
 * summary on the offers screen still shows the lot.
 */
export const COUNTDOWN_FROM = 3;
export const COUNTDOWN_STEP_MS = 700;
/** After the last stage: one line, then the offers. */
const FINAL_BEAT_MS = 1400;

/**
 * THE TRIAL, STAGE BY STAGE.
 *
 * Walks you through the stages in order, writes each result onto the
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
  /** Your penalty and free-kick run-ups (lib/star/runupStyles.ts) — looks only. */
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
}

export default function TrialSequence({
  trial, onTrial, onComplete, playerName, skills = { power: 40, technique: 40, pace: 40 }, penaltyRunup, freeKickRunup,
}: TrialSequenceProps) {
  const stage = nextStage(trial);
  const stages = trialStagesFor(trial);
  /** The stage just finished, while the 3-2-1 into the next one runs. */
  const [showingResult, setShowingResult] = useState<TrialStage | null>(null);
  const [count, setCount] = useState(COUNTDOWN_FROM);

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
    // Any half-played five-a-side is dropped once a stage is recorded. The
    // five-a-side left the trial on 1 Oct 2026, so the only snapshot that
    // can still be here is an old save's, and it would otherwise ride on the
    // career into every cloud save forever.
    const from = trial.fiveASide !== undefined ? { ...trial, fiveASide: undefined } : trial;
    const next = recordStage(from, which, quality);
    onTrial(next);
    setCount(COUNTDOWN_FROM);
    setShowingResult(which);
    if (trialComplete(next)) {
      // One line, then the offers — the summary of every stage lives there.
      window.setTimeout(() => onComplete(trialScore(next), next), FINAL_BEAT_MS);
    }
  }, [trial, onTrial, onComplete]);

  // The 3-2-1 between stages: ticks down, then walks into the next stage.
  // Nothing to press — "just keep it moving".
  const finishedAll = trialComplete(trial);
  useEffect(() => {
    if (!showingResult || finishedAll) return;
    if (count <= 0) { setShowingResult(null); return; }
    const t = window.setTimeout(() => setCount(c => c - 1), COUNTDOWN_STEP_MS);
    return () => window.clearTimeout(t);
  }, [showingResult, count, finishedAll]);

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

  /**
   * ── THE ONE DRILL THAT TAUGHT NOTHING ──
   *
   * `TEACHABLE_DRILLS` has always listed four, and only three of them ever
   * showed a card: penalties and free kicks through `StrikeStage`, finding
   * the pass through its own overlay. Taking a man on had a single 10 px grey
   * line along the bottom of the run — which is the size of thing you put a
   * reminder in, and this is a gesture that appears NOWHERE else in the
   * trial. Everything before it is a drag; this one is taps and a flick.
   *
   * So it gets the same card as the other three, with the flick glyph, and
   * remembers being dismissed under the `"dribbling"` key that was already
   * sitting there unused.
   *
   * Read from storage on mount, not in the initialiser: `window` does not
   * exist during Next's server render of this client component, and a first
   * client render that disagreed with the server's HTML is its own bug. The
   * same reasoning the other three stages' own notes give.
   */
  const [dribbleTeachDone, setDribbleTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("dribbling")) setDribbleTeachDone(true); }, []);
  const dismissDribbleTeach = useCallback(() => {
    markTeachSeen("dribbling");
    setDribbleTeachDone(true);
  }, []);

  /**
   * ── SAY WHAT WENT AGAINST YOU, ON THE STAGE IT LANDED ON ──
   *
   * Every adversity event already changes something real before this renders
   * — a better keeper, a sixth man in the wall, a second off the window — and
   * without a line saying so, a player on the wrong end of one just has a
   * stage that is inexplicably harder than the four around it. The event
   * carries its own blurb; this prints it, once, on the stage it was rolled
   * onto.
   *
   * The two flavour events are marked as flavour and say nothing about
   * difficulty, because they change nothing: a face you recognise standing by
   * the dugout is worth exactly zero to the score (`weight: 0`) and the pill
   * must not imply otherwise. They are here at all because a flavour event
   * nobody is ever shown is not flavour, it is dead data.
   */
  const event = stage ? adversityOn(trial, stage) : null;
  const eventBanner = event && (
    <div
      className={`mb-3 rounded-xl border px-3 py-2 ${
        event.flavour
          ? "border-white/15 bg-white/5"
          : "border-amber-400/30 bg-amber-500/10"
      }`}
    >
      <div
        className={`text-[10px] font-black uppercase tracking-widest ${
          event.flavour ? "text-white/50" : "text-amber-300"
        }`}
      >
        {event.flavour ? "Trial day" : "That's not ideal"} · {event.label}
      </div>
      <p className="mt-1 text-[11px] font-bold leading-snug text-white/80">{event.blurb}</p>
    </div>
  );

  const done = stages.filter(s => trial.results[s]);
  // ── ONE row, not two ──
  //
  // This used to be the pip strip plus a whole second line underneath it
  // ("Trial day" / "Stage N of 5") — 37 px of chrome saying, in words, almost
  // exactly what the five coloured pips already say in colour: how far
  // through the trial this is. Measured on an iPhone 13 alongside every other
  // header row eating into the one thing this screen is actually for (the
  // pitch): with the pips already carrying the shape of "stage N of 5" (done
  // = green, current = white, left = grey), the ordinal only needed a few
  // characters, not a whole row. It now rides the same line as the pips
  // rather than under them, and "Trial day" — branding, not information —
  // is gone outright.
  const progress = (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1">
        {stages.map(s => {
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
      <span className="shrink-0 text-[10px] font-black tabular-nums uppercase tracking-widest text-white/45">
        {stage ? `${done.length + 1}/${stages.length}` : "Done"}
      </span>
    </div>
  );

  // ── Between stages: 3-2-1 into the next one — no score on screen ──────
  if (showingResult && trial.results[showingResult]) {
    const finished = trialComplete(trial);
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {/* Deliberately no `eventBanner` here. On this card `stage` is the one
            you have not walked into yet, so printing it would announce the bad
            break before the stage it belongs to, and then print it again on
            arrival. It belongs on the stage, once. */}
        {finished ? (
          <div className="mt-10 text-center text-sm font-bold text-white/80">
            That&apos;s the lot, {playerName}. They&apos;re talking about you…
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center rounded-2xl bg-white/5 px-5 py-8 text-center" aria-live="polite">
            <div className="text-[11px] font-black uppercase tracking-widest text-white/60">Next up</div>
            <div className="mt-1 text-xl font-black uppercase tracking-wide">{stage ? STAGE_LABEL[stage] : ""}</div>
            <div key={count} className="trial-count mt-4 text-7xl font-black tabular-nums text-emerald-300">
              {Math.max(1, count)}
            </div>
            <style>{`@keyframes trialCount{0%{opacity:0;transform:scale(.55)}35%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}.trial-count{animation:trialCount ${COUNTDOWN_STEP_MS}ms cubic-bezier(.2,.9,.25,1) both}@media (prefers-reduced-motion: reduce){.trial-count{animation:none}}`}</style>
          </div>
        )}
      </div>
    );
  }

  if (!stage) return null;

  // ── Taking a man on — the existing first-person run, unmodified ────────
  if (stage === "dribbling") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {eventBanner}
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
        {/* ── `embedded` needs a box, and never had one here ──
            `FirstPersonDribble`'s embedded branch renders `absolute inset-0`
            — by design, so it fills whatever the caller already sized (in a
            real match that is CanvasMatch's own `aspect-[5/8]` wrapper). This
            call site never gave it one, so it was positioning itself against
            whatever happened to be the nearest positioned ancestor up the
            page rather than against the stage. The wrapper is the same shape
            the penalty and free-kick stages use, so all three stages are now
            the same size box. */}
        <div className="relative mx-auto aspect-[5/8] max-h-[64vh] w-full overflow-hidden rounded-xl border border-white/15">
          <FirstPersonDribble
            embedded
            seed={attemptSeed(trial)}
            pace={skills.pace}
            oppStrength={dribble.oppStrength}
            waveSizes={dribble.waveSizes}
            hideHint={!dribbleTeachDone}
            // Nobody moves while the card is up — the run used to start
            // underneath it and was over ~1.2 s after NEXT. After the card,
            // the run waits for its own "Tap to start".
            hold={!dribbleTeachDone}
            onComplete={(res: { cleared: boolean; beaten: number }) =>
              finishStage("dribbling", dribbleQuality(res, dribble))}
          />

          {!dribbleTeachDone && (
            <TeachCard
              gesture="flick"
              headline="Get past them."
              lines={[
                "Tap the left or right of the screen to touch the ball that way.",
                "Flick to burst past him — time it as he commits, not before.",
              ]}
              onDismiss={dismissDribbleTeach}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Free kicks, the gate, the shootout (and an old save's penalties) ───
  //
  // Each one reports a 0-1 mean quality for the whole stage and nothing else —
  // the difficulty scaling is `recordStage`'s job, and a screen that applied
  // it too would apply it twice (the mistake the five-a-side's own scoring
  // already had to have measured out of it).
  if (stage === "penalties") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {eventBanner}
        <TrialPenalties trial={trial} skills={skills} penaltyRunup={penaltyRunup} onDone={q => finishStage("penalties", q)} />
      </div>
    );
  }

  if (stage === "freeKicks") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {eventBanner}
        <TrialFreeKicks trial={trial} skills={skills} freeKickRunup={freeKickRunup} onDone={q => finishStage("freeKicks", q)} />
      </div>
    );
  }

  if (stage === "technique") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {eventBanner}
        <TrialTechnique trial={trial} skills={skills} onDone={q => finishStage("technique", q)} />
      </div>
    );
  }

  if (stage === "shootout") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-2 pb-2 text-white">
        {progress}
        {devPanel}
        {eventBanner}
        <TrialShootout
          trial={trial}
          skills={skills}
          playerName={playerName}
          penaltyRunup={penaltyRunup}
          onDone={q => finishStage("shootout", q)}
        />
      </div>
    );
  }

  // Every stage in TRIAL_STAGES is handled above. The two retired ones
  // (finding the pass, the five-a-side) can never be `stage`: `nextStage`
  // only walks them for a trial that already has a result for every one of
  // its five, which is a finished trial.
  return null;
}
