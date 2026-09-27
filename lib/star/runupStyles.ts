/**
 * PENALTY AND FREE-KICK RUN-UP STYLES (v0.15).
 *
 * Harry, 27 Sep 2026: "There should be 4, 5, 6 different penalty run-ups
 * because different players in world football run up differently. Some walk
 * slowly and then kick it. Some jump into kicking it … Some run up full power
 * and smash it. … maybe there's an animation section in the shop where you
 * can unlock new animations."
 *
 * A style is how the taker gets from where he stands to the ball — how far
 * back he starts, the shape of the run, how fast he goes at each moment, and
 * how his body moves (stride, a skip, a lean). It is LOOKS ONLY: the kick is
 * the same launch() with the same aim and power whatever the style, and the
 * keeper does nothing during a run-up that depends on how long it takes
 * (tests/star/runupStyles.mts measures scoring per style on the real engine).
 *
 * The run-up itself — stand back, aim, jog, strike screen with its countdown
 * — is penaltyRunup.ts. "standard" is exactly that run-up, unchanged.
 *
 * Pure: no React, no canvas. CanvasMatch draws it.
 */
import type { Vec2, Viewport } from "./canvasEngine";
import { RUNUP, backDir, plantBeside, playerAt, sideOf, standBackAt } from "./penaltyRunup";

// ── The contract (shared with the shop's Animations section) ─────────────

export type RunupStyleId = "standard" | "stroll" | "skip" | "sprint" | "stutter" | "two_step" | "arc";

export interface RunupStyle { id: RunupStyleId; name: string; blurb: string; }

/** Every style, in shop order. */
export const RUNUP_STYLES: RunupStyle[] = [
  { id: "standard", name: "Standard", blurb: "A steady jog up to the ball." },
  { id: "stroll", name: "The Stroll", blurb: "Walks slowly up to the ball, then strikes." },
  { id: "skip", name: "The Skip", blurb: "A little skip and a jump into the kick." },
  { id: "sprint", name: "The Sprint", blurb: "Full speed from further back, and smash it." },
  { id: "stutter", name: "Stutter Step", blurb: "Stop, start — a pause just before the ball." },
  { id: "two_step", name: "Two Steps", blurb: "Very short: two steps and strike." },
  { id: "arc", name: "The Arc", blurb: "A wide, curved run in from the side." },
];

/** Free, and everybody owns it. */
export const DEFAULT_RUNUP_STYLE: RunupStyleId = "standard";

const IDS = new Set<string>(RUNUP_STYLES.map((s) => s.id));

export function isRunupStyleId(v: unknown): v is RunupStyleId {
  return typeof v === "string" && IDS.has(v);
}

/** A stored value made safe: anything unknown (an old save, a typo) is Standard. */
export function runupStyleOf(v: unknown): RunupStyleId {
  return isRunupStyleId(v) ? v : DEFAULT_RUNUP_STYLE;
}

export function runupStyleName(id: RunupStyleId): string {
  return RUNUP_STYLES.find((s) => s.id === id)?.name ?? "Standard";
}

/** Whether a career owns this style — Standard always counts as owned. */
export function ownsRunupStyle(owned: readonly string[] | undefined, id: RunupStyleId): boolean {
  return id === DEFAULT_RUNUP_STYLE || !!owned?.includes(id);
}

/** The styles a career can equip: Standard plus whatever it has unlocked, in shop order. */
export function ownedRunupStyles(owned: readonly string[] | undefined): RunupStyle[] {
  return RUNUP_STYLES.filter((s) => ownsRunupStyle(owned, s.id));
}

/**
 * The style a player the game controls (a team-mate or an opponent over a
 * penalty) runs up with: picked from his id, or his name, so the same real
 * player always runs up the same way — kick after kick, match after match.
 */
export function takerRunupStyle(key: string | undefined | null): RunupStyleId {
  const k = (key ?? "").trim();
  if (!k) return DEFAULT_RUNUP_STYLE;
  let h = 5381;
  for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  // A second mix so ids that differ only in their last character spread out.
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return RUNUP_STYLES[h % RUNUP_STYLES.length].id;
}

// ── How each one moves ───────────────────────────────────────────────────

export interface RunupMotion {
  /** Seconds from letting go of the aim to the strike screen. */
  runS: number;
  /** Where he starts: this far back from the ball… */
  startBack: number;
  /** …and this many degrees off the straight line behind it, to his side. */
  startAngleDeg: number;
  /** A curved run: how far (0..1 of the way back) the bend's pull point sits. 0 = straight. */
  curve: number;
}

