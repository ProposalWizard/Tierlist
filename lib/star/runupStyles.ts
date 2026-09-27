/**
 * PENALTY RUN-UPS AND FREE-KICK RUN-UPS (v0.15) — two separate sets.
 *
 * Harry, 27 Sep 2026: "There should be 4, 5, 6 different penalty run-ups
 * because different players in world football run up differently. Some walk
 * slowly and then kick it. Some jump into kicking it … Some run up full power
 * and smash it. … maybe there's an animation section in the shop where you
 * can unlock new animations." And then: "animation run ups should be
 * completely seperate for pens and free kicks, use examples of elite players
 * for free kicks (maddison, ronaldo, bale, messi, neymar, trent. etc)".
 *
 * A style is how the taker gets from where he stands to the ball — how far
 * back he starts, the shape of the run, how fast he goes at each moment, and
 * how his body moves (stride, a stance, a skip, a lean). It is LOOKS ONLY:
 * the kick is the same launch() with the same aim and power whatever the
 * style (a knuckleball or a curl is still the strike YOU choose on the strike
 * screen), and the keeper does nothing during a run-up that depends on how
 * long it takes (tests/star/runupStyles.mts measures scoring per style on the
 * real engine).
 *
 * Penalty styles run on penalties only, free-kick styles on direct free kicks
 * only. Ids are unique across the two sets (free-kick ones start `fk_`), so a
 * career's `ownedAnimations` can hold both.
 *
 * The run-up itself — stand back, aim, jog, strike screen with its countdown
 * — is penaltyRunup.ts. Each set's "Standard" is exactly that run-up.
 *
 * Pure: no React, no canvas. CanvasMatch draws it.
 */
import type { Vec2, Viewport } from "./canvasEngine";
import { RUNUP, backDir, plantBeside, playerAt, sideOf, standBackAt } from "./penaltyRunup";

// ── The two sets ─────────────────────────────────────────────────────────

export type PenaltyRunupId = "standard" | "stroll" | "skip" | "sprint" | "stutter" | "two_step" | "arc";
export type FreeKickRunupId =
  | "fk_standard" | "fk_power_stance" | "fk_stance_sprint" | "fk_calm_curl"
  | "fk_stutter_curl" | "fk_angled_whip" | "fk_long_diagonal";
export type RunupId = PenaltyRunupId | FreeKickRunupId;

export interface RunupStyle<Id extends RunupId = RunupId> {
  id: Id;
  /** On screen. */
  name: string;
  /** One line for the shop and Settings. */
  blurb: string;
  /** The real taker it's modelled on (free kicks). */
  player?: string;
}

/** Penalty run-ups, in shop order. */
export const PENALTY_RUNUPS: RunupStyle<PenaltyRunupId>[] = [
  { id: "standard", name: "Standard", blurb: "A steady jog up to the ball." },
  { id: "stroll", name: "The Stroll", blurb: "Walks slowly up to the ball, then strikes." },
  { id: "skip", name: "The Skip", blurb: "A little skip and a jump into the kick." },
  { id: "sprint", name: "The Sprint", blurb: "Full speed from further back, and smash it." },
  { id: "stutter", name: "Stutter Step", blurb: "Stop, start — a pause just before the ball." },
  { id: "two_step", name: "Two Steps", blurb: "Very short: two steps and strike." },
  { id: "arc", name: "The Arc", blurb: "A wide, curved run in from the side." },
];

/** Free-kick run-ups, in shop order — each modelled on an elite free-kick taker. */
export const FREE_KICK_RUNUPS: RunupStyle<FreeKickRunupId>[] = [
  { id: "fk_standard", name: "Standard", blurb: "A steady jog up to the ball." },
  { id: "fk_power_stance", name: "Power Stance", player: "Ronaldo", blurb: "Ronaldo's knuckleball set-up: legs wide, a deep breath, then a few strong steps." },
  { id: "fk_stance_sprint", name: "Stance and Sprint", player: "Bale", blurb: "Bale's: the same wide stance, then a short sprint into it." },
  { id: "fk_calm_curl", name: "The Calm Curl", player: "Messi", blurb: "Messi's: a short, calm run — the set-up for curling it over the wall." },
  { id: "fk_stutter_curl", name: "Stutter Curl", player: "Neymar", blurb: "Neymar's: a short run, a little stutter, then the curl." },
  { id: "fk_angled_whip", name: "The Whip", player: "Maddison", blurb: "Maddison's: a short, angled approach for a whipped curl." },
  { id: "fk_long_diagonal", name: "Long Diagonal", player: "Trent", blurb: "Trent's: a long diagonal run for a whip that dips." },
];

