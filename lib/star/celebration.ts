/**
 * AFTER YOU SCORE — the run to the corner and your celebration.
 *
 * Leo's tonight plan, part 1 (22 Oct 2026, approved): "You score. Your player
 * peels away to the corner where the cameras and the fans are, then does the
 * celebration you picked in the shop. Tap anywhere to skip it." Every goal of
 * yours, skippable; team-mates keep their short jump.
 *
 * This file is the one place that says where you are and what you are doing
 * at every moment after your goal. The 2D match (CanvasMatch) draws you here,
 * the 3D view (engineView) reads the same frame, and a goal video
 * (goalClip/render.ts) works it out again from the same plan, so all three
 * agree. Pure: no React, no engine, no random numbers.
 *
 * Pitch metres, the engine's frame: x across 0..68, the goal line at y = 0,
 * y grows out of the goal. The corners by the goal are (0, 0) and (68, 0).
 */
import { PITCH_W } from "./pitch";

export type CelebrationMove = "hands_up" | "arms_out" | "knee_slide" | "fist_pump" | "jump" | "roar" | "fist"
  | "corner_flag" | "backflip" | "own_name" | "statue";

export interface CelebSpec {
  /** The 3D clip (public/star/anims3d/mocap.glb). */
  clip3d: string;
  /** Where in the 3D clip it starts (s). */
  from3d: number;
  /** The 2D sprite clip (lib/star/sprites.ts), when it has been baked. */
  sprite: string;
  /** How long the move plays (s). */
  playS: number;
  /** A loop (it repeats while it plays). */
  loop: boolean;
  /** How far he travels on, along his run, `u` seconds into the move (m). */
  travel: (u: number) => number;
  /** His speed as the move begins (m/s): the run slows to it, not to a stop. */
  enterSpeed: number;
  /** A move done AT the flag: he runs on until he is this far from it (m), not SHORT_OF_FLAG short of the corner. */
  atFlag?: number;
}

/** Piecewise-linear through (t, v) keys. */
function keys(k: [number, number][], t: number): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, v0] = k[i - 1], [t1, v1] = k[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return k[k.length - 1][1];
}

/** The knee slide's own travel, measured off its keyed clip (tools/mocap3d/keyed.py, KS hz). */
const KNEE_HZ: [number, number][] = [[0, 0], [0.18, 0.95], [0.36, 1.95], [0.55, 2.9], [1.05, 4.6], [1.4, 5.55], [1.9, 5.85], [3.2, 5.88]];
const KNEE_FROM = 0.36;

const still = () => 0;

export const CELEB_SPECS: Record<CelebrationMove, CelebSpec> = {
  // Jogs on towards the fans with both arms up (celebrate_safe runs at 3.4 m/s).
  hands_up: { clip3d: "celebrate_safe", from3d: 0, sprite: "celebHandsUp", playS: 2.0, loop: true, travel: (u) => 3.4 * Math.min(u, 2.0), enterSpeed: 3.4 },
  arms_out: { clip3d: "celebrate_airplane", from3d: 0, sprite: "celebArmsOut", playS: 2.6, loop: false, travel: still, enterSpeed: 0 },
  // The last strides and the slide itself; he ends about 4 m on, on his knees.
  knee_slide: {
    clip3d: "knee_slide", from3d: KNEE_FROM, sprite: "celebKneeSlide", playS: 3.2 - KNEE_FROM, loop: false,
    travel: (u) => keys(KNEE_HZ, KNEE_FROM + u) - keys(KNEE_HZ, KNEE_FROM), enterSpeed: 5.2,
  },
  fist_pump: { clip3d: "celebrate_pump", from3d: 0, sprite: "celebFistPump", playS: 2.2, loop: false, travel: still, enterSpeed: 0 },
  jump: { clip3d: "celebrate_jump", from3d: 0, sprite: "celebJump", playS: 1.7, loop: false, travel: still, enterSpeed: 0 },
  roar: { clip3d: "celebrate_roar", from3d: 0, sprite: "celebRoar", playS: 2.2, loop: false, travel: still, enterSpeed: 0 },
  // The Star Pass four (25 Oct 2026), keyed by hand in tools/mocap3d/keyed_celebs.py; all on the spot.
  // The corner flag dance is done right by the flag; your own celebration turns his back to the camera
  // inside the clip (so the name on his shirt faces whoever is watching, 2D or 3D).
  corner_flag: { clip3d: "celebrate_corner_flag", from3d: 0, sprite: "celebCornerFlag", playS: 3.2, loop: false, travel: still, enterSpeed: 0, atFlag: 1.3 },
  backflip: { clip3d: "celebrate_backflip", from3d: 0, sprite: "celebBackflip", playS: 2.6, loop: false, travel: still, enterSpeed: 0 },
  own_name: { clip3d: "celebrate_own_name", from3d: 0, sprite: "celebOwnName", playS: 3.0, loop: false, travel: still, enterSpeed: 0 },
  statue: { clip3d: "celebrate_statue", from3d: 0, sprite: "celebStatue", playS: 2.6, loop: false, travel: still, enterSpeed: 0 },
  // Nothing equipped: the team-mates' own fist celebration.
  fist: { clip3d: "celebrate_fist", from3d: 0, sprite: "celebrate", playS: 2.0, loop: false, travel: still, enterSpeed: 0 },
};

