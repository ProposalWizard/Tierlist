"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders,
  stepBallInNet, settleBall, stepBallPastBar, dragForFullPower, clamp,
  type Ball, type Outcome, type Scenario, type Viewport,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, POST_L, POST_R, NET_DEPTH, PEN_SPOT_Y } from "@/lib/star/pitch";
import {
  REPS, penaltySetup, strikeQuality, weightedQuality,
  teachSeen, markTeachSeen, type TeachableDrill,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import ContactBall from "@/components/star/ContactBall";
import { ELEVEN_A_SIDE_ATTACK } from "@/lib/star/fiveASide/rules";
import {
  cameraContaining, projectionFor, drawPitch, drawGoal, drawFigure, drawKeeper,
  drawBall,
} from "@/lib/star/fiveASide/render";
import { loadFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";

/**
 * THE PENALTIES STAGE — and, in the second half of this file, the striking
 * machinery the FREE KICKS stage runs on too.
 *
 * ── Why the shared parts live here rather than in a lib module ──
 *
 * Penalties and free kicks are the same screen with a different picture in
 * front of it: drag to aim, pick a spot on the ball, watch it, score what
 * happened. The loop, the thumb, the paint and the rep bookkeeping are
 * identical, and duplicating three hundred lines of canvas across two files
 * so that each could own its own copy would be the worst of the options.
 *
 * The natural home for `StrikeStage` and `paintTrialScene` is a lib module,
 * and if this were a free hand that is where they would be. It is not: this
 * lane owns exactly three component files and no library file, and inventing
 * one would land in another agent's working tree. So the generic piece lives
 * in the first of the two files that uses it and is exported; TrialFreeKicks
 * imports it. Worth moving into `lib/star/` the next time somebody has the
 * whole tree to themselves.
 *
 * ── What this stage does NOT decide ──
 *
 * Everything that matters is `trialStages.ts`: how good the keeper is, which
 * way he is leaning, how many you take, and what each one was worth. This
 * screen reads those numbers and shows them. The one number it does choose is
 * how far off centre a lean of 1.0 actually stands the keeper — see
 * PENALTY_LEAN_M.
 */

// ── What the picture is drawn WITH ─────────────────────────────────────────
//
// Nothing, any more. This file used to carry three hundred lines of its own
// grass, its own IFAB lines, its own five-surface goal, its own wall figures
// and its own hand-drawn keeper — a second art style, with the vision stage
// carrying a third, so a new player met three different-looking games inside
// the first six minutes of his career.
//
// All of it now goes through `lib/star/fiveASide/render.ts`, the cleanest
// renderer in the opening: plain functions over a context, heads drawn through
// the shared `drawPlayerHead` so real photos and the Face Editor's own
// settings simply work. The geometry it draws from is `ELEVEN_A_SIDE_ATTACK`
// (rules.ts) — a real penalty area, a real 7.32 m goal, a real 2.44 m bar —
// so the striking stages get a full-size goal out of the same functions the
// five-a-side gets a small one out of, rather than a second copy of them.

/** The two men on the edge of the D, and a free kick's wall: not your team,
 *  not the opposition you can name — just bodies in the way. */
const WALL_KIT = { shirt: "#374151", shorts: "#1f2937", trim: "#e5e7eb" };
const KEEPER_KIT = { shirt: "#fbbf24", shorts: "#92400e", trim: "#92400e" };

/**
 * The same aim feel as a real match, and for the same reason TrialPenalty has
 * its own note about it: this pair quietly drifted once already, and a trial
 * that teaches a different gesture from the game it is the opening of is
 * worse than no trial. MIN_PULL is a dead zone so a tap is not a shot;
 * full power is computed from the striker's own power, never a flat constant.
 */
const MIN_PULL = 0.008;

/** How far off centre a keeper leaning all the way (|lean| = 1) actually
 *  stands, in metres. Sized against the engine's own numbers rather than by
 *  eye: he can cover KEEPER_LATERAL_MAX (3.2 m) either side of where he
 *  starts, and his save radius at the goal plane is about 2 m, so 1.5 m of
 *  lean genuinely opens one corner and genuinely shuts the other without
 *  making a full-lean penalty a free goal on the open side. */
const PENALTY_LEAN_M = 1.5;

/** Seconds of flight after which an attempt is called dead regardless.
 *  `stepBall` has its own dead-ball timeout and should always resolve, but
 *  this stage is one of five and a rep that never ends would strand the whole
 *  trial on a screen with no way forward — a guard worth having even though
 *  nothing is known to trip it. */
const FLIGHT_TIMEOUT = 9;

/**
 * How long the ball is watched after the outcome is decided, before the
 * result banner goes up.
 *
 * This used to be a full second, and the real match has no such gate at all —
 * `CanvasMatch` shows its banner the instant `stepBall` returns. Measured, the
 * trial's banner landed +983 ms after the outcome on every single attempt, on
 * top of the engine's own multi-second loose-ball resolution: a saved penalty
 * averaged 4.30 s to decide and 5.28 s to say so, and the worst case measured
 * was 8.52 s. Reported directly as the drills taking "ten seconds to say off
 * the post".
 *
 * Not taken all the way to zero, deliberately. Unlike the match, this screen
 * has no `stepReactions` — nobody chases a loose ball here, by design, so that
 * a drill judging YOUR strike is never decided by somebody following it in —
 * and a short beat is what lets a goal actually be SEEN crossing the line and
 * the keeper's dive be seen finishing (it completes ~150 ms after the ball
 * crosses, now that he is stepped through it at all). A quarter of a second
 * covers that and cuts three quarters of the delay.
 */
const SETTLE_BEFORE_BANNER = 0.25;

/**
 * HOW LONG THE AIM ARROW IS DRAWN, as a fraction of the metres filling the
 * canvas's height, at full power.
 *
 * Not a number this screen gets to choose. It is CanvasMatch.tsx's own
 * constant, copied, because the arrow has to be the match's arrow — reported
 * twice as "the drag arrow still doesn't look like the original football
 * engine", and measured at 0.11 here against 0.132 there, which is 16.7 %
 * short at every power (48.3 px vs 57.9 px at full power on an iPhone 13).
 *
 * A named export rather than a literal buried in the paint function purely so
 * `tests/star/trialStageScreens.mts` can hold it against the real value in
 * CanvasMatch.tsx and fail the day the match's arrow is re-tuned and this one
 * is not. That drift is the whole bug; this is the tripwire for it.
 */
export const AIM_ARROW_LENGTH = 0.132;

type Phase = "aim" | "contact" | "flight" | "result";

// ── The picture ────────────────────────────────────────────────────────────

/**
 * WHAT HAS TO BE IN SHOT, and why the box is not the frame.
 *
 * The scenario's own `viewport` is the WORLD, not the camera — the engine
 * calls a ball more than a metre outside it out of play — so it has to stay
 * the tall 5:8 rectangle the engine built. What it must not also be is the
 * shape of the canvas. It was, and measured on a phone the canvas ran 108 px
 * off the bottom of the screen: the first thing a new career shows you, and a
 * third of it below the fold, with the bottom half of what WAS on screen empty
 * grass nobody ever kicks a ball into.
 *
 * So the drawn camera is computed from what genuinely has to be visible — the
 * goal with its net, the ball, and the room behind the ball the drag pulls
 * back into — and `cameraContaining` grows that to the canvas's own shape.
 * Nothing is cropped, the empty third of the pitch is simply not filmed, and
 * a penalty is framed like a penalty instead of like a map.
 */
const CAMERA_SIDE_PAD = 6;
const CAMERA_BEHIND_BALL = 7;

export function strikeCamera(
  sc: Scenario, ball: { x: number; y: number }, W: number, H: number,
): Viewport {
  // The men in the way count. A penalty's two defenders stand on the edge of
  // the D, BEHIND the spot, and a frame that stopped at the drag room drew
  // both of them sliced off at the bottom edge — seen in a screenshot after
  // the first version of this shipped, not reasoned about.
  let x1 = Math.min(POST_L, ball.x), x2 = Math.max(POST_R, ball.x);
  let y2 = ball.y + CAMERA_BEHIND_BALL;
  for (const d of sc.defenders) {
    x1 = Math.min(x1, d.x); x2 = Math.max(x2, d.x);
    y2 = Math.max(y2, d.y + 2.5);
  }
  return cameraContaining({
    x1: x1 - CAMERA_SIDE_PAD, x2: x2 + CAMERA_SIDE_PAD,
    y1: -NET_DEPTH - 1.5, y2,
  }, W, H);
}

/**
 * Draw one striking scene: the pitch, the goal, the wall (if there is one),
 * the keeper, the ball and — while a drag is live — the aim arrow. Exported
 * because the free-kick stage draws the identical scene.
 *
 * Every mark on the grass and every figure on it now comes from
 * `fiveASide/render.ts`. What is left here is the one thing that belongs to
 * this screen rather than to football: the aim arrow.
 */
export function paintTrialScene(
  ctx: CanvasRenderingContext2D,
  sc: Scenario,
  opts: {
    W: number; H: number;
    /** What the camera is looking at — see `strikeCamera`. */
    camera: Viewport;
    ball: Ball | null;
    /** Where the thumb is now, in pitch metres — null when not dragging. */
    drag: { x: number; y: number } | null;
    power: number;
    faceStyle: FaceStyle;
    fakeFaceStyle: FakeFaceStyle;
  },
) {
  const { W, H, camera, ball, drag, power, faceStyle, fakeFaceStyle } = opts;
  const rules = ELEVEN_A_SIDE_ATTACK;
  const p = projectionFor(rules, W, H, camera);
  const { px, py, unit } = p;

  drawPitch(ctx, rules, p);
  drawGoal(ctx, rules, p, 0, NET_DEPTH, { height: rules.crossbar });

  // ── The men in the way ──
  //
  // A penalty's two defenders stand at the D and never move; a free-kick wall
  // stands in front of the ball and JUMPS as it is struck (`stepDefenders`
  // gives each of them a real z/vz). Drawing the lift — the shadow stays on
  // the grass, the figure rises off it — is what makes going under a wall
  // read as a real option rather than a coincidence.
  for (const d of sc.defenders) {
    drawFigure(
      ctx, p, d, { ...WALL_KIT, lift: Math.max(0, d.z ?? 0) },
      faceStyle, fakeFaceStyle,
    );
  }

  // ── The keeper ──
  //
  // The same man as everybody else on the pitch, in a keeper's pose — see
  // `drawKeeper`. He used to be drawn here, by hand, with his own head size
  // and his own arms, which is most of why he read as not quite right.
  {
    const kk = sc.keeper;
    const lunge = kk.saveLunge > 0 ? Math.min(1, kk.saveLunge) : 0;
    const sign = kk.saveLunge > 0
      ? (kk.saveDir || 1)
      : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
    const reach = clamp(Math.abs(kk.dive) / 1.6, 0, 1);
    drawKeeper(
      ctx, p, { x: kk.x, y: kk.y }, KEEPER_KIT,
      { dive: sign * Math.max(reach, lunge), lunge },
      faceStyle, fakeFaceStyle,
    );
  }

  // ── The ball ──
  drawBall(ctx, p, ball ? ball.pos : sc.ball, ball ? Math.max(0, ball.z) : 0);

  // ── The aim arrow ──
  //
  // The one thing on this canvas that is not football. Kept here rather than
  // pushed into the shared renderer: a five-a-side aims with `drawAim`, and
  // this is the MATCH's arrow, which is a different drawing again.
  //
  // ── It is the match's arrow to the pixel, and that is the point ──
  //
  // Reported twice: "the drag arrow still doesn't look like the original
  // football engine." Measured against CanvasMatch.tsx's own aim block rather
  // than eyeballed, and two real differences came out of it:
  //
  //  1. LENGTH. This drew `power × heightSpan × 0.11`; the match draws
  //     `× 0.132` (its own comment records why — half the old length, then
  //     20 % back on top once the meter went and the arrow became the only
  //     power readout). On an iPhone 13's 358×439 canvas that is 48.3 px
  //     against 57.9 px at full power — 16.7 % short at every power, which is
  //     exactly the kind of difference that reads as "not the same arrow"
  //     without being nameable.
  //  2. THE METER. See below.
  //
  // Everything else — the gradient shaft (#fb923c → #ea580c), the round cap,
  // the solid #f97316 head, its dark edge, and all four size formulas off W
  // and `unit` — was already identical, and is left alone.
  //
  // `camera.y2 - camera.y1` is the right span to multiply: the match reads
  // whichever axis fills the canvas HEIGHT, and these two stages never turn
  // the frame, so pitch Y always is it.
  if (drag) {
    const dx = sc.ball.x - drag.x, dy = sc.ball.y - drag.y;
    const len = Math.hypot(dx, dy) || 1;
    const shown = power * (camera.y2 - camera.y1) * AIM_ARROW_LENGTH;
    const ax = px(sc.ball.x), ay = py(sc.ball.y);
    const bx2 = px(sc.ball.x + (dx / len) * shown);
    const by2 = py(sc.ball.y + (dy / len) * shown);

    const ang = Math.atan2(by2 - ay, bx2 - ax);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    const arrowLen = Math.hypot(bx2 - ax, by2 - ay) || 1;
    const headLen = clamp(W * 0.045, W * 0.02, arrowLen * 0.45);
    const headHalf = W * 0.022;
    const shaftW = W * 0.014;
    const hbx = bx2 - ux * headLen, hby = by2 - uy * headLen;

    const shaftGrad = ctx.createLinearGradient(ax, ay, bx2, by2);
    shaftGrad.addColorStop(0, "#fb923c");
    shaftGrad.addColorStop(1, "#ea580c");
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = shaftW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(hbx, hby);
    ctx.stroke();
    ctx.lineCap = "butt";

    ctx.beginPath();
    ctx.moveTo(bx2, by2);
    ctx.lineTo(hbx + nx * headHalf, hby + ny * headHalf);
    ctx.lineTo(hbx - nx * headHalf, hby - ny * headHalf);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, unit * 0.22);
    ctx.strokeStyle = "rgba(124,45,18,0.6)";
    ctx.stroke();

    // ── The power meter is gone, because the match has not had one for a
    //    while and this was the only screen still drawing it ──
    //
    // A 19.7 × 307 px bar down the left edge with a green/amber/red fill and
    // an 18 px "NN%" label over it — 3.9 % of an iPhone 13's canvas, on the
    // first ball anybody in this game ever kicks, showing a number the real
    // game never shows. CanvasMatch removed its own copy of exactly this
    // ("reported as redundant with the arrow's own length, which already is
    // the power readout") and this one simply never followed. Reported
    // directly as a thing the trial has and the game does not.
    //
    // Nothing is lost with it: `power` still drives the arrow's length, which
    // is the same readout the match trusts, and the teach card already says
    // "pull further for more power" in words.
  }
}

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
  /** Build the scenario for one rep. Everything stage-specific lives here:
   *  the ball's spot, the keeper, the wall, the camera. */
  build: (rep: number, rng: () => number) => Scenario;
  /** Fed straight to the engine's striking model, and to `dragForFullPower`
   *  so the drag reaches full power at the same distance a real match does. */
  skills: { power: number; technique: number };
  /** Seeds the per-rep RNG, so the same attempt is the same attempt however
   *  many times the app is closed and re-opened — the rule the whole trial is
   *  built on (see trial.ts). */
  seed: number;
  title: string;
  hint: string;
  /** Extra line under the rep counter: distance, wall size, whatever the
   *  stage wants the player to actually read before he strikes it. */
  subtitle?: (rep: number) => string;
  /**
   * The instruction shown, properly and at a readable size, on the FIRST rep
   * of the stage — see `TeachCard`.
   *
   * Optional only so `StrikeStage` stays a generic component; both stages
   * that use it pass one, because a first rep with nothing on it is the case
   * this exists to remove.
   */
  teach?: { headline: string; lines: string[] };
  /** Which drill this is, for remembering that its teaching has been
   *  dismissed. See `teachSeen` in trialStages.ts. */
  drill: TeachableDrill;
  /**
   * Called the instant the ball is actually struck, with the live scenario.
   *
   * The one hook a stage gets into the flight it is about to watch. Penalties
   * uses it to make the keeper commit to a side and genuinely travel — see
   * `commitKeeperGuess`. Free kicks does not pass one: a keeper setting
   * himself against a wall is not guessing a corner blind, and nothing was
   * measured about that case.
   */
  onStrike?: (sc: Scenario, rep: number) => void;
  onDone: (quality: number) => void;
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
 * Pointer-transparent throughout, EXCEPT the one button on it. It sits over
 * the canvas and the canvas owns every pointer event on this screen; a card
 * that swallowed the first drag would teach the gesture and then refuse it.
 * The dismiss button re-enables pointers on itself alone (`pointer-events-auto`
 * on a child of a `pointer-events-none` parent), so the 44 px it occupies is
 * the only part of the canvas a drag cannot start in — and it sits in the top
 * corner, which is goal, not the strip behind the ball that a drag pulls back
 * into.
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
export function TeachCard(
  { headline, lines, onDismiss }: {
    headline: string; lines: string[]; onDismiss: () => void;
  },
) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-3">
      <div className="w-full rounded-xl border border-amber-300/30 bg-black/80 px-3.5 py-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
            First one
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
            It still counts
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="pointer-events-auto -my-1.5 -mr-1.5 ml-auto rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Got it ✕
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3">
          {/* The gesture, drawn. A ball, the thumb pulled back off it, and the
              arrow showing where it goes — the one thing a sentence is worst
              at describing and a picture is best at. */}
          <svg viewBox="0 0 64 48" className="h-14 w-[4.6rem] shrink-0" aria-hidden="true">
            <line x1="46" y1="30" x2="12" y2="42" stroke="#fbbf24" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray="4 3" />
            <circle cx="12" cy="42" r="4.5" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <line x1="46" y1="30" x2="46" y2="10" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            <path d="M46 5 L51 14 L41 14 Z" fill="#f97316" />
            <circle cx="46" cy="30" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
          </svg>

          <div>
            <div className="text-[13px] font-black leading-tight text-white">{headline}</div>
            {lines.map(l => (
              <p key={l} className="mt-1 text-[11px] font-bold leading-snug text-white/80">{l}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StrikeStage({
  reps, build, skills, seed, title, hint, subtitle, teach, drill, onStrike, onDone,
}: StrikeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const phaseRef = useRef<Phase>("aim");
  const outcomeRef = useRef<Outcome | null>(null);
  const resolvedRef = useRef(false);
  const flightTRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const repRef = useRef(0);
  const doneRef = useRef(false);
  // Read once, not per frame: the Face Editor's settings are a localStorage
  // read, and every figure on the pitch draws its head through them.
  const camRef = useRef<Viewport | null>(null);
  const camKeyRef = useRef("");
  const faceStyleRef = useRef<FaceStyle>(loadFaceStyle());
  const fakeFaceStyleRef = useRef<FakeFaceStyle>(loadFakeFaceStyle());

  const [rep, setRep] = useState(0);
  /**
   * Whether the teaching is still being shown.
   *
   * Seeded from `localStorage` in an effect rather than in the initialiser:
   * this is a client component but Next still renders it once on the server,
   * where `window` does not exist — reading storage in `useState`'s
   * initialiser would throw there, and `useState(() => teachSeen(...))` would
   * also hand the first client render a value the server's HTML disagrees
   * with. Starting "not yet dismissed" and correcting on mount means the
   * server and the first client render always agree, and a returning player
   * loses the card a frame later rather than never.
   */
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen(drill)) setTeachDone(true); }, [drill]);
  const dismissTeach = useCallback(() => {
    markTeachSeen(drill);
    setTeachDone(true);
  }, [drill]);

  const [phase, setPhaseState] = useState<Phase>("aim");
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [resultText, setResultText] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  /** Full power is reached at the same drag distance a real match uses for a
   *  striker with these legs. */
  const fullPowerPull = useMemo(() => dragForFullPower(skills.power), [skills.power]);

  // A fresh attempt. Keyed on `rep` so it runs once per attempt and never
  // mid-flight.
  useEffect(() => {
    // Each rep gets its own stream. Mixing the rep into the seed (rather than
    // drawing a rep's scenario from one long-running stream) means attempt
    // three is the same attempt three whether or not you sat out attempt two
    // — the same reproducibility rule `penaltySetup` follows for its own
    // keeper lean.
    const rng = mulberry32((seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0);
    rngRef.current = rng;
    const sc = build(rep, rng);
    scRef.current = sc;
    ballRef.current = null;
    outcomeRef.current = null;
    resolvedRef.current = false;
    flightTRef.current = 0;
    dragRef.current = null;
    draggingRef.current = false;
    repRef.current = rep;
    camKeyRef.current = "";
    setAim(null);
    setResultText("");
    setPhase("aim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, seed]);

  // ── The thumb ──────────────────────────────────────────────────────────
  // ── A thumb lands where it LOOKS like it landed ──
  //
  // Through the CAMERA, not the scenario's viewport. Those used to be the same
  // rectangle and are not any more, and using the wrong one would put the drag
  // somewhere other than under the finger — the aim would be wrong by whatever
  // the camera had cropped, silently, on every kick.
  const pitchFromPointer = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const sc = scRef.current;
    if (!c || !sc) return { x: CX, y: PEN_SPOT_Y };
    const vp = camRef.current ?? sc.viewport;
    const r = c.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return { x: vp.x1 + fx * (vp.x2 - vp.x1), y: vp.y1 + fy * (vp.y2 - vp.y1) };
  };

  /** Pull length as a fraction of the canvas height, so power reads the same
   *  however the scene is scaled. */
  const screenPull = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) => {
    const h = vp.y2 - vp.y1, w = vp.x2 - vp.x1;
    const aspect = w / h;
    return Math.hypot(((drag.x - ball.x) / w) * aspect, (drag.y - ball.y) / h);
  };
  const powerFrom = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) =>
    clamp(screenPull(drag, ball, vp) / fullPowerPull, 0, 1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    draggingRef.current = true;
    dragRef.current = pitchFromPointer(e);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    const sc = scRef.current;
    dragRef.current = null;
    if (!d || !sc) return;
    const vp = camRef.current ?? sc.viewport;
    if (screenPull(d, sc.ball, vp) < MIN_PULL) return;
    const power = powerFrom(d, sc.ball, vp);
    if (power < 0.05) return;
    setAim({ dir: { x: sc.ball.x - d.x, y: sc.ball.y - d.y }, power });
    setPhase("contact");
  };

  const handleContact = (contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc || !aim) return;
    ballRef.current = launch(sc, aim.dir, aim.power, contact, skills, rngRef.current);
    // The stage's one chance to react to the ball actually being hit, before
    // a single frame of flight is simulated — see `onStrike`.
    onStrike?.(sc, repRef.current);
    setAim(null);
    flightTRef.current = 0;
    setPhase("flight");
  };

  /** One attempt is over. Score it and move on. */
  const finishAttempt = useCallback((outcome: Outcome) => {
    const sc = scRef.current, ball = ballRef.current;
    // Placement only means something for a ball that actually reached the
    // goal line; anything else has no crossing point to grade.
    const crossX = ball && (outcome === "goal" || outcome === "rebound"
      || outcome === "wide" || outcome === "over" || outcome === "post")
      ? ball.pos.x : null;

    // ── Somebody else finishing it ──
    //
    // In a real match a team-mate can get on the end of a rebound, and a
    // clean team-mate finish reports as "goal" exactly like yours would —
    // `receiverShot` is the one reliable signal that somebody else struck it
    // (TrialPenalty had to make the same distinction). Crediting that as a
    // goal of YOURS is wrong here: this stage measures your striking, and a
    // scuffed kick a striker rescued would otherwise score a perfect 1.0. It
    // is graded as a save instead — the ball was struck, something stopped it
    // going straight in, and the rebound is not yours to claim.
    //
    // It genuinely fires, and it was worth measuring rather than reasoning
    // about: leaving `stepReactions` out of the loop looked like it should
    // make a team-mate finish impossible, and it does not — `stepBall` has
    // its own path onto a loose ball that does not need reactions at all.
    // About one struck attempt in forty ends this way
    // (tests/star/trialStageScreens.mts measures it on the real engine), so
    // without this guard roughly that many scuffed kicks a trial would score
    // a perfect 1.0.
    const yours = !sc?.receiverShot;
    const quality = yours ? strikeQuality(outcome, crossX) : strikeQuality("saved", null);

    scoresRef.current = [...scoresRef.current, quality];
    setResultText(
      !yours ? "A team-mate gets on the end of it."
        : (OUTCOME_LINE[outcome] ?? "Away."),
    );
    setPhase("result");
    window.setTimeout(() => {
      if (repRef.current + 1 >= reps) {
        if (doneRef.current) return;
        doneRef.current = true;
        // Weighted, not a flat mean: the last kick of this stage is the
        // hardest one in it (a ball walked backwards, or a keeper who has
        // stopped telling you anything) and surviving it is worth more than
        // surviving the opener. See `weightedQuality`.
        onDone(weightedQuality(scoresRef.current));
      } else {
        setRep(r => r + 1);
      }
    }, 1200);
  }, [onDone, reps]);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let settle = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;
      if (!sc) return;

      if (phaseRef.current === "aim") {
        // He breathes and shifts his weight rather than standing frozen.
        stepKeeper(sc, dt);
      } else if (phaseRef.current === "flight" && ballRef.current) {
        const ball = ballRef.current;
        flightTRef.current += dt;
        if (ball.inNet) {
          stepBallInNet(ball, dt);
          // ── HE MUST KEEP DIVING AFTER THE BALL IS IN ──
          //
          // Reported directly: "he dives after the ball goes in the net."
          // Measured over 200 penalties, the same scenarios and the same
          // strikes through both screens' loops, and the split is clean:
          //
          //                                        trial     real match
          //   dive STARTS, vs the ball crossing     −7 ms       −7 ms
          //   dive at FULL STRETCH                +1117 ms     +150 ms
          //
          // The start is identical, and is the engine's own rule (the save is
          // judged at the keeper's own line, which on a penalty is one substep
          // before the goal line) — not a trial bug. The stretch is, and it is
          // this: once `stepBall` returns an outcome the loop stays in the
          // `flight` phase for the settle beat below, and NEITHER of the two
          // branches it can now take used to call `stepKeeper`. He stopped
          // dead at 13 % of the dive, held there for 967 ms, and then finished
          // it as the banner appeared.
          //
          // `CanvasMatch.tsx` fixed exactly this for the real match, and its
          // own comment quotes the same complaint almost word for word ("so a
          // goal is SEEN going in and a keeper is not frozen mid-dive"). This
          // screen simply never inherited it. `pendingDone` is what stops him
          // arriving early, so gating on `done` is all that is needed here.
          if (!sc.keeper.done) stepKeeper(sc, dt);
        } else if (!outcomeRef.current) {
          // Three substeps per frame, the same split every other screen on
          // this engine uses. One coarse step per frame is measurably worse
          // at the boundary checks — over the bar, in the net, off the post —
          // that decide the outcome.
          //
          // `stepReactions` is deliberately absent, following TrialPenalty
          // rather than FiveASide. It is what sends team-mates chasing a
          // loose ball, and a drill that judges YOUR strike should not be
          // decided by somebody following it in — the more so because
          // neither dead-ball scenario draws those men, so a goal one of
          // them scored would arrive from nowhere on screen. It makes a
          // team-mate finish rare rather than impossible; `finishAttempt`'s
          // own guard is what actually handles the rest.
          for (let i = 0; i < 3; i++) {
            const h = dt / 3;
            // The wall jumps as the ball is struck. A no-op for anything that
            // is not a free kick, so it is called unconditionally rather than
            // branching on the scenario kind.
            stepDefenders(sc, h, sc.player, false, ball);
            stepKeeper(sc, h);
            const res = stepBall(ball, sc, rngRef.current, h);
            if (res) {
              outcomeRef.current = res;
              settle = 0;
              // The outcome is decided; the ball must not stop dead on the
              // frame it was decided. `settling` is what gates `settleBall`
              // below, and the engine only ever sets it itself for a loose
              // ball won by a defender.
              if (!ball.overBar) ball.settling = true;
              break;
            }
          }
          if (!outcomeRef.current && flightTRef.current > FLIGHT_TIMEOUT) {
            outcomeRef.current = "short";
            settle = 0;
            ball.settling = true;
          }
        } else {
          if (ball.settling) settleBall(ball, dt, sc);
          if (ball.overBar) stepBallPastBar(ball, dt);
          // The other post-outcome branch, and the same fix — see above. A
          // save, a post and a ball flying over all leave him mid-dive too.
          if (!sc.keeper.done) stepKeeper(sc, dt);
        }
        if (outcomeRef.current) {
          settle += dt;
          if (settle > SETTLE_BEFORE_BANNER && !resolvedRef.current) {
            resolvedRef.current = true;
            finishAttempt(outcomeRef.current);
          }
        }
      } else if (phaseRef.current === "result") {
        // Keep everything moving through the beat after the outcome, so a
        // goal is SEEN going in and a keeper is not frozen mid-dive.
        const ball = ballRef.current;
        if (ball) {
          if (ball.inNet) stepBallInNet(ball, dt);
          else if (ball.overBar) stepBallPastBar(ball, dt);
          else if (ball.settling) settleBall(ball, dt, sc);
        }
        if (!sc.keeper.done) stepKeeper(sc, dt);
      }

      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishAttempt]);

  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current, sc = scRef.current;
    if (!c || !wrap || !sc) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The camera is fixed for the whole attempt — framed off where the ball
    // STARTS, never off where it is now, so the shot holds still while the ball
    // moves inside it instead of chasing it toward goal. Recomputed only when
    // the canvas changes size or a new rep sets the ball down somewhere else.
    const want = `${cssW}x${cssH}:${sc.ball.x.toFixed(2)},${sc.ball.y.toFixed(2)}`;
    if (camKeyRef.current !== want) {
      camKeyRef.current = want;
      camRef.current = strikeCamera(sc, sc.ball, cssW, cssH);
    }
    const camera = camRef.current ?? strikeCamera(sc, sc.ball, cssW, cssH);

    const dragging = phaseRef.current === "aim" && draggingRef.current ? dragRef.current : null;
    paintTrialScene(ctx, sc, {
      W: cssW, H: cssH,
      camera,
      ball: ballRef.current,
      drag: dragging,
      power: dragging ? powerFrom(dragging, sc.ball, camera) : 0,
      faceStyle: faceStyleRef.current,
      fakeFaceStyle: fakeFaceStyleRef.current,
    });
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/80">{title}</span>
        <span className="text-[11px] font-black tabular-nums text-white/60">
          {Math.min(rep + 1, reps)} / {reps}
        </span>
      </div>
      {subtitle && (
        <div className="mb-1.5 text-[11px] font-bold text-white/55">{subtitle(rep)}</div>
      )}

      {/* ── A phone-shaped box, not a frame-shaped one ──
          5:8 with no height cap ran 108 px off the bottom of an iPhone 13 —
          measured, not guessed, and the first screen of a new career. The
          same fix the five-a-side already made: keep the box a comfortable
          shape, cap it against the viewport, and let the camera decide what
          of the pitch is in it. `strikeCamera` shows whatever shape this
          ends up being, so the cap can bite without cropping anything. */}
      <div
        ref={wrapRef}
        className="relative mx-auto aspect-[4/5] max-h-[52vh] w-full overflow-hidden rounded-xl border border-white/15"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* The hint sits in the strip a drag never reaches: full power only
            ever needs `dragForFullPower` (about 14 %) of the canvas height,
            and it is pointer-transparent besides. */}
        {phase === "aim" && (
          rep === 0 && teach && !teachDone
            ? (
              <TeachCard
                headline={teach.headline}
                lines={teach.lines}
                onDismiss={dismissTeach}
              />
            )
            : (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
                <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
                  {hint}
                </p>
              </div>
            )
        )}

        {phase === "contact" && aim && (
          // The three contact badges and the line under them: the strike
          // screen's own tutorial copy, which has a prop for exactly this
          // and — checked at every call site — has never once been passed
          // by anybody. First rep of the stage only; by the second you have
          // done it once — and not at all for somebody who has already
          // dismissed this drill's teaching, since the contact badges are the
          // same lesson one screen later.
          <ContactBall
            power={aim.power}
            onContact={handleContact}
            tutorial={rep === 0 && !teachDone}
          />
        )}

        {phase === "result" && resultText && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-40 flex justify-center px-4">
            <div className="rounded-xl bg-black/65 px-4 py-2 text-center text-lg font-black text-amber-300">
              {resultText}
            </div>
          </div>
        )}
      </div>

      {/* What each attempt was worth, as a row of pips — the mean of these is
          the stage's whole score, so seeing them fill up is seeing the score
          being built rather than a number arriving from nowhere at the end. */}
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: reps }, (_, i) => {
          const q = scoresRef.current[i];
          return (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              {q !== undefined && (
                <div
                  className={`h-full ${q >= 0.55 ? "bg-emerald-400" : q >= 0.3 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(8, q * 100)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── The penalties stage itself ─────────────────────────────────────────────

export interface TrialPenaltiesProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
}

/**
 * One rep's scenario, exported so a test can drive the real thing through the
 * engine rather than re-deriving it — a copy of these lines in the test would
 * pass happily while this one was wrong.
 */
export function buildPenaltyScenario(
  trial: TrialProgress, rep: number, rng: () => number,
): Scenario {
  const setup = penaltySetup(trial, rep);
  // The engine's own penalty, with the trial's keeper in it: strength and
  // lean both come from `penaltySetup`, everything else — the spot, the two
  // men on the edge of the D, the camera — is the picture a real match
  // already builds for a penalty.
  const sc = buildScenario("penalty", rng, setup.keeperStrength, 60, 55);
  initDefenders(sc, rng);
  sc.ball = { ...setup.ball };

  // He is standing off centre before you have even started your run-up —
  // which is the whole decision the stage asks for. Moving `startX` as well
  // as `x` is what makes it a real commitment rather than a pose: his dive is
  // bounded relative to where he started (KEEPER_LATERAL_MAX in the engine),
  // so leaning one way genuinely shuts that corner and genuinely opens the
  // other.
  const lean = clamp(setup.keeperLean, -1, 1) * PENALTY_LEAN_M;
  const kx = clamp(sc.keeper.x + lean, POST_L - 2.5, POST_R + 2.5);
  sc.keeper.x = kx;
  sc.keeper.startX = kx;
  sc.keeper.targetX = kx;
  return sc;
}

export default function TrialPenalties({
  trial, onDone, skills = { power: 55, technique: 55 },
}: TrialPenaltiesProps) {
  const build = useCallback(
    (rep: number, rng: () => number) => buildPenaltyScenario(trial, rep, rng),
    [trial],
  );

  return (
    <StrikeStage
      reps={REPS.penalties}
      build={build}
      skills={skills}
      seed={trial.seed}
      drill="penalties"
      title="Penalties"
      hint="Drag back from the ball to aim, and pull further for more power."
      teach={{
        headline: "Drag back from the ball, then let go.",
        lines: [
          "Pull further for more power. The arrow is where it is going.",
          "Watch the keeper before you strike it — he has already guessed.",
        ],
      }}
      subtitle={rep => {
        const s = penaltySetup(trial, rep);
        // ── It never names the side ──
        //
        // It used to: "He has gone early to your right." Between that line and
        // a keeper drawn visibly off centre, the stage was not a penalty at
        // all — it was a caption telling you which way to shoot, five times in
        // a row. And because the lean GREW with difficulty, the harder the day
        // the louder the caption; a hard trial was the easy one.
        //
        // What is left says how much there is to SEE, never what it is. That
        // is real information a taker has — you can tell a keeper who has
        // committed from one who has not — and it tells you which skill this
        // kick is asking for, without answering it for you. The lean itself
        // now shrinks as the trial hardens (PENALTY_TELL_EASY/HARD,
        // trialStages.ts), so at the top of the ladder there genuinely is
        // almost nothing to read and this line says so.
        const tell = Math.abs(s.keeperLean);
        return tell > 0.55 ? "He's committed early. Read him."
          : tell > 0.22 ? "He's shading one way. Look hard."
          : "He hasn't shown you a thing.";
      }}
      onDone={onDone}
    />
  );
}
