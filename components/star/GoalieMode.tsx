"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickShot, resolveDive, liveDiveState, streakMultiplier, shotLabel,
  MAX_REACH_X, MAX_REACH_Z, KEEPER_SET_X, KEEPER_SET_Z,
  type GoalieShot, type DiveResult,
} from "@/lib/star/goalieMode";
import { cameraFor, project, type FpCamera } from "@/lib/star/firstPersonView";
import { GOAL_W, GOAL_H, NET_DEPTH } from "@/lib/star/pitch";
import { drawFigureAt, drawKeeperAt, BALL_MIN_R, type FigureLook, type BodyPose } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { formatMoney } from "@/lib/star/money";
import { mulberry32 } from "@/lib/star/season";

/**
 * GOALIE MODE — "you're the goalie... camera facing the player taking the
 * shot... your cursor or finger is like your gloves... a dive takes time...
 * ideal to dive right before or right as the shot is taken."
 *
 * The interactive/physics layer (`lib/star/goalieMode.ts`) is the part that
 * must be exactly right and is measured, tested and locked in separately —
 * see that file's own header. Everything in THIS file is presentation and
 * input.
 *
 * ── Round 3: real play feedback, not a guess — a real bug, a reversed
 * design call, and real shot variety ──
 *
 * The previous round's three-stage push-in/reveal camera (built against a
 * reference video) was reported back plainly as bad, not a taste call:
 * "the weird zooming in thing sucks". Separately, a real, reproducible bug
 * on PC: "the aim/cursor thing is very offset and not at all on my
 * cursor". Both trace to the same root cause and share the same fix.
 *
 * `pointerToWorld`'s inversion of `project()` is only the exact algebraic
 * inverse when the camera is dead level (`pitch = 0`) — the previous
 * camera used `pitch = 0.06`. With a real pitch, `project()`'s depth term
 * mixes in the TARGET'S OWN HEIGHT (`relZ`), which the inversion never
 * accounted for. Worked through by hand and checked numerically at the old
 * constants: aiming at a genuine low corner (z = 0.3m) inverted back to
 * roughly z = 0.73m — a ~0.43m miss, about a fifth of the goal's own
 * playable height, on every single aim. That is exactly "very offset".
 *
 * Fixed by dropping the pitch to exactly 0, which makes the SAME inversion
 * formula provably exact again (at pitch = 0, `project()`'s depth term is
 * just the camera's own distance, no `z` involved at all — precisely what
 * the inversion already assumed). And by dropping the push-in/reveal
 * transition entirely: one fixed, wide shot for the whole sequence, so the
 * goal, both posts and the keeper's own full reach are always on screen to
 * judge a shot against — never something that only resolves once a camera
 * move has finished. See `CAM_Y`'s own comment for the framing math.
 *
 * Also requested directly, a real batch of new shot variety: "long shot,
 * near post shot, far post shot, header from a cross, volley, first time
 * shot... curve, varying power/speed, placement". `goalieMode.ts` already
 * had curl/header/volley and varying pace/placement; this round adds a new
 * `first_time` kind (a firm, rushed strike off an already-moving ball,
 * distinct from a controlled drive), a `strikerSide` roll independent of
 * the tell (so a shot is sometimes a tucked-in near-post finish and
 * sometimes a genuine cross-body far-post one, not always the same shape),
 * and `shotLabel()` — a real on-screen tag ("HEADER FROM A CROSS", "FAR
 * POST", "LONG RANGE") so the variety is something you consciously notice
 * shot to shot, not just something the physics knows about.
 *
 * ── Round 4: it didn't look like the game, a real defensive presence, and
 * two more shot types ──
 *
 * Reported directly, after round 3 shipped: "make it obvs fit the game and
 * look like its in game... for some reason i dont even see any green lol
 * wheres the pitch it looks like im on an ice rink... obvs other attackers
 * and defenders should be in there even if they arent involved... also two
 * more to add to the potential shot types... penalty and free kick."
 *
 * The grass bug was real, not a taste note. The ground quad's near edge was
 * `cam.y - 0.05` — a near-edge DEPTH of a flat 0.05m regardless of what
 * CAM_Y actually is, permanently inside `project()`'s own NEAR=0.35 clip.
 * Both near corners always came back null, so `corners.every((p) => p)`
 * was always false and the ENTIRE grass fill — stripes, goal line, all of
 * it — silently never drew. Fixed by computing the real depth that
 * projects to the canvas's own bottom row, the same way
 * `firstPersonView.ts`'s own `groundAt()` does, instead of a guessed
 * offset — see the fix's own comment for the exact derivation.
 *
 * Decorative attackers and defenders (`buildExtras`/`drawExtras`) are
 * genuinely new this round — real goalmouth positions, a gentle idle sway
 * and leg-shuffle so they read as alive, deliberately visual-only: they
 * make the picture harder to read without yet touching the ball, an
 * honest, named next step (see `ExtraPlayer`'s own doc for why, and why a
 * penalty and a free kick each skip them for their own real reasons).
 *
 * `penalty` and `free_kick` are new `ShotKind`s in `goalieMode.ts` — a
 * penalty struck from dead in front of goal with a real, disguise-only
 * tell (no defenders, no angle, nothing else to read), and a free kick
 * with a real IFAB-distance defensive wall (`shot.wall`) that a shot
 * genuinely has to go around or over, rendered here with its own reactive
 * jump timed off the strike (`wallLiftAt`) and drawn in real depth order
 * against the ball rather than a fixed layer.
 *
 * ── World coordinates, local to this file only ──
 *
 * y = 0 is the goal line, where the keeper stands set. Positive y is BEHIND
 * it (where the camera sits); negative y is OUT on the pitch (the striker,
 * at `y = -shot.startY`). x/z match `goalieMode.ts`'s own goal-local
 * convention (x = 0 centre, negative = keeper's left; z = height). The
 * camera uses `firstPersonView.ts`'s DEFAULT forward ({0,-1}), which maps
 * to the intuitive "positive world x = screen right" with no sign-flipping
 * — see `diveSideFor` below for the one place that still needed working out
 * by hand.
 *
 * ── Input: drag to aim, release commits — not tap-to-commit ──
 *
 * Unchanged this round, and not the cause of the offset — see above for
 * that. Track the live pointer position from pointerDOWN through every
 * pointerMOVE (a swipe, on touch; a hover, on a mouse — both feed the same
 * live reticle), and commit only on pointerUP, at wherever the pointer
 * ends up. A plain, no-drag click still commits exactly where clicked.
 *
 * ── One honestly-scoped simplification, unchanged ──
 *
 * "Crossed into and headering, passed into and first-time shooting" is
 * covered by a delivery ball arriving to the striker before he strikes
 * (header/volley/first_time kinds only) rather than a full second,
 * animated crosser — a second full figure with its own run and its own
 * real position would be a real, separate build; the delivery ball alone
 * still reads the moment clearly (a ball arrives to him, THEN he strikes)
 * without doubling the scope of this pass.
 */