export const RUNUP_MOTION: Record<RunupStyleId, RunupMotion> = {
  // Exactly penaltyRunup.ts's run-up.
  standard: { runS: RUNUP.runupS, startBack: RUNUP.startBack, startAngleDeg: RUNUP.startAngleDeg, curve: 0 },
  // A walk: ~1.2 m/s.
  stroll: { runS: 3.1, startBack: 3.8, startAngleDeg: 26, curve: 0 },
  // A jog, a gather, one skip, and plant.
  skip: { runS: 2.5, startBack: 3.9, startAngleDeg: 30, curve: 0 },
  // Twice as far back, accelerating all the way in (~5 m/s at the ball).
  sprint: { runS: 2.3, startBack: 7.2, startAngleDeg: 16, curve: 0 },
  // Jog, stop dead on his toes, then go.
  stutter: { runS: 3.0, startBack: 4.4, startAngleDeg: 30, curve: 0 },
  // Right behind the ball: set, two strides, strike.
  two_step: { runS: 1.7, startBack: 1.6, startAngleDeg: 14, curve: 0 },
  // Starts almost level with the ball out to the side and bends in behind it.
  arc: { runS: 2.8, startBack: 5.4, startAngleDeg: 74, curve: 0.8 },
};

export function runupDurationS(id: RunupStyleId): number {
  return RUNUP_MOTION[id].runS;
}

/**
 * Where he stands before this style's run-up, kept inside the picture
 * (`view`, with a margin) — a sprint's long run-up on a free kick from 30 m
 * would otherwise start off the bottom of the screen. Shortened, never moved
 * sideways, so it is still the style's line.
 */
export function standBackFor(id: RunupStyleId, ball: Vec2, player: Vec2, view?: Viewport): Vec2 {
  const m = RUNUP_MOTION[id];
  let back = m.startBack;
  if (view) {
    const margin = 1.6;
    const inside = (p: Vec2) => p.x >= view.x1 + margin && p.x <= view.x2 - margin && p.y >= view.y1 + margin && p.y <= view.y2 - margin;
    for (let i = 0; i < 40 && back > 1.2; i++) {
      if (inside(standBackAt(ball, player, back, m.startAngleDeg))) break;
      back -= 0.2;
    }
  }
  return standBackAt(ball, player, back, m.startAngleDeg);
}

export interface StyledRunup {
  id: RunupStyleId;
  from: Vec2;
  to: Vec2;
  /** The bend's pull point (a curved run only). */
  ctrl?: Vec2;
  /** Which side of the ball he comes from: +1 his right, −1 his left. */
  side: number;
}

