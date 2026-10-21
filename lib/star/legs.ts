/**
 * YOUR LEGS IN THE 2D MATCH — how fast you move, and the stamina bar (B14,
 * Harry, 20 Oct 2026: "WASD to move your player and Shift to sprint … a
 * stamina bar, on PC and phone").
 *
 * One system, three places:
 *   - SPEEDS come from your pace, the same numbers the 3D games use
 *     (three3d/gait.ts speedsForPace: pace 50 = run 5.1, sprint 6.9 m/s).
 *   - THE BAR is the 3D games' sprint bar (gait.ts stepStamina / staminaFor:
 *     a fitter man has a bigger bar and refills faster), with one rule on top:
 *     it can never refill past your match ENERGY. At 60 energy the bar stops
 *     at 60%. So the stamina bar and the energy bar can never disagree: the
 *     bar is the part of your energy you can spend in a sprint right now.
 *   - SPRINTING COSTS REAL ENERGY: SPRINT_ENERGY_PER_S points of match energy
 *     a second, on top of the minute-by-minute drain. The match takes it off
 *     the same energy the career saves (CanvasMatch energyRef).
 *
 * Pure: no React, no canvas. Today it moves you after you have played the ball
 * (lib/star/playOn.ts, the run). The dribble (Harry, 20 Oct 17:20: "higher
 * dribbling skill = dribble for longer, a faster step-off, skill moves") can use
 * the same legs with the ball at your feet: `carry` slows you while you have it.
 */
import type { Vec2 } from "./canvasEngine";
import {
  speedsForPace, stickTarget, approach, stepStamina, staminaFor, effortOf, canSprint,
  type GaitSpeeds, type Stamina, type StaminaFit,
} from "./three3d/gait";

/** Points of match energy (0–100) a full second of sprinting costs. A 6 s sprint ≈ 0.7. */
export const SPRINT_ENERGY_PER_S = 0.12;
/** The bar never refills past this share of your energy (energy 60 → bar stops at 60%). */
export const BAR_CAP_PER_ENERGY = 1 / 100;
/** With the ball at your feet you are this much slower (for the dribble, later). */
export const CARRY_SPEED_K = 0.85;

export interface Legs {
  speeds: GaitSpeeds;
  fit: StaminaFit;
  stamina: Stamina;
  /** The most the bar can be right now (0..1), from your energy. */
  cap: number;
  /** Your velocity, m/s, in pitch directions. */
  vel: Vec2;
  /** Sprinting this substep (for the bar's colour and the figure). */
  sprinting: boolean;
  /** Energy spent sprinting since the last `takeEnergySpent`. */
  spent: number;
}

/** The bar's cap from your match energy (0–100). */
export const barCap = (energy: number) => Math.max(0, Math.min(1, (Number.isFinite(energy) ? energy : 100) * BAR_CAP_PER_ENERGY));

/** Fresh legs for a chance: pace and physical (0–100), your energy, and how full the bar was (0..1, default full). */
export function newLegs(o: { pace?: number; physical?: number; energy?: number; bar?: number }): Legs {
  const cap = barCap(o.energy ?? 100);
  const v = Math.min(cap, o.bar ?? 1);
  return {
    speeds: speedsForPace(o.pace ?? 50),
    fit: staminaFor(o.physical ?? 50),
    stamina: { v, tired: v <= 0 },
    cap,
    vel: { x: 0, y: 0 },
    sprinting: false,
    spent: 0,
  };
}

/** Your energy has moved (the minute-by-minute drain): the bar's cap follows it. */
export function setLegsEnergy(l: Legs, energy: number) {
  l.cap = barCap(energy);
  if (l.stamina.v > l.cap) l.stamina = { ...l.stamina, v: l.cap };
}