interface GoalieModeProps {
  bank: number;
  bet: number;
  onSetBank: (n: number) => void;
  onExit: () => void;
  onChangeBet: (direction: 1 | -1) => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Camera: one fixed shot ───────────────────────────────────────────────
//
// Dead level (`pitch` left at its default 0 — see the file header for why
// that's not just simpler but the actual bug fix) and as close as the goal
// posts themselves allow without clipping. Worked out directly from
// `project()`'s own formula, not guessed: at y=0, pitch=0, a post at
// x=±GOAL_W/2 projects to `px = W/2 ± (GOAL_W/2)·FOCAL_K·W/CAM_Y`; solving
// for the largest CAM_Y that still clips would leave zero safety margin, so
// CAM_Y=6.8 was chosen to leave a real ~1.5% margin either side (up from
// the old wide shot's ~2.9% at CAM_Y=7 — genuinely tighter, not just
// differently framed) while never risking a post running off-screen on a
// slow phone's rounding. The canvas itself is also less tall than before
// (aspect ratio below) — the same goal, at the same pixel width, reads
// bigger in a shorter frame with less empty sky above it.
const CAM_Y = 6.8;
const CAM_EYE = 1.85;

const FIGURE_R_M = 1.05; // metres — matches fiveASide/render.ts's own FIGURE_R
const KEEPER_KIT: FigureLook = { shirt: "#eab308", shorts: "#111827", trim: "#111827", skin: "#c68642" };
const STRIKER_KIT: FigureLook = { shirt: "#dc2626", shorts: "#ffffff", trim: "#ffffff", skin: "#c68642" };
/** Your own outfield teammates — decorative defenders AND the free-kick
 *  wall (see buildExtras/wallLiftAt) are both your own side, so both reuse
 *  this one kit. Deliberately a third colour from both KEEPER_KIT (a
 *  goalkeeper's real kit is always distinct from his own outfielders') and
 *  STRIKER_KIT (the opposing side), so a glance at the shirt colour alone
 *  always says whose man that is. */
const DEFENDER_KIT: FigureLook = { shirt: "#1d4ed8", shorts: "#111827", trim: "#ffffff", skin: "#c68642" };

function buildCamera(w: number, h: number): FpCamera {
  return cameraFor({ x: 0, y: CAM_Y }, w, h, { eye: CAM_EYE });
}

/**
 * `KeeperPose.dive` is documented (fiveASide/render.ts) as "his right, your
 * left" for -1 — written for a camera FACING the keeper. Ours sits BEHIND
 * him looking the same way he does, so that framing doesn't apply here;
 * worked out instead from the actual rotation `drawFigureAt` applies
 * (`facing = lean`, and canvas's own ctx.rotate is clockwise for positive
 * angle on a y-down screen): a positive lean swings his head toward +x,
 * which is screen-right under this file's own camera. Since a positive
 * world x is ALSO screen-right here (the default camera forward), passing
 * the normalized reach offset straight through, unflipped, makes his lean
 * point the same way his body has actually moved. If a save ever visibly
 * leans the wrong way, this is the line to re-check first — not the sign of
 * reachX itself.
 */
function diveSideFor(reachX: number): number {
  return clamp((reachX - KEEPER_SET_X) / MAX_REACH_X, -1, 1);
}

const FACE_STYLE = DEFAULT_FACE_STYLE;
const FAKE_FACE_STYLE = DEFAULT_FAKE_FACE_STYLE;

/**
 * Decorative attackers and defenders — reported directly: "obvs other
 * attackers and defenders should be in there even if they arent involved,
 * maybe even just to move around and make it difficult to see or predict
 * shots." A real goalmouth is never just the two of you.
 *
 * Deliberately visual only this round, same honest scope as `shot.wall`
 * (see its own doc in goalieMode.ts): they stand around real goalmouth
 * positions, sway and shuffle so the picture reads as alive rather than a
 * frozen diagram, and genuinely add clutter around the striker's own run-up
 * and tell — but they do not yet touch the ball (block, deflect, or
 * otherwise react to it), which the same doc names as a real, honest next
 * step rather than something quietly half-built here.
 *
 * Skipped entirely for a penalty (IFAB actually requires everyone but the
 * keeper and striker to stand outside the box, 9.15m back — an EMPTY box is
 * the real picture, not a missing one) and for a free kick (the wall
 * already IS the other players standing in this one; stacking generic
 * extras on top of it risks burying the aim target in clutter, which is a
 * fairness problem, not a difficulty one).
 */
interface ExtraPlayer {
  baseX: number; baseY: number; team: "def" | "att";
  driftAmp: number; driftFreq: number; phase: number;
}
const EXTRA_SPOTS: { x: number; y: number; team: "def" | "att" }[] = [
  { x: -3.2, y: -1.5, team: "def" }, { x: 3.1, y: -1.8, team: "def" },
  { x: -5.6, y: -3.3, team: "att" }, { x: 5.3, y: -2.7, team: "att" },
  { x: -1.2, y: -4.7, team: "def" }, { x: 1.7, y: -5.5, team: "att" },
];
function buildExtras(kind: GoalieShot["kind"], rng: () => number): ExtraPlayer[] {
  if (kind === "penalty" || kind === "free_kick") return [];
  return EXTRA_SPOTS.map((s) => ({
    baseX: s.x, baseY: s.y, team: s.team,
    driftAmp: 0.3 + rng() * 0.35,
    driftFreq: 0.2 + rng() * 0.18,
    phase: rng() * Math.PI * 2,
  }));
}

/** A real wall jumps reactively, right as the ball is struck — never held
 *  up in advance. One shared eased arc, metres, consumed as `FigureLook`'s
 *  own documented free-kick-wall `lift`. */
const WALL_JUMP_WINDOW = 0.5;
function wallLiftAt(t: number, strikeAtT: number): number {
  const dt = t - strikeAtT;
  if (dt < 0 || dt > WALL_JUMP_WINDOW) return 0;
  return Math.sin((dt / WALL_JUMP_WINDOW) * Math.PI) * 0.45;
}

type Phase = "stake" | "facing" | "resolved" | "conceded" | "cashout";

interface ShotAnim {
  shot: GoalieShot;
  seqStart: number; // performance.now()/1000 at which this shot's t=0 is
  shootX: number;   // striker's final shooting spot, world x
  runFromX: number;
  runFromY: number;
  extras: ExtraPlayer[];
  commit: { commitT: number; targetX: number; targetZ: number } | null;
  resolvedAt: number | null; // seconds (seqStart-relative) once the outcome is known
  result: DiveResult | null;
}

function archHeightFor(kind: GoalieShot["kind"]): number {
  // free_kick shares curl's own higher loop — it's the same curled, lifted
  // technique, just from further out and with a wall to clear on top of it.
  if (kind === "curl" || kind === "free_kick") return 0.65;
  if (kind === "volley") return 0.5;
  if (kind === "header") return 0.25; // struck downward off the head, not looped
  if (kind === "first_time") return 0.3; // rushed, flatter than a shaped drive
  return 0.4; // drive, penalty — a driven, fairly direct strike either way
}
function originZFor(kind: GoalieShot["kind"]): number {
  if (kind === "header") return 2.0;
  if (kind === "volley") return 1.05;
  if (kind === "first_time") return 0.5; // met early, mid-shin to knee height
  return 0.28; // drive, curl, penalty, free_kick — struck clean off the deck
}

/** Ball position at any instant of the sequence — during the striker's own
 *  possession (pre-strike, resting at his feet / arriving as a delivery for
 *  header/volley) and in flight afterward. Pure function of the shot and
 *  elapsed time so the draw loop never has to track ball state separately. */
function ballWorldAt(anim: ShotAnim, t: number): { x: number; y: number; z: number } {
  const { shot } = anim;
  if (t < shot.strikeAtT) {
    if (shot.kind === "header" || shot.kind === "volley" || shot.kind === "first_time") {
      // A delivery arriving from a wide flank, landing exactly at the
      // strike — purely cosmetic, see the file header's own scope note.
      const deliveryStart = Math.max(0, shot.strikeAtT - 0.9);
      const f = clamp((t - deliveryStart) / Math.max(0.001, shot.strikeAtT - deliveryStart), 0, 1);
      const fromX = anim.shootX + (shot.tellSide > 0 ? -1 : 1) * 6;
      const fromY = -Math.max(2, shot.startY - 4);
      return {
        x: fromX + (anim.shootX - fromX) * f,
        y: fromY + (-shot.startY - fromY) * f,
        z: 0.3 + Math.sin(f * Math.PI) * 2.4,
      };
    }
    // Resting at the striker's feet until he strikes it.
    return { x: anim.shootX, y: -shot.startY, z: 0.15 };
  }

  if (t >= shot.arriveAtT && anim.result) {
    // Past the crossing instant — settle toward what actually happened
    // rather than freezing dead on the goal line, so a save and a goal
    // read as visibly different outcomes, not the same frozen ball. Reads
    // `anim.result` directly (set by `resolveIfDue` earlier in the same
    // frame, always before this runs) rather than recomputing anything.
    const settleF = clamp((t - shot.arriveAtT) / 0.5, 0, 1);
    if (anim.result.saved) {
      // Caught/parried right where the keeper actually got to, not the
      // shot's original target — the two are close (that's what "saved"
      // means) but rarely identical.
      return {
        x: shot.targetX + (anim.result.reachX - shot.targetX) * settleF,
        y: 0,
        z: Math.max(0, shot.targetZ + (anim.result.reachZ - shot.targetZ) * settleF),
      };
    }
    // Continues on past the line rather than stopping dead.
    return { x: shot.targetX, y: settleF * 0.7, z: Math.max(0, shot.targetZ - settleF * 1.4) };
  }

  const f = clamp((t - shot.strikeAtT) / Math.max(0.001, shot.flightT), 0, 1);
  const x0 = anim.shootX, y0 = -shot.startY, z0 = originZFor(shot.kind);
  const x1 = shot.targetX, y1 = 0, z1 = shot.targetZ;
  const bendDir = shot.tellSide > 0 ? -1 : 1;
  const curlBend = shot.curl * 1.6 * Math.sin(f * Math.PI) * bendDir;
  return {
    x: x0 + (x1 - x0) * f + curlBend,
    y: y0 + (y1 - y0) * f,
    z: Math.max(0, z0 + (z1 - z0) * f + Math.sin(f * Math.PI) * archHeightFor(shot.kind)),
  };
}

export default function GoalieMode({ bank, bet, onSetBank, onExit, onChangeBet }: GoalieModeProps) {
  const [phase, setPhase] = useState<Phase>("stake");
  const [streak, setStreak] = useState(0);
  const [lastPayout, setLastPayout] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 360, h: 480 });
  const rngRef = useRef<(() => number) | null>(null);
  const animRef = useRef<ShotAnim | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stakedRef = useRef(0);

  // ── Resize the backing canvas to its container ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const applySize = (boxWidth: number) => {
      const w = Math.max(240, boxWidth);
      const h = Math.max(320, w * 1.15);
      sizeRef.current = { w, h };
      const c = canvasRef.current;
      if (c) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
    };
    // Applied once, synchronously, from the layout the DOM already has —
    // otherwise the canvas keeps its browser-default 300×150 backing store
    // for however long it takes ResizeObserver's own first (always async)
    // callback to land, and that first real frame renders at the wrong
    // aspect entirely.
    applySize(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) applySize(box.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Start a brand-new shot sequence — the striker steps up, the timeline
   *  resets to t=0, no commit yet. */
  const beginShot = useCallback((s: number) => {
    if (!rngRef.current) rngRef.current = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const shot = pickShot(s, rngRef.current);
    // A real penalty is struck from dead in front of goal — never offset to
    // one side the way an open-play strike naturally is.
    const shootX = shot.kind === "penalty"
      ? 0
      : clamp(shot.strikerSide * (1.1 + Math.min(1.6, Math.abs(shot.targetX) * 0.32)), -3.2, 3.2);
    animRef.current = {
      shot,
      seqStart: performance.now() / 1000,
      shootX,
      runFromX: shootX - shot.strikerSide * 2.2,
      runFromY: -(shot.startY + 3.5),
      extras: buildExtras(shot.kind, rngRef.current),
      commit: null,
      resolvedAt: null,
      result: null,
    };
    setPhase("facing");
  }, []);

  const startRun = useCallback(() => {
    if (bank < bet) return;
    onSetBank(bank - bet);
    stakedRef.current = bet;
    setStreak(0);
    setLastPayout(0);
    beginShot(0);
  }, [bank, bet, onSetBank, beginShot]);

  const keepGoing = useCallback(() => beginShot(streak), [beginShot, streak]);

  const cashOut = useCallback(() => {
    const payout = Math.round(stakedRef.current * streakMultiplier(streak));
    onSetBank(bank + payout);
    setLastPayout(payout);
    setPhase("cashout");
  }, [bank, onSetBank, streak]);

  // ── Resolve the current shot once the ball reaches the goal line ──
  const resolveIfDue = useCallback((t: number) => {
    const anim = animRef.current;
    if (!anim || anim.result) return;
    if (t < anim.shot.arriveAtT) return;
    const result = resolveDive(anim.shot, anim.commit);
    anim.result = result;
    anim.resolvedAt = t;
    const nextStreak = streak + 1;
    window.setTimeout(() => {
      if (result.saved) {
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
        setPhase("resolved");
      } else {
        setPhase("conceded");
      }
    }, 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  // ── Input: a live reticle from the moment you touch/hover, commit only
  // on release. Correct because the camera is dead level (pitch=0) — see
  // the file header for the bug a nonzero pitch caused here before. ──
  const pointerToWorld = useCallback((clientX: number, clientY: number): { x: number; z: number } | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const cam = buildCamera(sizeRef.current.w * dpr, sizeRef.current.h * dpr);
    // The goal-line plane (y=0) sits at a constant depth (CAM_Y) from this
    // camera regardless of px/py, since forward is purely along y and pitch
    // is 0 — see the file header. This is the exact inverse of project()
    // for a camera with no yaw and no pitch, which this one now always is.
    const u = (px - cam.W / 2) * CAM_Y / cam.focal;
    const z = cam.eye - (py - cam.horizon) * CAM_Y / cam.focal;
    return { x: clamp(u, -MAX_REACH_X, MAX_REACH_X), z: clamp(z, 0, MAX_REACH_Z) };
  }, []);

  const commitAt = useCallback((clientX: number, clientY: number) => {
    const anim = animRef.current;
    if (!anim || anim.commit || anim.result) return;
    const w = pointerToWorld(clientX, clientY);
    if (!w) return;
    const t = performance.now() / 1000 - anim.seqStart;
    anim.commit = { commitT: t, targetX: w.x, targetZ: w.z };
  }, [pointerToWorld]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (phase !== "facing") return;
    const anim = animRef.current;
    if (!anim || anim.commit || anim.result) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [phase]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (phase === "facing") commitAt(e.clientX, e.clientY);
  }, [phase, commitAt]);

  const handlePointerCancel = useCallback(() => {
    // The OS interrupted the touch (a call, a system gesture) — release
    // without committing, never fire a dive at wherever it happened to be.
    draggingRef.current = false;
  }, []);

  // ── Draw loop ──
  useEffect(() => {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const { width: W, height: H } = c;
      const anim = animRef.current;
      const t = anim ? performance.now() / 1000 - anim.seqStart : 0;
      const cam = buildCamera(W, H);
      if (anim && phase === "facing") resolveIfDue(t);

      renderScene(ctx, cam, W, H, anim, t, phase, pointerRef.current, pointerToWorld);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, resolveIfDue, pointerToWorld]);

  const potentialPayout = Math.round(stakedRef.current * streakMultiplier(streak));
  const nextPayout = Math.round(stakedRef.current * streakMultiplier(streak + 1));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-950 to-emerald-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-1 mb-2">
          <button onClick={onExit} className="px-2 py-2 bg-gray-700 rounded font-black text-xs">← Menu</button>
          <div className="flex-1 grid grid-cols-3 gap-1">
            <div className="bg-gray-700 rounded px-2 py-1.5 flex flex-col items-center justify-center border border-gray-600">
              <span className="font-black text-[9px] text-white/70">BANK</span>
              <span className="font-black text-yellow-300 text-xs">★{formatMoney(bank)}</span>
            </div>
            <div className="bg-gray-700 rounded px-2 py-1.5 flex flex-col items-center justify-center border border-gray-600">
              <span className="font-black text-[9px] text-white/70">STREAK</span>
              <span className="font-black text-emerald-400 text-xs">{streak}</span>
            </div>
            <div className="bg-gray-700 rounded px-2 py-1.5 flex flex-col items-center justify-center border border-gray-600">
              <span className="font-black text-[9px] text-white/70">MULT</span>
              <span className="font-black text-fuchsia-400 text-xs">{streakMultiplier(streak).toFixed(2)}x</span>
            </div>
          </div>
        </div>

        <div ref={wrapRef} className="relative w-full rounded-2xl overflow-hidden border-2 border-gray-700" style={{ aspectRatio: "1 / 1.15" }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />
          {phase === "facing" && animRef.current && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <div className="bg-black/60 rounded-full px-3 py-0.5 text-[9px] font-black text-cyan-300 tracking-wide">
                {shotLabel(animRef.current.shot)}
              </div>
              <div className="bg-black/50 rounded-full px-3 py-1 text-[10px] font-black text-white/90">
                DRAG TO AIM · RELEASE TO DIVE
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          {phase === "stake" && (
            <div className="space-y-2">
              <div className="bg-gray-800 rounded-xl px-3 py-2 flex items-center justify-between border border-gray-700">
                <span className="font-black text-xs text-white/80">Stake</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onChangeBet(-1)} className="text-red-400 font-black text-base px-1">▼</button>
                  <span className="font-black text-yellow-300 text-sm">★{formatMoney(bet)}</span>
                  <button onClick={() => onChangeBet(1)} className="text-emerald-400 font-black text-base px-1">▲</button>
                </div>
              </div>
              <button
                disabled={bank < bet}
                onClick={startRun}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl font-black text-lg"
              >
                START SAVE STREAK
              </button>
              <p className="text-center text-[11px] text-white/60 font-bold px-2">
                Every save stacks the payout. Miss one and the stake's gone — cash out any time.
              </p>
            </div>
          )}

          {phase === "resolved" && (
            <div className="space-y-2">
              <div className="bg-emerald-900/60 border border-emerald-600 rounded-xl px-3 py-2 text-center">
                <div className="font-black text-emerald-300 text-sm">
                  {animRef.current?.shot.offTarget ? "OFF TARGET —" : "SAVED! —"} Streak {streak}
                </div>
                <div className="font-black text-yellow-300 text-xs">Cash out now: ★{formatMoney(potentialPayout)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={cashOut} className="py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-black text-sm">
                  CASH OUT
                </button>
                <button onClick={keepGoing} className="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm">
                  KEEP GOING ★{formatMoney(nextPayout)}
                </button>
              </div>
            </div>
          )}

          {phase === "conceded" && (
            <div className="space-y-2">
              <div className="bg-red-900/60 border border-red-600 rounded-xl px-3 py-2 text-center">
                <div className="font-black text-red-300 text-sm">CONCEDED — streak ended at {streak}</div>
                <div className="font-black text-white/70 text-xs">Lost the ★{formatMoney(stakedRef.current)} stake</div>
              </div>
              <button onClick={() => setPhase("stake")} className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-black text-lg">
                BACK TO STAKE
              </button>
            </div>
          )}

          {phase === "cashout" && (
            <div className="space-y-2">
              <div className="bg-yellow-900/60 border border-yellow-600 rounded-xl px-3 py-2 text-center">
                <div className="font-black text-yellow-300 text-sm">Cashed out at streak {streak}</div>
                <div className="font-black text-white text-xs">★{formatMoney(lastPayout)}</div>
              </div>
              <button onClick={() => setPhase("stake")} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-lg">
                PLAY AGAIN
              </button>
            </div>
          )}

          {bestStreak > 0 && phase === "stake" && (
            <p className="text-center text-[11px] text-white/50 font-bold mt-2">Best streak this session: {bestStreak}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rendering ───────────────────────────────────────────────────────────

/** A fixed, deterministic crowd speckle pattern — generated once at module
 *  load (a plain LCG, not Math.random) rather than every frame, so the
 *  stands read as a real packed crowd instead of flat silhouette blocks,
 *  and never flicker/reshuffle between frames. */
const CROWD_SEATS: { fx: number; fy: number; c: string }[] = (() => {
  const colors = ["#e2e8f0", "#dc2626", "#2563eb", "#f59e0b", "#e2e8f0", "#e2e8f0", "#16a34a", "#e2e8f0"];
  let s = 987654321;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const seats: { fx: number; fy: number; c: string }[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 40; col++) {
      seats.push({
        fx: col / 40 + (rnd() - 0.5) * 0.018,
        fy: row / 6 + (rnd() - 0.5) * 0.15,
        c: colors[Math.floor(rnd() * colors.length)],
      });
    }
  }
  return seats;
})();

function drawStadium(ctx: CanvasRenderingContext2D, cam: FpCamera, W: number, H: number): void {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2c4258");
  sky.addColorStop(1, "#7d97a5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const horizonPx = cam.horizon - Math.tan(cam.pitch ?? 0) * cam.focal;
  const roofTop = Math.max(0, horizonPx - H * 0.30);
  const roofBottom = Math.max(0, horizonPx - H * 0.10);
  const crowdTop = Math.max(0, horizonPx - H * 0.09);

  // A curved stand roof, the reference's own single most distinctive shape
  // — a shallow blue arc, not a flat rectangle.
  ctx.fillStyle = "#1b4a6b";
  ctx.beginPath();
  ctx.moveTo(0, roofBottom);
  ctx.quadraticCurveTo(W / 2, roofTop, W, roofBottom);
  ctx.lineTo(W, roofBottom + H * 0.02);
  ctx.quadraticCurveTo(W / 2, roofTop + H * 0.02, 0, roofBottom + H * 0.02);
  ctx.closePath();
  ctx.fill();

  // Floodlight towers either side, rising off the roofline.
  const drawFloodlight = (fx: number) => {
    const x = W * fx;
    const baseY = roofTop + H * 0.01;
    const topY = roofTop - H * 0.09;
    ctx.strokeStyle = "rgba(30,35,45,0.85)";
    ctx.lineWidth = Math.max(2, W * 0.012);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, topY);
    ctx.stroke();
    const gridW = W * 0.09, gridH = H * 0.045;
    ctx.fillStyle = "rgba(20,24,32,0.9)";
    ctx.fillRect(x - gridW / 2, topY - gridH, gridW, gridH);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gx = x - gridW / 2 + (gridW * i) / 4;
      ctx.beginPath(); ctx.moveTo(gx, topY - gridH); ctx.lineTo(gx, topY); ctx.stroke();
    }
  };
  drawFloodlight(0.12);
  drawFloodlight(0.88);

  // Crowd — real speckled seats, not a flat silhouette.
  const crowdH = crowdTop - roofBottom - H * 0.01;
  if (crowdH > 2) {
    ctx.fillStyle = "#1a3324";
    ctx.fillRect(0, roofBottom + H * 0.01, W, crowdH + H * 0.01);
    const seatSize = Math.max(2, W * 0.011);
    for (const seat of CROWD_SEATS) {
      ctx.fillStyle = seat.c;
      ctx.fillRect(seat.fx * W, roofBottom + H * 0.01 + seat.fy * crowdH, seatSize, seatSize * 1.3);
    }
  }

  // A bright hoarding strip right at pitch-side — the reference's own
  // sponsor-board band, alternating colour blocks rather than plain text.
  const hoardH = Math.max(6, H * 0.022);
  const hoardColors = ["#dc2626", "#2563eb", "#f59e0b", "#16a34a", "#7c3aed"];
  const hoardW = W / hoardColors.length;
  for (let i = 0; i < hoardColors.length; i++) {
    ctx.fillStyle = hoardColors[i];
    ctx.fillRect(i * hoardW, crowdTop, hoardW, hoardH);
  }

  // Stripe of light grey "running track" between the hoarding and the grass.
  ctx.fillStyle = "#b8b09a";
  ctx.fillRect(0, crowdTop + hoardH, W, Math.max(2, H * 0.006));
}

function renderScene(
  ctx: CanvasRenderingContext2D, cam: FpCamera, W: number, H: number,
  anim: ShotAnim | null, t: number, phase: Phase,
  pointer: { x: number; y: number } | null,
  pointerToWorld: (clientX: number, clientY: number) => { x: number; z: number } | null,
): void {
  drawStadium(ctx, cam, W, H);

  // Ground — an exact perspective quad (a flat rectangle projects to an
  // exact quadrilateral under a pinhole camera), shaded in mown stripes.
  //
  // The near edge is the real depth that projects to the canvas's own
  // bottom row, computed the same way firstPersonView.ts's groundAt() does
  // — not a guessed offset. The PREVIOUS version used a flat `cam.y - 0.05`
  // (a near-edge DEPTH of exactly 0.05m regardless of CAM_Y), permanently
  // inside project()'s own NEAR=0.35 clip — both near corners always came
  // back null, so the whole grass fill (and everything conditioned on it
  // below: the mown stripes, the goal line painted on the turf) silently
  // never drew at all. Reported directly: "i dont even see any green...
  // wheres the pitch it looks like im on an ice rink".
  const nearDepth = Math.max(0.5, (cam.focal * cam.eye) / (H - cam.horizon));
  const FAR = -26, NEAR_Y = cam.y - nearDepth, HALF = 11;
  const corners = [
    project(cam, -HALF, NEAR_Y, 0), project(cam, HALF, NEAR_Y, 0),
    project(cam, HALF, FAR, 0), project(cam, -HALF, FAR, 0),
  ];
  if (corners.every((p) => p)) {
    ctx.fillStyle = "#2c8a1f";
    ctx.beginPath();
    ctx.moveTo(corners[0]!.px, corners[0]!.py);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i]!.px, corners[i]!.py);
    ctx.closePath();
    ctx.fill();

    // Stripes: alternating shade bands across x, each its own projected quad.
    const stripes = 9;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue;
      const x0 = -HALF + (HALF * 2 * i) / stripes, x1 = -HALF + (HALF * 2 * (i + 1)) / stripes;
      const a = project(cam, x0, NEAR_Y, 0), b = project(cam, x1, NEAR_Y, 0);
      const cc = project(cam, x1, FAR, 0), d = project(cam, x0, FAR, 0);
      if (!a || !b || !cc || !d) continue;
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.beginPath();
      ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.lineTo(cc.px, cc.py); ctx.lineTo(d.px, d.py);
      ctx.closePath();
      ctx.fill();
    }

    // The goal LINE itself, painted on the grass at the keeper's feet.
    const gl = project(cam, -5, 0, 0), gr = project(cam, 5, 0, 0);
    if (gl && gr) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = Math.max(1.5, gl.scale * 0.045);
      ctx.beginPath();
      ctx.moveTo(gl.px, gl.py); ctx.lineTo(gr.px, gr.py);
      ctx.stroke();
    }
  }

  drawGoalFrame(ctx, cam);

  if (!anim) return;
  const { shot } = anim;

  // Striker: runs up to his shooting spot, plants for the strike.
  const runF = clamp(t / Math.max(0.001, shot.strikeAtT), 0, 1);
  const sx = anim.runFromX + (anim.shootX - anim.runFromX) * runF;
  const sy = anim.runFromY + (-shot.startY - anim.runFromY) * runF;
  const kickWindow = 0.22;
  const kickF = t >= shot.strikeAtT - kickWindow && t <= shot.strikeAtT + kickWindow
    ? 1 - Math.abs(t - shot.strikeAtT) / kickWindow : 0;
  drawFigure(ctx, cam, sx, sy, 0, STRIKER_KIT, {
    legSwing: t < shot.strikeAtT ? Math.sin(runF * 16) * (1 - runF * 0.4) : 0,
    kick: kickF,
    armSpread: 0.2 + kickF * 0.3,
  });

  // Decorative extras — see their own doc for what this is (and
  // deliberately isn't) this round.
  if (anim.extras.length) drawExtras(ctx, cam, anim.extras, t);

  // The ball, and — free_kick only — the real wall standing between striker
  // and goal (see GoalieShot.wall's own doc). Whichever is genuinely
  // FARTHER from the camera this frame draws first: a real depth test, not
  // a fixed order, since the ball's own depth changes every frame (it
  // starts well past the wall and crosses its line partway through flight)
  // while the wall's never does.
  const ball = ballWorldAt(anim, t);
  if (shot.wall) {
    const wallWorldY = -shot.wall.y;
    const wallDepth = cam.y - wallWorldY;
    const ballDepth = cam.y - ball.y;
    const lift = wallLiftAt(t, shot.strikeAtT);
    const drawWall = () => {
      for (const wx of shot.wall!.x) {
        drawFigure(ctx, cam, wx, wallWorldY, 0, DEFENDER_KIT, {
          armSpread: 0.15, armLift: lift > 0.05 ? 1 : -0.6,
        }, lift);
      }
    };
    if (wallDepth > ballDepth) { drawWall(); drawBallAt(ctx, cam, ball.x, ball.y, ball.z); }
    else { drawBallAt(ctx, cam, ball.x, ball.y, ball.z); drawWall(); }
  } else {
    drawBallAt(ctx, cam, ball.x, ball.y, ball.z);
  }

  // The keeper (you).
  let reachX = KEEPER_SET_X, reachZ = KEEPER_SET_Z, lunge = 0, recovering = false;
  if (anim.commit && !anim.result) {
    const live = liveDiveState(shot, anim.commit, t);
    reachX = live.reachX; reachZ = live.reachZ; lunge = live.reachFrac; recovering = live.recovering;
  } else if (anim.result) {
    reachX = anim.result.reachX; reachZ = anim.result.reachZ; lunge = anim.result.reachFrac;
  }
  const kx = project(cam, reachX, 0, 0);
  if (kx) {
    const r = Math.max(9, kx.scale * FIGURE_R_M);
    drawKeeperAt(ctx, kx.px, kx.py, r, KEEPER_KIT, { dive: diveSideFor(reachX), lunge }, FACE_STYLE, FAKE_FACE_STYLE, {
      facing: recovering ? diveSideFor(reachX) * 0.15 : 0,
    });
  }

  // Reticle — a live "gloves" target while still aimable, whether from a
  // mouse hover or a finger actually down on the glass. Hidden the instant
  // a dive is committed (reachX/Z above take over the story from there).
  if (phase === "facing" && !anim.commit && pointer) {
    const w = pointerToWorld(pointer.x, pointer.y);
    if (w) {
      const rp = project(cam, w.x, 0, w.z);
      if (rp) {
        ctx.strokeStyle = "rgba(56,224,255,0.95)";
        ctx.lineWidth = Math.max(2, rp.scale * 0.035);
        ctx.beginPath();
        ctx.arc(rp.px, rp.py, Math.max(11, rp.scale * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        const cs = Math.max(6, rp.scale * 0.14);
        ctx.beginPath();
        ctx.moveTo(rp.px - cs, rp.py); ctx.lineTo(rp.px + cs, rp.py);
        ctx.moveTo(rp.px, rp.py - cs); ctx.lineTo(rp.px, rp.py + cs);
        ctx.stroke();
      }
    }
  }

  // Result flash.
  if (anim.result) {
    ctx.fillStyle = anim.result.saved ? "rgba(16,185,129,0.16)" : "rgba(220,38,38,0.20)";
    ctx.fillRect(0, 0, W, H);
    ctx.font = `900 ${Math.round(W * 0.09)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = anim.result.saved ? "#34d399" : "#f87171";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(2, W * 0.01);
    const label = shot.offTarget ? "OFF TARGET" : anim.result.saved ? "SAVED!" : "GOAL";
    ctx.strokeText(label, W / 2, H * 0.42);
    ctx.fillText(label, W / 2, H * 0.42);
    ctx.textAlign = "start";
  }
}

function drawFigure(
  ctx: CanvasRenderingContext2D, cam: FpCamera, x: number, y: number, z: number,
  look: FigureLook, pose: BodyPose, liftM = 0,
): void {
  const p = project(cam, x, y, z);
  if (!p) return;
  const r = Math.max(9, p.scale * FIGURE_R_M);
  drawFigureAt(ctx, p.px, p.py, r, look, FACE_STYLE, FAKE_FACE_STYLE, {
    pose,
    // liftM (a free-kick wall's jump — see wallLiftAt) raises the body in
    // SCREEN pixels while the shadow stays on the grass; 0 (every existing
    // caller) is byte-identical to before this param existed.
    liftPx: liftM * p.scale * 0.55,
    shadowR: liftM > 0 ? r * 0.34 * (1 - Math.min(0.35, liftM * 0.12)) : undefined,
  });
}

/** The decorative extras — see their own doc above for what this is (and
 *  isn't). Far-to-near so a nearer man correctly overlaps a farther one. */
function drawExtras(ctx: CanvasRenderingContext2D, cam: FpCamera, extras: ExtraPlayer[], t: number): void {
  const ordered = [...extras].sort((a, b) => a.baseY - b.baseY);
  for (const e of ordered) {
    const x = e.baseX + Math.sin(t * e.driftFreq * Math.PI * 2 + e.phase) * e.driftAmp;
    drawFigure(ctx, cam, x, e.baseY, 0, e.team === "def" ? DEFENDER_KIT : STRIKER_KIT, {
      legSwing: Math.sin(t * 1.6 + e.phase) * 0.18,
      armSpread: 0.15,
    });
  }
}

/** The full 3D goal — posts, bar, net. Always in frame now — see CAM_Y's
 *  own comment for how the distance was chosen. */
function drawGoalFrame(ctx: CanvasRenderingContext2D, cam: FpCamera): void {
  const hw = GOAL_W / 2;
  const bl = project(cam, -hw, 0, 0), br = project(cam, hw, 0, 0);
  const tl = project(cam, -hw, 0, GOAL_H), tr = project(cam, hw, 0, GOAL_H);
  if (!bl || !br || !tl || !tr) return;

  // Net back plane, slightly narrower — a simple taper rather than the real
  // net's curved side panels.
  const backHW = hw * 0.72, backY = NET_DEPTH;
  const rbl = project(cam, -backHW, backY, 0), rbr = project(cam, backHW, backY, 0);
  const rtl = project(cam, -backHW, backY, GOAL_H * 0.94), rtr = project(cam, backHW, backY, GOAL_H * 0.94);

  if (rbl && rbr && rtl && rtr) {
    const quad = (a: typeof bl, b: typeof bl, c: typeof bl, d: typeof bl, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(a!.px, a!.py); ctx.lineTo(b!.px, b!.py); ctx.lineTo(c!.px, c!.py); ctx.lineTo(d!.px, d!.py);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    quad(bl, br, rbr, rbl, "rgba(20,40,30,0.35)"); // ground/floor of net
    quad(rbl, rbr, rtr, rtl, "rgba(20,40,30,0.5)"); // back panel
    quad(bl, rbl, rtl, tl, "rgba(20,40,30,0.4)"); // left panel
    quad(br, rbr, rtr, tr, "rgba(20,40,30,0.4)"); // right panel

    // Netting lines, back panel only — enough to read as mesh without the
    // cost of texturing every panel.
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    const cols = 10, rows = 6;
    for (let i = 0; i <= cols; i++) {
      const f = i / cols;
      const a = { px: rbl.px + (rbr.px - rbl.px) * f, py: rbl.py + (rbr.py - rbl.py) * f };
      const b = { px: rtl.px + (rtr.px - rtl.px) * f, py: rtl.py + (rtr.py - rtl.py) * f };
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const f = j / rows;
      const a = { px: rbl.px + (rtl.px - rbl.px) * f, py: rbl.py + (rtl.py - rbl.py) * f };
      const b = { px: rbr.px + (rtr.px - rbr.px) * f, py: rbr.py + (rtr.py - rbr.py) * f };
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }
  }

  // Posts and bar, on top of the net.
  ctx.strokeStyle = "#f8fafc";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, tl.scale * 0.1);
  ctx.beginPath();
  ctx.moveTo(bl.px, bl.py); ctx.lineTo(tl.px, tl.py);
  ctx.moveTo(br.px, br.py); ctx.lineTo(tr.px, tr.py);
  ctx.stroke();
  ctx.lineWidth = Math.max(3.5, tl.scale * 0.12);
  ctx.beginPath();
  ctx.moveTo(tl.px, tl.py); ctx.lineTo(tr.px, tr.py);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawBallAt(ctx: CanvasRenderingContext2D, cam: FpCamera, x: number, y: number, z: number): void {
  const ground = project(cam, x, y, 0);
  const ball = project(cam, x, y, z);
  if (!ground || !ball) return;
  // Drawn at 2.6x true size with a real floor, not literal scale — the
  // exact same "findable, not to-scale" convention fiveASide/render.ts's
  // own drawBall uses (see that file's header: a to-scale ball at any real
  // camera distance is a smudge, and the one thing the whole screen is
  // about can't be one).
  const r = Math.max(BALL_MIN_R, ball.scale * 0.11 * 2.6);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(ground.px, ground.py, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(10,12,10,0.9)";
  ctx.beginPath();
  ctx.arc(ball.px, ball.py, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.px, ball.py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(20,20,20,0.55)";
  ctx.beginPath();
  ctx.arc(ball.px, ball.py, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
}
