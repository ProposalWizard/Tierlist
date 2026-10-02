"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Outcome, Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX } from "@/lib/star/pitch";
import {
  REPS, penaltySetup, penaltyRampFor, trialInvisibleStats,
  strikeQuality, teachSeen, markTeachSeen, type TeachableDrill,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import { buildScenario, initDefenders } from "@/lib/star/canvasEngine";
import { EngineFeature } from "@/components/star/EnginePlay";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import type { PenaltyReadSettings } from "@/lib/star/penaltyKeeper";
import type { PenaltyRunupId, FreeKickRunupId } from "@/lib/star/runupStyles";
import type { ScenePicture } from "@/lib/star/scenePicture";

/**
 * THE PENALTIES STAGE — and the striking stage the FREE KICKS stage runs on.
 *
 * ── On the real match since 24 Sep 2026 ──
 *
 * This file used to carry its own copy of the match: its own loop, camera,
 * keeper, ball and drag. An audit found twelve ways that copy had drifted from
 * the real match — a keeper who stood off-centre and dived at the strike, a
 * ball drawn at half its height, the ball always painted over the keeper, a
 * softer power floor, no set-piece rating — which is why the trial "felt like
 * a different game". Harry: "the main thing is the keeper's base function
 * works the same and the kicking/features work the same."
 *
 * So the pitch in the middle of this screen IS the real match now, mounted
 * through `EngineFeature` (EnginePlay.tsx), one attempt at a time. What stays
 * here is only what makes it a trial: the reps, the tutorial card, the score
 * for each attempt (read off the engine's own result via `onChanceResolved`),
 * the pips, and the trial's one dial inside the engine — how well its keeper
 * reads your penalty (`penaltyRead`, trialStages.ts). Anything else a trial
 * wants is built AROUND the engine, never inside a copy of it.
 */



/**
 * HOW LONG THE TAKER'S FIGURE HOLDS A KICKING POSE AFTER THE BALL IS STRUCK.
 *
 * The same real bug as `AIM_ARROW_LENGTH` above, one level deeper: reported
 * directly — "it seems like youve completely recreated and copied and made
 * an entirely different game" — and one measured piece of that was that only
 * `CanvasMatch.tsx` ever animated a figure at all; every taker on this screen
 * stood in the same still, idle stance whether he was lining up the shot or
 * had just struck it.
 *
 * Pinned to CanvasMatch.tsx's own `KICK_POSE_S`, not re-derived, for the same
 * reason the arrow length is pinned rather than guessed: the swing has to be
 * the match's swing. That file counts this DOWN from a ref reset at the
 * moment of contact; this screen already has `flightTRef`, which counts UP
 * from zero at the identical moment (see `handleContact`) and only while the
 * ball is actually in flight — so the equivalent check here is
 * `flightTRef.current < KICK_POSE_S`, not `> 0`.
 */
export const KICK_POSE_S = 0.28;

/**
 * Whether the taker's figure should be drawn mid-kick right now — pure and
 * exported so the decision can be tested without a canvas, the same split
 * this file's own opening comment draws between what a test can and cannot
 * reach. `flightT` is `undefined` before a kick has actually happened this
 * rep (see `draw()`'s own `struck` gate) — never a number that happens to be
 * small, so "just lined up" can never be misread as "just struck".
 */
export function isTakerKicking(flightT: number | undefined): boolean {
  return flightT !== undefined && flightT < KICK_POSE_S;
}

/** What to say about an attempt once it has resolved. Never "failed" — a
 *  trial stage is a mean of several attempts, and a stage that scolds you
 *  four times out of five reads as broken rather than as hard. */
/** What to say about an attempt once it has resolved. Never "failed" — a
 *  trial stage is a mean of several attempts, and a stage that scolds you
 *  four times out of five reads as broken rather than as hard. */
export const OUTCOME_LINE: Partial<Record<Outcome, string>> = {
  goal: "Scored!",
  rebound: "In off the rebound!",
  saved: "Saved.",
  tipped: "Tipped away.",
  caught: "Caught.",
  wide: "Wide.",
  over: "Over the bar.",
  post: "Off the post!",
  short: "Not enough on it.",
  blocked: "Into the wall.",
  tackled: "Charged down.",
  offside: "Flag up.",
  delivered: "Cleared.",
};

// ── The generic striking stage ─────────────────────────────────────────────

export interface StrikeStageProps {
  /** How many attempts. */
  reps: number;
  /** Build the scenario for one rep: the ball's spot, the keeper, the wall,
   *  the camera. The engine plays exactly this picture. */
  build: (rep: number, rng: () => number) => Scenario;
  /** The player's power and technique. */
  skills: { power: number; technique: number };
  /** Seeds each rep, so the same attempt is the same attempt however many
   *  times the app is closed and re-opened (see trial.ts). */
  seed: number;
  title: string;
  hint: string;
  /** Extra line under the rep counter. */
  subtitle?: (rep: number) => string;
  /** The instruction on the FIRST rep of the stage — see `TeachCard`. */
  teach?: { headline: string; lines: string[]; short?: string };
  /** Which drill this is, for remembering that its teaching was dismissed. */
  drill: TeachableDrill;
  /** How good this rep's keeper is — handed to the engine. */
  keeperStrengthFor?: (rep: number) => number;
  /** The trial's one dial inside the engine: how well its keeper reads a
   *  penalty. Absent: the real match's own keeper. */
  penaltyRead?: Partial<PenaltyReadSettings>;
  /** The same dial, rep by rep (the v0.15 ramp) — wins over `penaltyRead`. */
  penaltyReadFor?: (rep: number) => Partial<PenaltyReadSettings>;
  onDone: (quality: number) => void;
  /** Force the one-row teaching card (a drill where the ball sits low). */
  forceCompactTeach?: boolean;
  /** Your penalty and free-kick run-ups (lib/star/runupStyles.ts) — looks only. */
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  /**
   * ── For a stage that is not a shot at goal (the gate, 1 Oct 2026) ──
   *
   * What is on the pitch (the gate has no keeper and no goal), the cones for
   * this rep, a watch on the ball, and how an attempt is marked. All optional:
   * absent, the stage is the penalty/free-kick stage it has always been.
   */
  scene?: ScenePicture;
  markersFor?: (rep: number) => { x: number; y: number; color?: string }[];
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  /** Marks one attempt: its 0-1 quality and the line shown under the pitch.
   *  The stage's quality is then the mean of these. */
  judge?: (info: ChanceResolved) => { quality: number; text: string };
  /**
   * ── Two more pop-ups, each at its own moment (Harry, 2 Oct 2026) ──
   *
   * "As soon as he's running up, we should pause the animation and it should
   * say, you run up to take free kicks. As you hit the ball, you'll be met
   * with a timed animation. And then when the time the animation comes, you
   * give them another little pop-up." Each one freezes the match where it is
   * (CanvasMatch `holdAt`) until it is closed, and each is shown once per
   * device, like the first card.
   */
  pauseTeach?: Partial<Record<"runup" | "contact", {
    drill: TeachableDrill; headline: string; lines: string[]; gesture?: TeachGesture; place?: "middle" | "top";
  }>>;
}


/**
 * ── THE FIRST REP TEACHES, AND IT STILL COUNTS ──
 *
 * Decided directly: "I do think the first rep of each drill should count
 * towards your score, even though it's tutorial… Just give them a second to
 * understand what's happening." So this is not a practice go and nothing
 * anywhere treats it as one — rep 1 is scored by exactly the same
 * `strikeQuality` as every other rep and carries the lightest weight in
 * `REP_WEIGHT_RAMP` only because it is the EASIEST rep, never because it is
 * the tutorial one.
 *
 * What changes is what you are told before you take it. The stage's own hint
 * was an 11px grey line in a black pill along the bottom edge, which is the
 * size of thing you put a reminder in, not the size of thing you teach a
 * gesture with — and this is the first ball anybody in this game ever kicks.
 * They asked for "a proper graphic", so: a real card, the drag drawn rather
 * than described, and the stage's own instruction underneath it.
 *
 * ── IT MUST NOT COVER THE BALL IT IS TALKING ABOUT ──
 *
 * Reported as "boxing on the penalties", and measured: the card was an
 * `absolute inset-0` overlay whose panel covered roughly the bottom 45 % of
 * the play area, with its top edge at about 50 % of the canvas and the
 * penalty spot at 59 % — so it sat directly on top of the ball you are being
 * told to drag back from, on the first ball anybody in this game ever kicks.
 *
 * It is now pinned to the bottom strip and kept short: the drawn gesture is a
 * 24 px glyph on the badge row rather than a 56 px block beside the text, the
 * copy is tightened, and the wrapper only spans the bottom edge instead of
 * the whole canvas. That is the same strip the ordinary hint already lives in
 * and is documented as safe — full power only ever needs `dragForFullPower`
 * (about 14 %) of the canvas height behind the ball.
 *
 * Pointer-transparent throughout, EXCEPT the one button on it. It sits over
 * the canvas and the canvas owns every pointer event on this screen; a card
 * that swallowed the first drag would teach the gesture and then refuse it.
 * The dismiss button re-enables pointers on itself alone (`pointer-events-auto`
 * on a child of a `pointer-events-none` parent), so the small area it occupies
 * is the only part of the canvas a drag cannot BEGIN in. That is safe here
 * because a drag begins at the ball, which is well above this card, and a
 * pointer already captured by the canvas keeps moving over the button without
 * it ever seeing the gesture — the button can only ever take a fresh press.
 *
 * ── SUPERSEDED (2 Oct 2026): the box is in the middle and play waits ──
 *
 * Harry played it and wanted the opposite trade: a box near where you look,
 * that you close with one tap before you play. So the card no longer sits on
 * the bottom strip and no longer lets a drag through — see the wrapper at the
 * end of `TeachCard`. The notes above are why it once sat at the bottom.
 *
 * ── Dismissing it is teaching only ──
 *
 * "You should be able to get rid of the little tutorial." What goes is the
 * card: the headline, the drawn gesture, the instruction. What does NOT go is
 * anything live — the rep counter, the subtitle telling you how much of the
 * keeper's guess there is to read, the hint line, the score pips. The card is
 * replaced by the ordinary hint the other reps already show, so dismissing it
 * leaves the screen in the state rep 2 is in rather than in a state nothing
 * else in the game produces.
 */
export type TeachGesture = "drag" | "tap" | "flick" | "strike" | "run";

/**
 * The gesture, drawn. The one thing a sentence is worst at describing, and
 * the reason these cards exist at all rather than a longer hint line.
 *
 * One per gesture the trial actually asks for, because a drag arrow on the
 * stage you tap is a wrong instruction rather than a missing one:
 *
 *   drag  — a ball, the thumb pulled back off it, the arrow showing where it
 *           goes. Penalties and free kicks.
 *   tap   — a finger on a man, with the ring a tap makes. Finding the pass.
 *   flick — a finger on the ball and a quick swipe past. Taking a man on.
 */
function TeachGlyph({ gesture, compact }: { gesture: TeachGesture; compact: boolean }) {
  const cls = compact ? "h-5 w-6 shrink-0" : "h-6 w-8 shrink-0";
  if (gesture === "tap") {
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <circle cx="30" cy="24" r="13" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="30" cy="24" r="6.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M44 38 L52 30 L58 42 Z" fill="#f97316" />
      </svg>
    );
  }
  if (gesture === "strike") {
    // The strike screen: a big ball, the countdown ring round it, a tap on its side.
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <circle cx="30" cy="24" r="17" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="80 30" />
        <circle cx="30" cy="24" r="12" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="38" cy="26" r="3.2" fill="#f97316" />
      </svg>
    );
  }
  if (gesture === "run") {
    // You, jogging in to the ball.
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <line x1="8" y1="40" x2="40" y2="30" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
        <circle cx="10" cy="40" r="5" fill="#0ea5e9" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="48" cy="28" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
      </svg>
    );
  }
  if (gesture === "flick") {
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <circle cx="18" cy="30" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <line x1="26" y1="30" x2="52" y2="18" stroke="#fbbf24" strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray="5 3" />
        <path d="M56 16 L48 12 L50 22 Z" fill="#f97316" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
      <line x1="46" y1="30" x2="12" y2="42" stroke="#fbbf24" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray="4 3" />
      <circle cx="12" cy="42" r="4.5" fill="none" stroke="#fbbf24" strokeWidth="2" />
      <line x1="46" y1="30" x2="46" y2="10" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 5 L51 14 L41 14 Z" fill="#f97316" />
      <circle cx="46" cy="30" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
    </svg>
  );
}

