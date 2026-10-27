/**
 * KEEPER CATCHES AND DIVES — the picture only (Leo, 26 Oct 2026).
 *
 * "make it so the goalie actually catches the ball … ball should go in his
 * hands and move with the goalie if he dives … dive more realistic and fall
 * on floor and if he gets up get up."
 *
 * The match engine decides a save the instant the ball reaches the keeper
 * (lib/star/canvasEngine.ts: he never anticipates; the lunge is drawn after
 * the outcome). That is why, drawn straight from the engine, the ball was
 * gone (or frozen in the air) before his dive began. This file does not
 * touch any of that. It reads the ball's flight at the strike, works out
 * when and where it will reach his line, and starts his dive early enough
 * that his gloves arrive WITH the ball. At contact the engine's real outcome
 * picks the ending: a catch (the ball goes into his gloves and stays there:
 * the caller draws it at the clip's recorded glove point), a palm away (the
 * ball carries on as the engine sends it), or beaten (he finishes the dive
 * empty). Then he lands, lies a beat, and gets up.
 *
 * Pure: no React, no canvas. CanvasMatch keeps one KeeperShow per chance and
 * asks `keeperShowFrame` each frame. Results are never touched, only how the
 * keeper and the caught ball are drawn. Behind Leo's switch ("keeperCatch",
 * lib/star/leoUpdate.ts); off = the old drawing, unchanged.
 */

export type KeeperMove = "diveHigh" | "diveLow" | "chest" | "feet";
export type KeeperEnding = "catch" | "parry" | "fumble" | "beaten";
export type KeeperLook = "natural" | "broadcast" | "arcade";

/** The looks Leo picks between (Settings → Updates → Leo's update → Keeper look). */
export const KEEPER_LOOKS: { id: KeeperLook; label: string; line: string }[] = [
  { id: "natural", label: "A · Natural", line: "Real time: dive, catch, land, get up." },
  { id: "broadcast", label: "B · Broadcast", line: "A short slow-motion as the ball reaches him, a dust puff when he lands." },
  { id: "arcade", label: "C · Arcade", line: "Bigger, snappier dive, a roll after a diving catch, a glove flash." },
];

export interface KeeperPlan {
  /** Ball-clock second the ball reaches his line. */
  tLine: number;
  /** Where along his line (pitch x, m) and how high (m). */
  x: number;
  z: number;
  /** +1 = to the screen right of him, -1 = left, 0 = at him. */
  side: number;
  move: KeeperMove;
}

export interface KeeperShow {
  plan: KeeperPlan;
  /** Show-clock second his move started (set once). */
  start: number;
  /** Set when the engine reports the save. */
  ending: KeeperEnding | null;
  /** Show-clock second of contact, once known. */
  contactAt: number | null;
  look: KeeperLook;
}

/** The new clips (tools/sprites/new: atlas 5), with the frame the gloves meet the ball and the frame he lands. */
export interface ClipTiming { fps: number; frames: number; contactFrame?: number; landFrame?: number; landM?: [number, number] }

/** How far either side he can get a glove (m); beyond that he still dives, beaten. */
export const KEEPER_REACH_M = 2.9;
const G = 9.81;

/** The engine's own ball numbers (lib/star/canvasEngine.ts AIR_DRAG, GROUND_FRICTION), copied so this stays pure. */
const AIR_DRAG = 0.12;
const GROUND_FRICTION = 1.9;

/**
 * When and where will the ball reach his line (y = keeperY)? Steps the ball
 * forward with the engine's air drag and grass friction (a bounce just lands
 * it). Without them a long or rolling shot arrived much later than guessed and
 * he was down, or even back up, before it reached him (seen, 27 Oct). The
 * caller re-asks every frame until his move starts, and the contact moment
 * re-syncs the rest.
 */
export function predictLine(
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  keeperY: number,
  clockNow: number,
): { tLine: number; x: number; z: number } | null {
  let { x, y, z, vx, vy, vz } = ball;
  const sgn = Math.sign(keeperY - y);
  if (Math.abs(vy) < 0.5 || sgn !== Math.sign(vy)) return null;
  const dt = 1 / 120;
  for (let t = 0; t < 3; t += dt) {
    if (z > 0.02 || vz > 0) {
      const k = Math.max(0, 1 - AIR_DRAG * dt);
      vx *= k; vy *= k;
      vz -= G * dt; z += vz * dt;
      if (z <= 0) { z = 0; vz = 0; }
    } else {
      const sp = Math.hypot(vx, vy);
      if (sp < 0.3) return null; // it stops before it gets to him
      const f = Math.max(0, sp - GROUND_FRICTION * dt) / sp;
      vx *= f; vy *= f;
    }
    const ny = y + vy * dt;
    if (Math.sign(keeperY - ny) !== sgn) {
      const frac = (keeperY - y) / (ny - y);
      return { tLine: clockNow + t + frac * dt, x: x + vx * dt * frac, z };
    }
    x += vx * dt; y = ny;
  }
  return null;
}

