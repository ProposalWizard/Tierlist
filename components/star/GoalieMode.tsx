"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickShot, resolveDive, liveDiveState, streakMultiplier,
  MAX_REACH_X, MAX_REACH_Z, KEEPER_SET_X, KEEPER_SET_Z,
  type GoalieShot, type DiveResult,
} from "@/lib/star/goalieMode";
import { GOAL_W, GOAL_H, NET_DEPTH } from "@/lib/star/pitch";
import { cameraFor, project, type FpCamera } from "@/lib/star/firstPersonView";
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
 * input: a real perspective camera (`firstPersonView.ts`, the same math the
 * open-run first-person mode already uses) sat just behind the goal line,
 * looking out at the shot; the shared figure renderer (`fiveASide/render.ts`)
 * for the keeper (you) and the striker, so both get real photo/outline
 * support "for free" and the same house look as every other screen; and a
 * push-your-luck stake that stacks with `streakMultiplier`, matching the
 * bet/onSetBank idiom every other Casino game here already uses.
 *
 * ── World coordinates, local to this file only ──
 *
 * y = 0 is the goal line. Positive y is BEHIND it (where the camera and net
 * sit); negative y is OUT on the pitch (where the striker stands, at
 * `y = -shot.startY`). x/z match `goalieMode.ts`'s own goal-local convention
 * exactly (x = 0 centre, negative = keeper's left; z = height). The camera
 * uses `firstPersonView.ts`'s DEFAULT forward ({0,-1}) specifically so that
 * maps to the intuitive "positive world x = screen right" without any extra
 * sign-flipping — see `diveSideFor` below for the one place that still
 * needed working out by hand.
 *
 * ── One honestly-scoped simplification ──
 *
 * "Crossed into and headering, passed into and first-time shooting" is
 * covered by a delivery ball arriving to the striker before he strikes
 * (header/volley kinds only) rather than a full second, animated crosser —
 * a second full figure with its own run and its own real position would be
 * a real, separate build; the delivery ball alone still reads the moment
 * clearly (a ball arrives to him, THEN he strikes) without doubling the
 * scope of a first pass. Worth a second pass if it reads as thin once it's
 * actually been played.
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

// ── Camera ──────────────────────────────────────────────────────────────
//
// A real, measured fix for a real bug, not a tuning pass. The first version
// put the camera 0.75m behind the goal line — reasoned (wrongly) from
// NET_DEPTH (1.2m), on the assumption the camera had to physically fit
// inside the net's own shallow depth. That was never a real constraint —
// viewing DISTANCE and net depth are unrelated — and `star-playtest`
// confirmed the actual result live: the goalposts projected to px values
// like -3161 and +6185 against a ~1170px canvas (thousands of pixels off
// both edges), the whole grass fill silently vanished (its near corner fell
// inside `project()`'s own NEAR=0.35 clip guard once the camera's downward
// pitch was applied), and the keeper — projected at that same near-zero
// depth — became a single ~1000px-radius head. Not a framing nitpick: a
// basic distance/focal-length mismatch (at under a metre from a 7.32m-wide
// goal, FOCAL_K=0.90's normal-ish lens needs to be several metres back
// before the goal fits in frame at all).
//
// Re-derived by actually computing `project()`'s real output (not more
// hand algebra) across a sweep of candidate distances: at CAM_Y=7 the goal
// spans 90% of a 390px-wide canvas with ~19px of real margin either side
// (never clips, even mid-dive at MAX_REACH_X), the keeper stands at ~19% of
// frame height, and a full vertical stretch toward a top corner brings his
// reach right up near the crossbar, which is what "full reach" should look
// like. `CAM_EYE`/`CAM_PITCH` chosen alongside it so the crossbar sits
// about a third of the way down the frame — headroom above for sky/stand,
// the goal and keeper occupying the rest.
const CAM_Y = 7;
const CAM_EYE = 2.5;
const CAM_PITCH = 0.14;

const FIGURE_R_M = 1.05; // metres — matches fiveASide/render.ts's own FIGURE_R
const KEEPER_KIT: FigureLook = { shirt: "#eab308", shorts: "#111827", trim: "#111827", skin: "#c68642" };
const STRIKER_KIT: FigureLook = { shirt: "#dc2626", shorts: "#ffffff", trim: "#ffffff", skin: "#c68642" };

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

type Phase = "stake" | "facing" | "resolved" | "conceded" | "cashout";

interface ShotAnim {
  shot: GoalieShot;
  seqStart: number; // performance.now()/1000 at which this shot's t=0 is
  shootX: number;   // striker's final shooting spot, world x
  runFromX: number;
  runFromY: number;
  commit: { commitT: number; targetX: number; targetZ: number } | null;
  resolvedAt: number | null; // seconds (seqStart-relative) once the outcome is known
  result: DiveResult | null;
}

function archHeightFor(kind: GoalieShot["kind"]): number {
  if (kind === "curl") return 0.65;
  if (kind === "volley") return 0.5;
  if (kind === "header") return 0.25; // struck downward off the head, not looped
  return 0.4; // drive
}
function originZFor(kind: GoalieShot["kind"]): number {
  if (kind === "header") return 2.0;
  if (kind === "volley") return 1.05;
  return 0.28;
}

/** Ball position at any instant of the sequence — during the striker's own
 *  possession (pre-strike, resting at his feet / arriving as a delivery for
 *  header/volley) and in flight afterward. Pure function of the shot and
 *  elapsed time so the draw loop never has to track ball state separately. */
function ballWorldAt(anim: ShotAnim, t: number): { x: number; y: number; z: number } {
  const { shot } = anim;
  if (t < shot.strikeAtT) {
    if (shot.kind === "header" || shot.kind === "volley") {
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
    // Continues on into the net rather than stopping dead at the line.
    return { x: shot.targetX, y: settleF * NET_DEPTH * 0.6, z: Math.max(0, shot.targetZ - settleF * 1.4) };
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
  const rafRef = useRef<number | null>(null);
  const stakedRef = useRef(0);

  // ── Resize the backing canvas to its container ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const applySize = (boxWidth: number) => {
      const w = Math.max(240, boxWidth);
      const h = Math.max(320, w * 1.3);
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

  const camera = useCallback((): FpCamera => {
    const { w, h } = sizeRef.current;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    return cameraFor({ x: 0, y: CAM_Y }, w * dpr, h * dpr, { eye: CAM_EYE, pitch: CAM_PITCH });
  }, []);

  /** Start a brand-new shot sequence — the striker steps up, the timeline
   *  resets to t=0, no commit yet. */
  const beginShot = useCallback((s: number) => {
    if (!rngRef.current) rngRef.current = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const shot = pickShot(s, rngRef.current);
    const shootX = clamp(shot.tellSide * (1.1 + Math.min(1.6, Math.abs(shot.targetX) * 0.32)), -3.2, 3.2);
    animRef.current = {
      shot,
      seqStart: performance.now() / 1000,
      shootX,
      runFromX: shootX - shot.tellSide * 2.2,
      runFromY: -(shot.startY + 3.5),
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

  // ── Input: a live reticle while aiming, a single tap/click to commit ──
  const pointerToWorld = useCallback((clientX: number, clientY: number): { x: number; z: number } | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const cam = camera();
    // The goal-line plane (y=0) sits at a constant depth (CAM_Y) from this
    // camera regardless of px/py, since forward is purely along y — see the
    // file header. unprojectAtDepth is the exact inverse of project() for a
    // camera with no yaw, which this one has.
    const u = (px - cam.W / 2) * CAM_Y / cam.focal;
    const z = cam.eye - (py - cam.horizon) * CAM_Y / cam.focal;
    return { x: clamp(u, -MAX_REACH_X, MAX_REACH_X), z: clamp(z, 0, MAX_REACH_Z) };
  }, [camera]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    const anim = animRef.current;
    if (phase !== "facing" || !anim || anim.commit || anim.result) return;
    const w = pointerToWorld(e.clientX, e.clientY);
    if (!w) return;
    const t = performance.now() / 1000 - anim.seqStart;
    anim.commit = { commitT: t, targetX: w.x, targetZ: w.z };
  }, [phase, pointerToWorld]);

  // ── Draw loop ──
  useEffect(() => {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const { width: W, height: H } = c;
      const cam = camera();
      const anim = animRef.current;
      const t = anim ? performance.now() / 1000 - anim.seqStart : 0;
      if (anim && phase === "facing") resolveIfDue(t);

      renderScene(ctx, cam, W, H, anim, t, phase, pointerRef.current, canvasRef.current, pointerToWorld);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, camera, resolveIfDue, pointerToWorld]);

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

        <div ref={wrapRef} className="relative w-full rounded-2xl overflow-hidden border-2 border-gray-700" style={{ aspectRatio: "360/480" }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
          />
          {phase === "facing" && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-[10px] font-black text-white/90">
              TAP TO DIVE
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

function renderScene(
  ctx: CanvasRenderingContext2D, cam: FpCamera, W: number, H: number,
  anim: ShotAnim | null, t: number, phase: Phase,
  pointer: { x: number; y: number } | null,
  canvasEl: HTMLCanvasElement | null,
  pointerToWorld: (clientX: number, clientY: number) => { x: number; z: number } | null,
): void {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0c1a3a");
  sky.addColorStop(1, "#2a4a6b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const horizonPx = cam.horizon - Math.tan(cam.pitch ?? 0) * cam.focal;
  // A simple stand silhouette along the horizon.
  ctx.fillStyle = "rgba(8,14,28,0.55)";
  const blockW = W / 14;
  for (let i = 0; i < 14; i++) {
    const bh = 10 + (i % 3) * 6;
    ctx.fillRect(i * blockW, Math.max(0, horizonPx - bh), blockW - 2, bh);
  }

  // Ground — an exact perspective quad (a flat rectangle projects to an
  // exact quadrilateral under a pinhole camera), shaded in mown stripes.
  const FAR = -26, NEAR = CAM_Y - 0.05, HALF = 11;
  const corners = [
    project(cam, -HALF, NEAR, 0), project(cam, HALF, NEAR, 0),
    project(cam, HALF, FAR, 0), project(cam, -HALF, FAR, 0),
  ];
  if (corners.every((p) => p)) {
    ctx.fillStyle = "#1f7a1f";
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
      const a = project(cam, x0, NEAR, 0), b = project(cam, x1, NEAR, 0);
      const cc = project(cam, x1, FAR, 0), d = project(cam, x0, FAR, 0);
      if (!a || !b || !cc || !d) continue;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.beginPath();
      ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.lineTo(cc.px, cc.py); ctx.lineTo(d.px, d.py);
      ctx.closePath();
      ctx.fill();
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

  // The ball.
  const ball = ballWorldAt(anim, t);
  drawBallAt(ctx, cam, ball.x, ball.y, ball.z);

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

  // Reticle — only while still aimable (facing phase, not yet committed).
  if (phase === "facing" && !anim.commit && pointer && canvasEl) {
    const w = pointerToWorld(pointer.x, pointer.y);
    if (w) {
      const rp = project(cam, w.x, 0, w.z);
      if (rp) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(1.5, rp.scale * 0.03);
        ctx.beginPath();
        ctx.arc(rp.px, rp.py, Math.max(10, rp.scale * 0.32), 0, Math.PI * 2);
        ctx.stroke();
        const cs = Math.max(6, rp.scale * 0.16);
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
  look: FigureLook, pose: BodyPose,
): void {
  const p = project(cam, x, y, z);
  if (!p) return;
  const r = Math.max(9, p.scale * FIGURE_R_M);
  drawFigureAt(ctx, p.px, p.py, r, look, FACE_STYLE, FAKE_FACE_STYLE, { pose });
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
  ctx.lineWidth = Math.max(3, (tl.scale ?? 12) * 0.1);
  ctx.beginPath();
  ctx.moveTo(bl.px, bl.py); ctx.lineTo(tl.px, tl.py);
  ctx.moveTo(br.px, br.py); ctx.lineTo(tr.px, tr.py);
  ctx.stroke();
  ctx.lineWidth = Math.max(3.5, (tl.scale ?? 12) * 0.12);
  ctx.beginPath();
  ctx.moveTo(tl.px, tl.py); ctx.lineTo(tr.px, tr.py);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Goal line itself, on the grass.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(2, (bl.scale ?? 12) * 0.06);
  ctx.beginPath();
  ctx.moveTo(bl.px, bl.py); ctx.lineTo(br.px, br.py);
  ctx.stroke();
}