export function TeachCard(
  { headline, lines, short, onDismiss, compact: compactAsked = false, inline = false, gesture = "drag", place = "middle" }: {
    headline: string; lines: string[]; onDismiss: () => void;
    /**
     * The headline again, short enough for the one-row compact card.
     *
     * Not optional out of politeness — measured. The compact row leaves about
     * 215 px for text on a 390 px phone, which is around 30 characters at
     * this weight. "There is no through the wall." (30) fit to the pixel;
     * "Drag back from the ball, then let go." (38) rendered as "Drag back
     * from the ball, then l…" and lost the instruction's verb. A drill whose
     * headline is already short can leave this out.
     */
    short?: string;
    /** Headline only, no paragraph — see `TEACH_COMPACT_AFTER_REP`. */
    compact?: boolean;
    /** Render the panel alone, with no positioning of its own, for a caller
     *  that already has an overlay to put it in (the vision stage). */
    inline?: boolean;
    /** Which gesture to draw on the badge row. A drag arrow on a stage you
     *  tap is worse than no picture at all — it is a wrong instruction in the
     *  one place a card is meant to be clearer than words. */
    gesture?: TeachGesture;
    /** Where the box sits over the pitch: the middle (default), or high up
     *  when the thing being taught sits in the middle (the strike screen's
     *  ball). Ignored when `inline`. */
    place?: "middle" | "top";
  },
) {
  // The one-row form only existed to keep a card along the bottom edge off
  // the ball. The box in the middle stops play until it is closed, so it can
  // always say the whole thing.
  const compact = inline ? compactAsked : false;
  const panel = (
    <div
      className={
        // A solid card that is one piece: its own cursor (not the pitch's),
        // and the button inside its edge rather than poking out of it
        // (Mikey, 28 Sep 2026: "the got it button is like hovering over").
        "teach-card pointer-events-auto cursor-default w-full rounded-xl border-2 border-amber-400 bg-white shadow-xl "
        + (compact ? "px-2 py-1" : "px-3 py-2")
      }
    >
      {/* Self-contained so the shared tailwind config stays untouched; a
          duplicated @keyframes block is harmless CSS. Slow and small on
          purpose — this now stays on screen until it is tapped, so anything
          faster than a breath would be a nuisance rather than a nudge. */}
      <style>{TEACH_CARD_CSS}</style>
      <div className="flex items-center gap-1.5">
        {/* Inline on the badge row, 24 px. It used to be a 56 px block
            beside the text, which is most of what made this card tall enough
            to cover the ball. See `TeachGlyph`. */}
        <TeachGlyph gesture={gesture} compact={compact} />
        {compact
          // One row, headline and all — see `TEACH_COMPACT_AFTER_REP`. The
          // badge goes too: the headline is already the shortest possible
          // statement of what the drill wants, and a label above it saying
          // "how to play" is a second line to say what the first line says.
          ? (
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-black leading-tight text-gray-900">
              {short ?? headline}
            </span>
          )
          : (
            <>
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                How to play
              </span>
            </>
          )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          className="teach-dismiss pointer-events-auto ml-auto min-h-[36px] shrink-0 cursor-pointer rounded-lg bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-gray-950 transition hover:bg-amber-300"
        >
          Got it ✕
        </button>
      </div>

      {!compact && (
        <>
          <div className="mt-1.5 text-[12px] font-black leading-tight text-gray-900">{headline}</div>
          {lines.map(l => (
            <p key={l} className="mt-0.5 text-[10.5px] font-bold leading-snug text-gray-700">{l}</p>
          ))}
        </>
      )}
    </div>
  );

  if (inline) return panel;

  return (
    // ── In the middle, and play waits (Harry, 2 Oct 2026) ──
    //
    // "A pop-up pops up near where you would be looking anyway … I can still
    // just play right now whereas if that was here in like a box … then I
    // would have to click to get it round." It used to sit along the bottom
    // edge, pointer-transparent, so the drill carried on under it. Now it is
    // a box in the middle of the pitch over a dimmed screen that takes every
    // press: nothing can start until one tap — on the button or anywhere
    // else — closes it.
    <div
      role="dialog"
      aria-modal="true"
      className={`absolute inset-0 z-40 flex justify-center bg-black/40 px-4 ${
        place === "top" ? "items-start pt-[30%]" : "items-center"
      }`}
      onPointerDown={e => e.stopPropagation()}
      onClick={onDismiss}
    >
      <div className="w-full max-w-[320px]">{panel}</div>
    </div>
  );
}

/**
 * The nudge. Two things, both deliberately slow.
 *
 * The card breathes — a faint amber glow that rises and falls over two and a
 * half seconds — and the dismiss button pulses very slightly in step with it,
 * so the eye is drawn to the one part of the card that is a control rather
 * than to the card as a whole.
 *
 * Asked for directly: "give the box a small animation until clicked." The
 * animation IS the until-clicked signal now that the card no longer times
 * itself out — it is the only thing on the screen saying this is waiting on
 * you rather than on the next kick.
 *
 * `prefers-reduced-motion` turns both off and leaves the card at its resting
 * state, which is legible on its own.
 */
const TEACH_CARD_CSS = `
@keyframes teachBreathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
  50%      { box-shadow: 0 0 14px 1px rgba(251,191,36,0.32); }
}
@keyframes teachNudge {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); }
}
.teach-card { animation: teachBreathe 2.4s ease-in-out infinite; }
.teach-dismiss { animation: teachNudge 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .teach-card, .teach-dismiss { animation: none; }
}
`;

/**
 * From this rep on the card drops its paragraph and keeps its headline.
 *
 * ── Why it has to shrink at all ──
 *
 * The card used to vanish when the rep counter moved off 1, so it only ever
 * had to fit above the FIRST ball of a stage. It now stays until it is
 * tapped, which means it has to fit above the LAST one — and on the striking
 * stages the ball moves down the screen as the stage gets harder.
 *
 * Read off the real view maths (`freeKickView`, `BEHIND_BALL = 7`): a first
 * free kick at 16 m leaves 51 % of the canvas below the ball, and the hardest
 * rep of the hardest trial — 30 m of ladder, +0.9 m a rep, plus the
 * long-range adversity event — leaves about 16 %. So a card that persisted at
 * full height would sit on the ball at exactly the moment the kick is
 * hardest, which is the "boxing on the penalties" complaint all over again
 * one stage later.
 *
 * ── The first compact card was still too tall, and only a screenshot said so
 *
 * That 16 % was then called "roughly 80 px" here, against a compact card
 * "about 45 px", and both halves of that arithmetic were wrong. Driven in a
 * real browser on an iPhone 13 viewport, the last free kick of an ordinary
 * run (23 m) cleared the card by 17.8 px, and the genuine worst case — 33 m,
 * reached by the reload difficulty escalation, which is a real mechanic
 * rather than a contrived state — measured **-2.2 px**: the ball sitting on
 * the card's top border.
 *
 * So compact is now ONE ROW — glyph, headline, button — rather than a badge
 * row with the headline under it, and it loses the outer padding a step as
 * well. That is about 29 px back, which turns the worst case from a graze
 * into real clearance. The headline is truncated rather than wrapped,
 * because a card that grows a second line under pressure is the same bug
 * returning by another route.
 *
 * Worth keeping in mind for anything else that ever gets pinned to this
 * strip: the ball is not in a fixed place on the striking stages. It moves
 * down the screen as the stage gets harder, and the only reliable way to
 * know whether something clears it is to look at the hardest rep, not the
 * first one.
 */
export const TEACH_COMPACT_AFTER_REP = 1;

/**
 * Does the teaching card stay up across the whole stage, or only the first
 * attempt?
 *
 * `false` — the shipped answer — means the first attempt only, and the card
 * goes when that attempt ends whether or not it was tapped. Tapping it is
 * still worth doing and does something different: it writes `teachSeen`, so
 * the drill never teaches you again on this device.
 *
 * ── Why this is a switch and not a deletion ──
 *
 * Both behaviours were built and both were measured in a real browser. It
 * stayed-until-tapped first, then was looked at and changed — "the box should
 * automatically leave after the first attempt imo" — which is a taste call
 * about a screen, exactly the kind that gets looked at again.
 *
 * Flipping this to `true` restores the persistent card in full, including the
 * compact one-row form it needs to clear the free-kick ball on the later
 * attempts (`TEACH_COMPACT_AFTER_REP`) and the short headlines each drill
 * carries for that row. None of that is reachable while this is `false`, and
 * it is kept rather than deleted because the sizing behind it cost two rounds
 * of real browser measurement to get right and would have to be re-taken.
 *
 * Same idiom as `USE_FIRST_PERSON_DRIBBLE` in CanvasMatch.tsx: one constant,
 * both paths real, the off one documented rather than rotting.
 */
export const TEACH_PERSISTS = false;

/** How long the last attempt's result shows before the stage moves on — the
 *  engine's own result banner plays out first. */
const LAST_RESULT_HOLD_MS = 1400;

export function StrikeStage({
  reps, build, skills, seed, title, hint, subtitle, teach, drill, keeperStrengthFor,
  penaltyRead, penaltyReadFor, onDone, forceCompactTeach = false, penaltyRunup, freeKickRunup,
  scene, markersFor, onBallStep, judge, pauseTeach,
}: StrikeStageProps) {
  // The pop-up that has the match frozen right now, and how to let it go.
  const [paused, setPaused] = useState<{ moment: "runup" | "contact"; release: () => void } | null>(null);
  const pauseTeachRef = useRef(pauseTeach);
  pauseTeachRef.current = pauseTeach;
  const holdAt = useCallback((moment: "runup" | "contact", release: () => void) => {
    const t = pauseTeachRef.current?.[moment];
    if (!t || teachSeen(t.drill)) return false;
    setPaused({ moment, release });
    return true;
  }, []);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const closePause = useCallback(() => {
    const p = pausedRef.current;
    if (!p) return;
    pausedRef.current = null;
    const t = pauseTeachRef.current?.[p.moment];
    if (t) markTeachSeen(t.drill);
    setPaused(null);
    p.release();
  }, []);
  const pauseCard = paused ? pauseTeach?.[paused.moment] : undefined;
  const [rep, setRep] = useState(0);
  const repRef = useRef(0);
  const [scores, setScores] = useState<number[]>([]);
  const scoresRef = useRef<number[]>([]);
  const doneRef = useRef(false);
  const [resultText, setResultText] = useState("");
  /** The first attempt has been struck — the teaching card's job is done. */
  const [struckOnce, setStruckOnce] = useState(false);

  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen(drill)) setTeachDone(true); }, [drill]);
  const dismissTeach = useCallback(() => {
    markTeachSeen(drill);
    setTeachDone(true);
  }, [drill]);

  // The latest build, read when the engine asks for the next picture — so the
  // factory it holds never changes and the match never restarts under you.
  const buildRef = useRef(build);
  buildRef.current = build;
  const openOn = useCallback(() => {
    const r = repRef.current;
    return buildRef.current(r, mulberry32((seed ^ ((r + 1) * 0x9e3779b1)) >>> 0));
  }, [seed]);

  /** One attempt is over — scored off the engine's own result. */
  const pointsRef = useRef<number[]>([]);
  const judgeRef = useRef(judge);
  judgeRef.current = judge;
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current) return;
    setStruckOnce(true);
    const judged = judgeRef.current?.(info);
    if (judged) {
      scoresRef.current = [...scoresRef.current, judged.quality];
      pointsRef.current = [...pointsRef.current, judged.quality];
      setScores(scoresRef.current);
      setResultText(judged.text);
      const nextRep = repRef.current + 1;
      if (nextRep >= reps) {
        doneRef.current = true;
        const quality = pointsRef.current.reduce((a, b) => a + b, 0) / pointsRef.current.length;
        window.setTimeout(() => onDone(quality), LAST_RESULT_HOLD_MS);
      } else {
        repRef.current = nextRep;
        setRep(nextRep);
      }
      return;
    }
    // Placement only means something for a ball that reached the goal line.
    const reached = info.outcome === "goal" || info.outcome === "rebound"
      || info.outcome === "wide" || info.outcome === "over" || info.outcome === "post";
    const crossX = reached && info.ball ? info.ball.x : null;
    // A team-mate getting on the end of it is his finish, not your strike.
    const yours = !info.teammateShot;
    const q = yours ? strikeQuality(info.outcome, crossX) : strikeQuality("saved", null);
    scoresRef.current = [...scoresRef.current, q];
    // Free kicks are marked by what happened, so the score can be explained
    // in one line (Mikey, 28 Sep 2026: "33 out of 100… I didn't score any"):
    // a goal is a full mark, a shot the keeper had to save is half.
    const pts = !yours ? 0
      : info.outcome === "goal" || info.outcome === "rebound" ? 1
      : info.outcome === "saved" || info.outcome === "tipped" ? 0.5 : 0;
    pointsRef.current = [...pointsRef.current, pts];
    setScores(scoresRef.current);
    setResultText(!yours ? "A team-mate gets on the end of it." : (OUTCOME_LINE[info.outcome] ?? "Away."));

    const next = repRef.current + 1;
    if (next >= reps) {
      doneRef.current = true;
      // Penalties: the share you scored (goal = a quality of 0.55 or more in
      // strikeQuality). Free kicks keep the graded quality, where a good
      // save still counts for something.
      const goals = scoresRef.current.filter(q => q >= 0.55).length;
      const quality = drill === "penalties"
        ? goals / scoresRef.current.length
        : pointsRef.current.reduce((a, b) => a + b, 0) / pointsRef.current.length;
      window.setTimeout(() => onDone(quality), LAST_RESULT_HOLD_MS);
    } else {
      // The engine asks for the next picture after its own result pause —
      // by then this is the rep it builds.
      repRef.current = next;
      setRep(next);
    }
  }, [onDone, reps, drill]);

  const trial = trialInvisibleStats();
  const showTeach = !struckOnce && rep === 0 && !!teach && !teachDone;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-gray-800">{title}</span>
        {/* One attempt (the v0.23 trial): nothing to count. */}
        {reps > 1 && (
          <span className="text-[11px] font-black tabular-nums text-gray-500">
            {Math.min(rep + 1, reps)} / {reps}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mb-1 text-[11px] font-bold text-gray-500">{subtitle(rep)}</div>
      )}

      <div className="relative">
        <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          skills={skills}
          setPieceSkill={trial.setPieceSkill}
          keeperStrength={keeperStrengthFor?.(rep) ?? 62}
          penaltyRead={penaltyReadFor ? penaltyReadFor(rep) : penaltyRead}
          seed={seed}
          // A trial is you against the keeper (and the wall): no team-mate
          // following in to tidy up a rebound. Harry, 24 Sep 2026. The gate
          // takes the keeper and the goal off as well (its own `scene`).
          scene={scene ?? { teammates: false }}
          markers={markersFor?.(rep)}
          onBallStep={onBallStep}
          penaltyRunup={penaltyRunup}
          freeKickRunup={freeKickRunup}
          holdAt={pauseTeach ? holdAt : undefined}
        />
        {pauseCard && (
          <TeachCard
            headline={pauseCard.headline}
            lines={pauseCard.lines}
            gesture={pauseCard.gesture}
            place={pauseCard.place}
            onDismiss={closePause}
          />
        )}
        {showTeach && teach && (
          <TeachCard
            headline={teach.headline}
            lines={teach.lines}
            short={teach.short}
            compact={forceCompactTeach}
            onDismiss={dismissTeach}
          />
        )}
      </div>

      {reps > 1 && <div className="mt-1 flex items-center gap-1">
        {Array.from({ length: reps }, (_, i) => {
          const q = scores[i];
          return (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
              {q !== undefined && (
                <div
                  className={`h-full ${q >= 0.55 ? "bg-emerald-400" : q >= 0.3 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(8, q * 100)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>}
      <p className="mt-1 min-h-[16px] text-center text-[11px] font-bold text-gray-600">
        {resultText || (showTeach ? "" : hint)}
      </p>
    </div>
  );
}

// ── The penalties stage itself ─────────────────────────────────────────────

export interface TrialPenaltiesProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
  /** Your penalty run-up (lib/star/runupStyles.ts) — looks only. */
  penaltyRunup?: PenaltyRunupId;
}

/**
 * One rep's penalty: the engine's own penalty, the ball on the spot, the
 * keeper in the middle at the day's strength. He does not lean any more —
 * he reads your kick at the strike, like a match keeper (penaltyKeeper.ts).
 * Exported so a test can drive the real thing through the engine.
 */
export function buildPenaltyScenario(trial: TrialProgress, rep: number, rng: () => number, keeperStrength?: number): Scenario {
  const setup = penaltySetup(trial, rep);
  const sc = buildScenario("penalty", rng, keeperStrength ?? setup.keeperStrength, 60, 55);
  initDefenders(sc, rng);
  sc.ball = { ...setup.ball, x: setup.ball.x ?? CX };
  return sc;
}

/** What the ramp's keeper is like on this kick, said plainly (v0.15 item 7b). */
function rampLine(rep: number): string {
  const words = rep === 0 ? "A fair keeper — he's guessing."
    : rep >= REPS.penalties - 1 ? "His best: he reads you and goes almost every time."
      : "Sharper now — he's reading you better.";
  return `Kick ${rep + 1}: ${words}`;
}

export default function TrialPenalties({
  trial, onDone, skills = { power: 55, technique: 55 }, penaltyRunup,
}: TrialPenaltiesProps) {
  // v0.15 item 7b: the keeper ramps kick by kick (trialStages.ts's
  // penaltyRampFor), the random day switched off for him.
  const build = useCallback(
    (rep: number, rng: () => number) =>
      buildPenaltyScenario(trial, rep, rng, penaltyRampFor(rep, REPS.penalties).keeperStrength),
    [trial],
  );
  return (
    <StrikeStage
      reps={REPS.penalties}
      build={build}
      skills={skills}
      seed={trial.seed}
      penaltyRunup={penaltyRunup}
      drill="penalties"
      keeperStrengthFor={(rep) => penaltyRampFor(rep, REPS.penalties).keeperStrength}
      penaltyReadFor={(rep) => penaltyRampFor(rep, REPS.penalties).read}
      title="Penalties"
      hint="Drag back from the ball to aim, and pull further for more power."
      teach={{
        headline: "Drag back from the ball, then let go.",
        short: "Drag back, then let go.",
        lines: [
          "Pull further for more power. The arrow is where it is going.",
          "Then you run up. He may hop — drag sideways to change your aim.",
          "Tap the ball before the ring runs out.",
        ],
      }}
      subtitle={rampLine}
      onDone={onDone}
    />
  );
}