/**
 * One step: push (pitch directions, length 0..1) and whether sprint is held.
 * A full push or sprint held sprints while the bar has some in it; empty, you
 * run until it is back to a quarter (gait.ts STAMINA.resume). Speed builds and
 * eases (gait.ts approach). Returns nothing; moves `p`.
 */
export function stepLegs(l: Legs, p: Vec2, push: Vec2, sprintHeld: boolean, dt: number, o: { carry?: boolean; bounds?: boolean } = {}) {
  const mag = Math.min(1, Math.hypot(push.x, push.y));
  const s = o.carry ? scaleSpeeds(l.speeds, CARRY_SPEED_K) : l.speeds;
  const able = canSprint(l.stamina) && l.cap > 0.02;
  const want = stickTarget(mag, sprintHeld && mag > 0.08, s, able);
  const cur = Math.hypot(l.vel.x, l.vel.y);
  const speed = approach(cur, want, dt, s);
  // Direction: turn toward the push quickly, keep going the same way while slowing to a stop.
  let ux = 0, uy = 0;
  if (mag > 1e-6) { ux = push.x / mag; uy = push.y / mag; }
  else if (cur > 1e-6) { ux = l.vel.x / cur; uy = l.vel.y / cur; }
  if (mag > 1e-6 && cur > 1e-6) {
    // Blend the old heading into the new over ~0.12 s, so a hard turn is not a teleport.
    const k = Math.min(1, dt / 0.12);
    const hx = l.vel.x / cur + (ux - l.vel.x / cur) * k, hy = l.vel.y / cur + (uy - l.vel.y / cur) * k;
    const hl = Math.hypot(hx, hy) || 1;
    ux = hx / hl; uy = hy / hl;
  }
  l.vel = { x: ux * speed, y: uy * speed };
  if (o.bounds !== false) {
    p.x = Math.max(-2, Math.min(70, p.x + l.vel.x * dt));
    p.y = Math.max(-2, Math.min(106, p.y + l.vel.y * dt));
  } else { p.x += l.vel.x * dt; p.y += l.vel.y * dt; }
  l.sprinting = want >= s.sprint - 1e-6 && speed > s.run * 0.9;
  const effort = effortOf(speed, l.sprinting, s);
  l.stamina = stepStamina(l.stamina, effort, dt, 1, l.fit);
  if (l.stamina.v > l.cap) l.stamina = { ...l.stamina, v: l.cap };
  if (effort === "sprint") l.spent += SPRINT_ENERGY_PER_S * dt;
}

/** Energy spent sprinting since last asked (the match takes it off your energy). */
export function takeEnergySpent(l: Legs): number {
  const s = l.spent;
  l.spent = 0;
  return s;
}

function scaleSpeeds(s: GaitSpeeds, k: number): GaitSpeeds {
  return { walk: s.walk * k, jog: s.jog * k, run: s.run * k, sprint: s.sprint * k };
}

// ── Keys (PC) ─────────────────────────────────────────────────────────────

export interface MoveKeys { up: boolean; down: boolean; left: boolean; right: boolean; sprint: boolean }
export const noKeys = (): MoveKeys => ({ up: false, down: false, left: false, right: false, sprint: false });

/** W A S D (and the arrow keys) and Shift. Returns the key's job, or null. */
export function moveKeyOf(code: string): keyof MoveKeys | null {
  switch (code) {
    case "KeyW": case "ArrowUp": return "up";
    case "KeyS": case "ArrowDown": return "down";
    case "KeyA": case "ArrowLeft": return "left";
    case "KeyD": case "ArrowRight": return "right";
    case "ShiftLeft": case "ShiftRight": return "sprint";
    default: return null;
  }
}

/** The screen direction the keys ask for (x right, y down), length 0 or 1. */
export function keysScreenDir(k: MoveKeys): Vec2 {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0), y = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const m = Math.hypot(x, y);
  return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 0 };
}

/** A key push is a run (not a full push); Shift makes it a sprint. */
export const KEY_PUSH = 0.9;