/** Free, and everybody owns them. */
export const DEFAULT_PENALTY_RUNUP: PenaltyRunupId = "standard";
export const DEFAULT_FREE_KICK_RUNUP: FreeKickRunupId = "fk_standard";

// The shared contract's first names (the shop's Animations section): the
// penalty set. Kept so either name works.
export type RunupStyleId = PenaltyRunupId;
export const RUNUP_STYLES = PENALTY_RUNUPS;
export const DEFAULT_RUNUP_STYLE = DEFAULT_PENALTY_RUNUP;

const PEN_IDS = new Set<string>(PENALTY_RUNUPS.map((s) => s.id));
const FK_IDS = new Set<string>(FREE_KICK_RUNUPS.map((s) => s.id));

export function isPenaltyRunupId(v: unknown): v is PenaltyRunupId {
  return typeof v === "string" && PEN_IDS.has(v);
}
export function isFreeKickRunupId(v: unknown): v is FreeKickRunupId {
  return typeof v === "string" && FK_IDS.has(v);
}
/** @deprecated the contract's first name for isPenaltyRunupId. */
export const isRunupStyleId = isPenaltyRunupId;

/** A stored value made safe: anything unknown (an old save, a typo) is Standard. */
export function penaltyRunupOf(v: unknown): PenaltyRunupId {
  return isPenaltyRunupId(v) ? v : DEFAULT_PENALTY_RUNUP;
}
export function freeKickRunupOf(v: unknown): FreeKickRunupId {
  return isFreeKickRunupId(v) ? v : DEFAULT_FREE_KICK_RUNUP;
}
/** @deprecated the contract's first name for penaltyRunupOf. */
export const runupStyleOf = penaltyRunupOf;

/**
 * A career's equipped styles. `runupStyle` is where the first build saved the
 * penalty style (before the split) — read as the penalty one when
 * `penaltyRunup` isn't set.
 */
export function careerPenaltyRunup(c: { penaltyRunup?: unknown; runupStyle?: unknown } | null | undefined): PenaltyRunupId {
  return penaltyRunupOf(c?.penaltyRunup ?? c?.runupStyle);
}
export function careerFreeKickRunup(c: { freeKickRunup?: unknown } | null | undefined): FreeKickRunupId {
  return freeKickRunupOf(c?.freeKickRunup);
}

export function runupName(id: RunupId): string {
  return [...PENALTY_RUNUPS, ...FREE_KICK_RUNUPS].find((s) => s.id === id)?.name ?? "Standard";
}

/** Whether a career owns this style — each set's Standard always counts as owned. */
export function ownsRunup(owned: readonly string[] | undefined, id: RunupId): boolean {
  return id === DEFAULT_PENALTY_RUNUP || id === DEFAULT_FREE_KICK_RUNUP || !!owned?.includes(id);
}
/** @deprecated the contract's first name for ownsRunup. */
export const ownsRunupStyle = ownsRunup;

/** The styles a career can equip in each set: Standard plus whatever it has unlocked, in shop order. */
export function ownedPenaltyRunups(owned: readonly string[] | undefined): RunupStyle<PenaltyRunupId>[] {
  return PENALTY_RUNUPS.filter((s) => ownsRunup(owned, s.id));
}
export function ownedFreeKickRunups(owned: readonly string[] | undefined): RunupStyle<FreeKickRunupId>[] {
  return FREE_KICK_RUNUPS.filter((s) => ownsRunup(owned, s.id));
}

/** A string hashed to a stable number (his id, or his name). */
function hashKey(k: string): number {
  let h = 5381;
  for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  // A second mix so ids that differ only in their last character spread out.
  return Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
}

/**
 * The style a player the game controls (a team-mate or an opponent over the
 * ball) runs up with: picked from his id, or his name, so the same real
 * player always runs up the same way — kick after kick, match after match.
 * One pick from each set; the free-kick pick is salted so it doesn't simply
 * mirror his penalty one.
 */