/** Which move: standing (chest or feet) when it comes at him, a dive (high or low) when it doesn't. */
export function pickMove(dx: number, z: number): { move: KeeperMove; side: number } {
  if (Math.abs(dx) < 0.55) return { move: z > 0.7 ? "chest" : "feet", side: 0 };
  return { move: z < 0.6 ? "diveLow" : "diveHigh", side: Math.sign(dx) };
}

/** The clip his move plays, by ending and phase. `dir` = "R" | "L" as seen from his own view. */
export function clipFor(move: KeeperMove, ending: KeeperEnding | null, dir: "R" | "L"): string {
  if (move === "chest") return ending === "fumble" ? "fumble" : "kCatchChest";
  if (move === "feet") return ending === "fumble" ? "fumble" : "kCatchFeet";
  if (ending === "parry" || ending === "beaten" || ending === "fumble") return `kParryDive${dir}`;
  return move === "diveLow" ? `kCatchLow${dir}` : `kCatchDive${dir}`;
}

/** When to start a clip so its contact frame lands on the ball's arrival (never before `now`). */
export function startFor(plan: KeeperPlan, timing: ClipTiming, showNow: number, clockNow: number): number {
  const lead = (timing.contactFrame ?? Math.round(timing.frames * 0.4)) / timing.fps;
  const arriveIn = Math.max(0, plan.tLine - clockNow);
  return showNow + Math.max(0, arriveIn - lead);
}

export interface KeeperShowFrame {
  clip: string;
  /** Seconds into `clip`. */
  t: number;
  /** Draw the ball at the clip's glove point (a catch, from contact on). */
  ballInHands: boolean;
  /** 0..1: how far his body has travelled from where he stood to his dive spot. */
  travel: number;
  /** He is on the floor (landed) — for the dust puff. Seconds since landing, or -1. */
  landedFor: number;
  /** A clip after a dive (get-up, holding, set): drawn from where he landed (the dive clip's `landM`). */
  afterDive: boolean;
}

/**
 * What to draw now. `len(clip)` = the clip's length in seconds; `timing(clip)`
 * its frames. Phases: the move (to contact and on to the landing), lying a
 * beat, getting up (with the ball after a catch), then standing (holding it).
 */
export function keeperShowFrame(
  s: KeeperShow,
  showNow: number,
  dir: "R" | "L",
  timing: (clip: string) => ClipTiming | null,
): KeeperShowFrame | null {
  const main = clipFor(s.plan.move, s.ending, dir);
  const T = timing(main);
  if (!T) return null;
  // A switch at contact (catch lead-in → parry) keeps the same moment: the
  // new clip is placed so ITS contact frame is now.
  let start = s.start;
  if (s.contactAt !== null && s.ending && s.ending !== "catch" && main.startsWith("kParry")) {
    const lead = (T.contactFrame ?? 0) / T.fps;
    start = Math.min(start, s.contactAt - lead);
  }
  const t = showNow - start;
  const len = T.frames / T.fps;
  const caught = s.ending === "catch";
  const contactT = (T.contactFrame ?? Math.round(T.frames * 0.4)) / T.fps;
  const ballInHands = caught && s.contactAt !== null && t >= contactT - 1 / T.fps;
  const dive = s.plan.move === "diveHigh" || s.plan.move === "diveLow";
  const travel = dive ? Math.max(0, Math.min(1, t / Math.max(0.05, contactT))) : 0;
  const landT = T.landFrame != null ? T.landFrame / T.fps : len;
  const landedFor = dive && t >= landT ? t - landT : -1;
  if (t < len) return { clip: main, t: Math.max(0, t), ballInHands, travel, landedFor, afterDive: false };
  // Down: lie a beat (longer after a dive), then up.
  const lie = dive ? (s.look === "arcade" && caught ? 0.25 : 0.45) : 0;
  if (dive && t < len + lie) return { clip: main, t: len - 1e-3, ballInHands, travel: 1, landedFor, afterDive: false };
  const up = dive ? (caught ? `kGetUpBall${dir}` : `kGetUp${dir}`) : null;
  const U = up ? timing(up) : null;
  const tu = t - len - lie;
  if (up && U && tu < U.frames / U.fps) return { clip: up, t: tu, ballInHands: caught, travel: 1, landedFor: -1, afterDive: true };
  // Standing again: holding it, or set.
  return { clip: caught ? "kHoldBall" : "ready", t: Math.max(0, tu - (U ? U.frames / U.fps : 0)), ballInHands: caught, travel: 1, landedFor: -1, afterDive: dive };
}

/** Broadcast look: slow the picture just before, at and after the ball reaches him. */
export function keeperSlowRate(s: KeeperShow | null, clockNow: number): number {
  if (!s || s.look !== "broadcast") return 1;
  const d = clockNow - s.plan.tLine;
  return d > -0.18 && d < 0.3 ? 0.35 : 1;
}

/** How long the match holds on him after a save, so you see him get up (ms). Off = the old 1800. */
export function keeperHoldMs(s: KeeperShow | null): number {
  if (!s || !s.ending || s.ending === "beaten") return 1800;
  return s.plan.move === "diveHigh" || s.plan.move === "diveLow" ? 3400 : 2400;
}