/** The run from where he stands (`from`) to beside the ball. */
export function planRunup(id: RunupStyleId, ball: Vec2, from: Vec2): StyledRunup {
  const to = plantBeside(ball, from);
  const side = sideOf(ball, from);
  const m = RUNUP_MOTION[id];
  if (m.curve <= 0) return { id, from: { ...from }, to, side };
  // The pull point: straight back behind the ball, part of the way out —
  // so he sets off across, bends round, and comes in behind the ball.
  const b = backDir(ball);
  const back = Math.hypot(from.x - ball.x, from.y - ball.y) * m.curve;
  const ctrl = { x: ball.x + b.x * back * 0.95 + (from.x - ball.x) * 0.25, y: ball.y + b.y * back * 0.95 + (from.y - ball.y) * 0.25 };
  return { id, from: { ...from }, to, ctrl, side };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
/** Where `t` falls inside [a, b], 0..1. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** How far along the run he is (0..1 of the distance) `t` seconds in. */
export function runupProgress(id: RunupStyleId, t: number): number {
  const T = RUNUP_MOTION[id].runS;
  const u = clamp01(t / T);
  switch (id) {
    case "standard":
    case "arc":
      // penaltyRunup.ts's own jog curve.
      return 0.18 * u + 0.82 * smooth(u);
    case "stroll":
      return 0.85 * u + 0.15 * smooth(u);
    case "sprint":
      // Accelerating the whole way in.
      return 0.2 * u + 0.8 * Math.pow(u, 1.7);
    case "skip":
      if (t < 1.45) return lerp(0, 0.6, span(t, 0, 1.45));
      if (t < 1.65) return lerp(0.6, 0.66, span(t, 1.45, 1.65));
      if (t < 2.2) return lerp(0.66, 0.93, span(t, 1.65, 2.2));
      return lerp(0.93, 1, smooth(span(t, 2.2, T)));
    case "stutter":
      if (t < 1.15) return lerp(0, 0.6, span(t, 0, 1.15));
      if (t < 2.15) return lerp(0.6, 0.63, span(t, 1.15, 2.15));
      return lerp(0.63, 1, span(t, 2.15, T));
    case "two_step":
      if (t < 0.7) return 0;
      return smooth(span(t, 0.7, T));
  }
}

/** Where he is `t` seconds into the run-up. */
export function runupPositionAt(r: StyledRunup, t: number): Vec2 {
  const e = runupProgress(r.id, t);
  if (r.id === "standard") return playerAt({ from: r.from, to: r.to }, t / RUNUP_MOTION.standard.runS);
  if (!r.ctrl) return { x: lerp(r.from.x, r.to.x, e), y: lerp(r.from.y, r.to.y, e) };
  const a = 1 - e;
  return {
    x: a * a * r.from.x + 2 * a * e * r.ctrl.x + e * e * r.to.x,
    y: a * a * r.from.y + 2 * a * e * r.ctrl.y + e * e * r.to.y,
  };
}

/**
 * How his body moves at `t`: the stride (the legs' scissor, −1..1 and a bit
 * over for a sprint), the arms, how low he is (crouch 0..1), how far off the
 * ground (`lift`, a share of his height) and how far he leans (radians, + to
 * the right of the screen). Null for Standard — the match's ordinary run.
 */
export interface RunupPose {
  legSwing: number;
  armSpread: number;
  armLift: number;
  crouch: number;
  lift: number;
  lean: number;
}

export function runupPoseAt(r: StyledRunup, t: number): RunupPose | null {
  const T = RUNUP_MOTION[r.id].runS;
  const run = (rate: number, amp: number) => amp * Math.sin(t * rate);
  const base: RunupPose = { legSwing: 0, armSpread: 0, armLift: -0.55, crouch: 0, lift: 0, lean: 0 };
  switch (r.id) {
    case "standard":
      return null;
    case "stroll": {
      // A walk: short, slow steps, arms hanging, upright. Settles at the ball.
      const settle = 1 - smooth(span(t, T - 0.3, T));
      return { ...base, legSwing: run(5.2, 0.4) * settle, armLift: -0.9 };
    }
    case "sprint": {
      // Long, fast strides, low and driving, arms pumping.
      return { ...base, legSwing: run(15, 1.3), crouch: 0.45, armSpread: 0.15, armLift: -0.25 };
    }
    case "skip": {
      if (t < 1.45) return { ...base, legSwing: run(9, 1) };
      if (t < 1.65) {
        // The gather: sinks, feet coming together.
        const g = span(t, 1.45, 1.65);
        return { ...base, legSwing: run(9, 1) * (1 - g), crouch: 0.5 * g, armSpread: 0.2 * g };
      }
      if (t < 2.2) {
        // The skip: off the ground, one knee through, arms up for balance.
        const s = span(t, 1.65, 2.2);
        return { ...base, legSwing: 0.7, lift: 0.26 * Math.sin(Math.PI * s), crouch: 0.15 * (1 - Math.sin(Math.PI * s)), armSpread: 0.6, armLift: 0.35 };
      }
      // The landing, into the plant.
      const l = span(t, 2.2, T);
      return { ...base, legSwing: -0.4, crouch: 0.45 * (1 - l) + 0.15, armSpread: 0.45 };
    }
    case "stutter": {
      if (t < 1.15) return { ...base, legSwing: run(9, 1) };
      if (t < 2.15) {
        // Stopped dead, up on his toes: a little shuffle and a bounce.
        return { ...base, legSwing: run(20, 0.2), crouch: 0.28 + 0.12 * Math.sin(t * 11), armSpread: 0.35, armLift: -0.3 };
      }
      return { ...base, legSwing: run(14, 0.9), crouch: 0.15 };
    }
    case "two_step": {
      if (t < 0.7) {
        // Set behind the ball, low, arms out — then two big strides.
        return { ...base, crouch: 0.4, armSpread: 0.35, armLift: -0.3 };
      }
      const v = span(t, 0.7, T);
      return { ...base, legSwing: 1.2 * Math.sin(2 * Math.PI * v), crouch: 0.2, armSpread: 0.15 };
    }
    case "arc": {
      // A run on a bend leans into it — toward the ball's side (−his side),
      // hardest mid-curve.
      const u = clamp01(t / T);
      return { ...base, legSwing: run(10, 1.05), crouch: 0.15, lean: -r.side * 0.3 * Math.sin(Math.PI * u) };
    }
  }
}