export function takerPenaltyRunup(key: string | undefined | null): PenaltyRunupId {
  const k = (key ?? "").trim();
  if (!k) return DEFAULT_PENALTY_RUNUP;
  return PENALTY_RUNUPS[hashKey(k) % PENALTY_RUNUPS.length].id;
}
export function takerFreeKickRunup(key: string | undefined | null): FreeKickRunupId {
  const k = (key ?? "").trim();
  if (!k) return DEFAULT_FREE_KICK_RUNUP;
  return FREE_KICK_RUNUPS[hashKey(`fk:${k}`) % FREE_KICK_RUNUPS.length].id;
}
/** @deprecated the contract's first name for takerPenaltyRunup. */
export const takerRunupStyle = takerPenaltyRunup;

/** The right set for a kind of dead ball: a free kick's, or a penalty's. */
export function takerRunupFor(kind: string, key: string | undefined | null): RunupId {
  return kind === "free_kick" ? takerFreeKickRunup(key) : takerPenaltyRunup(key);
}
export function yourRunupFor(kind: string, penalty: PenaltyRunupId, freeKick: FreeKickRunupId): RunupId {
  return kind === "free_kick" ? freeKick : penalty;
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

const STANDARD_MOTION: RunupMotion = { runS: RUNUP.runupS, startBack: RUNUP.startBack, startAngleDeg: RUNUP.startAngleDeg, curve: 0 };

export const RUNUP_MOTION: Record<RunupId, RunupMotion> = {
  // ── Penalties ──
  // Exactly penaltyRunup.ts's run-up.
  standard: STANDARD_MOTION,
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

  // ── Free kicks ──
  fk_standard: STANDARD_MOTION,
  // Ronaldo: nearly straight behind it, a long way back — stands, breathes, goes.
  fk_power_stance: { runS: 3.0, startBack: 5.2, startAngleDeg: 6, curve: 0 },
  // Bale: the same stance, then a short, fast burst.
  fk_stance_sprint: { runS: 2.4, startBack: 5.0, startAngleDeg: 10, curve: 0 },
  // Messi: close, a little to the side, unhurried.
  fk_calm_curl: { runS: 1.9, startBack: 2.4, startAngleDeg: 38, curve: 0 },
  // Neymar: short, with a stop-start shimmy.
  fk_stutter_curl: { runS: 2.7, startBack: 3.4, startAngleDeg: 34, curve: 0 },
  // Maddison: short, from a wide angle.
  fk_angled_whip: { runS: 2.1, startBack: 3.2, startAngleDeg: 55, curve: 0 },
  // Trent: a long run on the diagonal.
  fk_long_diagonal: { runS: 3.0, startBack: 7.0, startAngleDeg: 42, curve: 0 },
};

export function runupDurationS(id: RunupId): number {
  return RUNUP_MOTION[id].runS;
}

/**
 * Where he stands before this style's run-up, kept inside the picture
 * (`view`, with a margin) — a long run-up on a free kick from 30 m would
 * otherwise start off the bottom of the screen. Shortened, never moved
 * sideways, so it is still the style's line.
 */
export function standBackFor(id: RunupId, ball: Vec2, player: Vec2, view?: Viewport): Vec2 {
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
  id: RunupId;
  from: Vec2;
  to: Vec2;
  /** The bend's pull point (a curved run only). */
  ctrl?: Vec2;
  /** Which side of the ball he comes from: +1 his right, −1 his left. */
  side: number;
}

/** The run from where he stands (`from`) to beside the ball. */
export function planRunup(id: RunupId, ball: Vec2, from: Vec2): StyledRunup {
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
/** penaltyRunup.ts's own jog curve. */
const jog = (u: number) => 0.18 * clamp01(u) + 0.82 * smooth(u);

/** How far along the run he is (0..1 of the distance) `t` seconds in. */
export function runupProgress(id: RunupId, t: number): number {
  const T = RUNUP_MOTION[id].runS;
  const u = clamp01(t / T);
  switch (id) {
    case "standard":
    case "fk_standard":
    case "arc":
    case "fk_calm_curl":
    case "fk_angled_whip":
      return jog(u);
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
    case "fk_power_stance":
      // Stands for 1.3 s, then a few strong steps.
      return t < 1.3 ? 0 : jog(span(t, 1.3, T));
    case "fk_stance_sprint":
      // Stands for 0.8 s, then bursts in, accelerating.
      if (t < 0.8) return 0;
      { const v = span(t, 0.8, T); return 0.2 * v + 0.8 * Math.pow(v, 1.6); }
    case "fk_stutter_curl":
      if (t < 0.9) return lerp(0, 0.5, span(t, 0, 0.9));
      if (t < 1.5) return lerp(0.5, 0.56, span(t, 0.9, 1.5));
      return lerp(0.56, 1, jog(span(t, 1.5, T)));
    case "fk_long_diagonal":
      return 0.2 * u + 0.8 * smooth(u);
  }
}

/** Where he is `t` seconds into the run-up. */
export function runupPositionAt(r: StyledRunup, t: number): Vec2 {
  if (r.id === "standard" || r.id === "fk_standard") return playerAt({ from: r.from, to: r.to }, t / STANDARD_MOTION.runS);
  const e = runupProgress(r.id, t);
  if (!r.ctrl) return { x: lerp(r.from.x, r.to.x, e), y: lerp(r.from.y, r.to.y, e) };
  const a = 1 - e;
  return {
    x: a * a * r.from.x + 2 * a * e * r.ctrl.x + e * e * r.to.x,
    y: a * a * r.from.y + 2 * a * e * r.ctrl.y + e * e * r.to.y,
  };
}

/**
 * How his body moves at `t`: the legs (−1..1 and a bit over for a sprint; +
 * opens the feet wide, which is also a planted stance), the arms, how low he
 * is (crouch 0..1), how far off the ground (`lift`, a share of his height)
 * and how far he leans (radians, + to the right of the screen). Null for
 * Standard — the match's ordinary run.
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
  // The wide-legged stance before a knuckleball: feet planted wide, arms a
  // little away from the body, and a deep breath — the chest rises and settles.
  const stance = (breathFrom: number, breathTo: number): RunupPose => ({
    ...base, legSwing: 1.15, armSpread: 0.3, armLift: -0.75,
    crouch: 0.14 - 0.14 * Math.sin(Math.PI * span(t, breathFrom, breathTo)),
  });
  switch (r.id) {
    case "standard":
    case "fk_standard":
      return null;
    case "stroll": {
      // A walk: short, slow steps, arms hanging, upright. Settles at the ball.
      const settle = 1 - smooth(span(t, T - 0.3, T));
      // …and the small rise and fall of a man walking, twice a stride.
      return { ...base, legSwing: run(5.2, 0.35) * settle, armLift: -1, lift: 0.014 * Math.abs(Math.sin(t * 5.2)) * settle };
    }
    case "sprint": {
      // Long, fast strides, low and driving, arms pumping — off the ground
      // between strides, like a real sprinter.
      return { ...base, legSwing: run(16, 1.6), crouch: 0.22, armSpread: 0.3, armLift: -0.05, lift: 0.03 * Math.abs(Math.sin(t * 16)) };
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
    case "fk_power_stance": {
      if (t < 1.3) return stance(0.15, 1.2);
      // Few, strong steps.
      return { ...base, legSwing: run(10, 1.15), crouch: 0.12, armSpread: 0.2 };
    }
    case "fk_stance_sprint": {
      if (t < 0.8) return stance(0.05, 0.75);
      return { ...base, legSwing: run(16, 1.5), crouch: 0.2, armSpread: 0.3, armLift: -0.05, lift: 0.025 * Math.abs(Math.sin(t * 16)) };
    }
    case "fk_calm_curl": {
      // Unhurried: short steps, arms low, upright.
      return { ...base, legSwing: run(7.5, 0.6), armLift: -0.85 };
    }
    case "fk_stutter_curl": {
      if (t < 0.9) return { ...base, legSwing: run(10, 0.9) };
      if (t < 1.5) {
        // The stutter: quick little steps on the spot and a shimmy of the shoulders.
        return { ...base, legSwing: run(22, 0.25), crouch: 0.2, armSpread: 0.3, lean: 0.14 * Math.sin(t * 14) };
      }
      return { ...base, legSwing: run(12, 0.9), crouch: 0.1 };
    }
    case "fk_angled_whip": {
      // Side-on to the ball the whole way: the body angled across.
      return { ...base, legSwing: run(10, 0.95), crouch: 0.1, armSpread: 0.2, lean: -r.side * 0.16 };
    }
    case "fk_long_diagonal": {
      // A long, rhythmic run, leaning in as he comes across.
      const u = clamp01(t / T);
      return { ...base, legSwing: run(11, 1.1), armSpread: 0.15, lean: -r.side * 0.12 * Math.sin(Math.PI * u) };
    }
  }
}