/** The shop's celebration items, by the `celebration` they carry (lib/star/store/catalogue.ts). */
const SHOP_MOVE: Record<string, CelebrationMove> = {
  hands_up: "hands_up", arms_out: "arms_out", knee_slide: "knee_slide", fist_pump: "fist_pump", jump: "jump", roar: "roar",
  corner_flag: "corner_flag", backflip: "backflip", own_name: "own_name", statue: "statue",
};

/** The move a career's equipped celebration item plays (`item.celebration`), or the plain fist. */
export function celebrationMoveFor(itemCelebration: string | undefined | null): CelebrationMove {
  return (itemCelebration && SHOP_MOVE[itemCelebration]) || "fist";
}

/** A moment of stillness as the ball goes in, before he wheels away (s). */
export const CELEB_REACT_S = 0.25;
/** The longest run to the corner (s): "about 2 seconds". */
export const CELEB_RUN_S = 2.0;
/** His top speed on the run (m/s): a sprint, not a jog. */
const RUN_TOP = 7.0;
const ACCEL_S = 0.3;
const DECEL_S = 0.4;
/** How far short of the corner flag he ends up (m). */
const SHORT_OF_FLAG = 3.0;
/** After the move, before the match goes on (s). */
export const CELEB_TAIL_S = 0.35;

export interface Vec { x: number; y: number }

export interface CelebPlan {
  move: CelebrationMove;
  from: Vec;
  /** Unit vector of his run. */
  dir: Vec;
  /** The corner he runs to. */
  corner: Vec;
  runDist: number;
  runS: number;
  /** Peak speed of the run (m/s). */
  vmax: number;
  /** When the move starts (s after the goal). */
  moveAt: number;
  /** When it is all over and the match goes on (s after the goal). */
  totalS: number;
  /** The move's own travel, shortened when there is no room before the flag (0..1). */
  travelK: number;
}

/** Which corner: the nearer one on the goal line. */
export function cornerFor(from: Vec, pitchW = PITCH_W): Vec {
  return { x: from.x < pitchW / 2 ? 0 : pitchW, y: 0 };
}

export function planCelebration(from: Vec, move: CelebrationMove, pitchW = PITCH_W): CelebPlan {
  const spec = CELEB_SPECS[move];
  const corner = cornerFor(from, pitchW);
  // Aim a little in from the flag so he stays on the grass (a move done at the flag: nearer it, and no shortfall).
  const inset = spec.atFlag !== undefined ? spec.atFlag / Math.SQRT2 : 1.5;
  const short = spec.atFlag !== undefined ? 0 : SHORT_OF_FLAG;
  const aim = { x: corner.x === 0 ? inset : pitchW - inset, y: inset };
  let dx = aim.x - from.x, dy = aim.y - from.y;
  const D = Math.hypot(dx, dy);
  if (D < 1e-6) { dx = 0; dy = -1; } else { dx /= D; dy /= D; }
  const moveDist = spec.travel(spec.playS);
  const travelK = moveDist > 0 ? Math.max(0, Math.min(1, (D - short) / moveDist)) : 1;
  const room = Math.max(0, D - short - moveDist * travelK);
  const runDist = Math.min(room, RUN_TOP * (CELEB_RUN_S - (ACCEL_S + DECEL_S) / 2));
  const runS = runDist <= 0.5 ? 0.4 : Math.max(0.9, Math.min(CELEB_RUN_S, runDist / (RUN_TOP * 0.82)));
  const ve = Math.min(spec.enterSpeed * travelK, RUN_TOP);
  const tc = Math.max(0, runS - ACCEL_S - DECEL_S);
  const vmax = runDist <= 0 ? 0 : Math.max(ve, (runDist - (ve * DECEL_S) / 2) / (ACCEL_S / 2 + tc + DECEL_S / 2));
  const moveAt = CELEB_REACT_S + runS;
  return { move, from: { ...from }, dir: { x: dx, y: dy }, corner, runDist, runS, vmax, moveAt, totalS: moveAt + spec.playS + CELEB_TAIL_S, travelK };
}

/** Distance along the run, `s` seconds into it (accelerate, cruise, slow to the move's own pace). */
function runAlong(p: CelebPlan, s: number): { d: number; v: number } {
  const ve = Math.min(CELEB_SPECS[p.move].enterSpeed * (p.travelK ?? 1), RUN_TOP);
  const vm = p.vmax, ta = ACCEL_S, td = DECEL_S, tc = Math.max(0, p.runS - ta - td);
  if (p.runDist <= 0) return { d: 0, v: 0 };
  s = Math.max(0, Math.min(p.runS, s));
  if (s <= ta) return { d: (vm * s * s) / (2 * ta), v: (vm * s) / ta };
  const dA = (vm * ta) / 2;
  if (s <= ta + tc) return { d: dA + vm * (s - ta), v: vm };
  const u = s - ta - tc;
  const v = vm + ((ve - vm) * u) / td;
  return { d: Math.min(p.runDist, dA + vm * tc + ((vm + v) / 2) * u), v };
}

export type CelebPhase = "react" | "run" | "move" | "done";

export interface CelebState {
  x: number;
  y: number;
  phase: CelebPhase;
  /** Seconds into the move (move phase), else 0. */
  moveT: number;
  /** Seconds into the 3D clip (from3d + moveT; a loop wraps by itself). */
  clipT: number;
  /** His speed now (m/s). */
  speed: number;
}

/** Where he is and what he is doing `t` seconds after the goal. */
export function celebAt(p: CelebPlan, t: number): CelebState {
  const spec = CELEB_SPECS[p.move];
  const at = (d: number) => ({ x: p.from.x + p.dir.x * d, y: p.from.y + p.dir.y * d });
  if (t < CELEB_REACT_S) return { ...at(0), phase: "react", moveT: 0, clipT: 0, speed: 0 };
  if (t < p.moveAt) {
    const r = runAlong(p, t - CELEB_REACT_S);
    return { ...at(r.d), phase: "run", moveT: 0, clipT: 0, speed: r.v };
  }
  const u = Math.min(spec.playS, t - p.moveAt);
  const d0 = p.runDist;
  const k = p.travelK ?? 1;
  const d = d0 + spec.travel(u) * k;
  const v = u < spec.playS ? (k * (spec.travel(Math.min(spec.playS, u + 0.05)) - spec.travel(u))) / 0.05 : 0;
  return { ...at(d), phase: t - p.moveAt >= spec.playS ? "done" : "move", moveT: u, clipT: spec.from3d + u, speed: Math.max(0, v) };
}

// ── Room for you (Leo's overnight job, 25 Oct 2026) ──
// "a defender can stand on top of you during the knee slide": nobody stands
// on your run or where your move ends. A man within ROOM_M of the line you
// run (from where you scored to where the move ends) steps aside, off the
// line, while you are still CLEAR_FROM_M away from him; he has finished by
// the time you are CLEAR_BY_M away, and he stays aside. Picture only: the
// live match (2D and 3D) and the goal video both move him with this.

/** How far everyone keeps from your run (m): about two bodies. */
export const ROOM_M = 1.6;
const CLEAR_FROM_M = 4.0;
const CLEAR_BY_M = 1.0;
/** The first step aside eases in over this long (s), so nobody jumps as the ball goes in. */
const ROOM_EASE_S = 0.6;

const smooth = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

/** How far along his line he is at the end of the move (m). */
export function celebEndDist(p: CelebPlan): number {
  const spec = CELEB_SPECS[p.move];
  return p.runDist + spec.travel(spec.playS) * (p.travelK ?? 1);
}

/**
 * Where a man standing at `m` is drawn `t` seconds after your goal, so he is
 * never on top of you. Pure and stateless: the same answer for the same
 * spot and time, live or in a video. Anyone already clear is returned as is.
 */
export function roomFor(p: CelebPlan, m: Vec, t: number): Vec {
  if (t <= 0) return m;
  const L = celebEndDist(p);
  const rx = m.x - p.from.x, ry = m.y - p.from.y;
  const s = Math.max(0, Math.min(L, rx * p.dir.x + ry * p.dir.y));
  const q = { x: p.from.x + p.dir.x * s, y: p.from.y + p.dir.y * s };
  const ox = m.x - q.x, oy = m.y - q.y, d = Math.hypot(ox, oy);
  if (d >= ROOM_M) return m;
  // which way he steps: away from the line; a man right on it steps towards the middle of the pitch
  let nx: number, ny: number;
  if (d > 1e-3) { nx = ox / d; ny = oy / d; }
  else {
    nx = -p.dir.y; ny = p.dir.x;
    const mid = PITCH_W / 2 - q.x;
    if (nx * mid < 0 || (Math.abs(nx) < 1e-6 && ny < 0)) { nx = -nx; ny = -ny; }
  }
  // how far along you have got (it only grows, so once aside he stays aside)
  const st = celebAt(p, t);
  const along = (st.x - p.from.x) * p.dir.x + (st.y - p.from.y) * p.dir.y;
  const w = smooth((along - (s - CLEAR_FROM_M)) / (CLEAR_FROM_M - CLEAR_BY_M)) * smooth(t / ROOM_EASE_S);
  const push = (ROOM_M - d) * w;
  return { x: m.x + nx * push, y: m.y + ny * push };
}
