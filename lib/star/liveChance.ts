/**
 * LIVE CHANCES (Leo, 29 Oct 2026): "every chance is live, moving … as the
 * ball's coming to you you have to time and aim the move right like in real
 * life … you obvs cant shoot BEFORE or AFTER the ball gets to you or youd be
 * kicking air, and it also obvs matters where the ball is when you do kick it
 * … if u let the ball go past u its like real life, chance missed."
 *
 * Off by default, per device (Settings → Updates, admins; the test page
 * /star-live-chances-dev has its own switch and dials, never saved). Off = the game as
 * before: the build-up plays, then the ball waits at your feet.
 *
 * On, for a chance where a pass comes to you on the ground:
 *  1. The chance becomes yours while the last pass is still on its way
 *     (`handT`), and the build-up's men keep running to their spots.
 *  2. Time runs at `slow` (lead seconds per real second) until you swing, so
 *     the pass takes about `arriveS` real seconds to reach you.
 *  3. You drag the arrow from the spot where you meet it (`spot`, the
 *     chance's own ball spot). Letting go IS the swing.
 *  4. Where the ball is when you swing decides the strike (`readSwing`):
 *     - in the sweet zone: a clean strike;
 *     - early (it has not reached you): you stab at the top of it, low and weaker;
 *     - late (it is past your plant foot): you get under it, it rises, weaker;
 *     - out of reach either way: fresh air, the chance is gone.
 *     The ball's own pace carries into the shot (a ball rolling across you
 *     pulls your shot that way).
 *  5. Never swing and it runs past you: the chance is gone.
 *
 * Pure: no engine physics here (the one-engine rule). CanvasMatch steps the
 * clock, draws the ball from `liveBallAt`, and strikes through the real
 * `launch` with what `readSwing` hands back.
 */
import type { Vec2 } from "./canvasEngine";

// ── The switch and its dials (per device) ──

export const LIVE_KEY = "kib-live-chances";
const EVENT = "kib-live-chances";

export interface LiveDials {
  /** Real seconds the last pass takes to reach you once the chance is yours. */
  arriveS: number;
  /** Slowest the clock may run while the pass comes (1 = real speed). */
  slowMin: number;
  /** Metres before the spot you can still reach it (an early swing). */
  reachEarly: number;
  /** Metres past the spot you can still reach it (a late swing). */
  reachLate: number;
  /** Metres either side of the spot that count as a clean strike. */
  sweet: number;
  /** How hard a rolling ball slows once it is past you (m/s²). */
  rollDecel: number;
  /** Extra slow motion while the ball is close to you (× on top of the rest; 1 = none). */
  nearSlow: number;
}
export const LIVE_DEFAULTS: LiveDials = { arriveS: 1.8, slowMin: 0.3, reachEarly: 1.1, reachLate: 0.9, sweet: 0.35, rollDecel: 1.6, nearSlow: 0.5 };
/** The guardrails the test page's dials stay inside. */
export const LIVE_LIMITS: Record<keyof LiveDials, [number, number]> = {
  arriveS: [0.6, 3.5], slowMin: [0.15, 1], reachEarly: [0.4, 2], reachLate: [0.3, 2], sweet: [0.1, 0.9], rollDecel: [0.5, 4], nearSlow: [0.2, 1],
};

function readOn(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(LIVE_KEY);
    return !!raw && (JSON.parse(raw) as { on?: boolean }).on === true;
  } catch { return false; }
}
/**
 * The test page's own setting (app/star-live-chances-dev): on for that page
 * only, with its dials. Kept in memory, never saved: the real game always
 * plays the defaults, and leaving the page clears it.
 */
let testOverride: { on: boolean; dials: Partial<LiveDials> } | null = null;
export function setLiveTest(o: { on: boolean; dials: Partial<LiveDials> } | null) { testOverride = o; }
/** Live chances on? The test page's own setting, else this device's switch. Off by default; always off on the server. */
export function liveChancesOn(): boolean { return testOverride ? testOverride.on : readOn(); }
export function setLiveChances(on: boolean) {
  try { window.localStorage.setItem(LIVE_KEY, JSON.stringify({ on })); } catch { /* private mode: stays off */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ }
}
export const LIVE_EVENT = EVENT;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** The dials: the defaults in the game, the test page's (each inside its guardrail) on it. */
export function liveDials(): LiveDials {
  const out = { ...LIVE_DEFAULTS };
  const d = testOverride?.dials ?? {};
  for (const k of Object.keys(LIVE_DEFAULTS) as (keyof LiveDials)[]) {
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clamp(v, LIVE_LIMITS[k][0], LIVE_LIMITS[k][1]);
  }
  return out;
}

// ── Which chances ──

/** Set pieces stay as they are; headers and volleys keep their own timing (Harry's aerials). */
const NOT_LIVE = new Set(["penalty", "free_kick", "corner", "header", "volley"]);
export function liveKindOK(kind: string): boolean { return !NOT_LIVE.has(kind); }

// ── The pass that comes to you ──

/** The bit of a build-up the plan reads (lib/star/leadIn.ts LeadIn). */
export interface LeadPath {
  durS: number;
  ballAt(t: number): { x: number; y: number; z: number };
  passStart?: number[];
  passEnd?: number[];
}

export interface LivePlan {
  /** Lead seconds at which the chance becomes yours (0 for a made-up pass). */
  handT: number;
  /** Lead seconds at which the pass reaches the spot. */
  t1: number;
  /** Where it meets you: the chance's own ball spot. */
  spot: Vec2;
  /** Its direction (unit) and speed (m/s) as it reaches the spot. */
  u: Vec2;
  v1: number;
  /** Lead seconds per real second until you swing. */
  slow: number;
  /** Lead seconds at which the last pass (or carry) set off. */
  t0: number;
  /** It is carried to the spot (a dribble at a steady pace), not passed. */
  carry: boolean;
  /** A made-up pass (no build-up to read): from here, starting at lead 0. */
  from?: Vec2;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
/** A pass slows a little as it runs (the same easing as leadIn.ts ballAlong). */
const passEase = (f: number) => f * (1.3 - 0.3 * f);

/**
 * The plan for a chance served after a build-up: the build-up's last pass, if
 * it ends on the chance's spot along the ground. Null: not a live chance (the
 * ball is carried to you, or it arrives in the air).
 */
export function planFromLead(lead: LeadPath, spot: Vec2, dials: LiveDials = LIVE_DEFAULTS): LivePlan | null {
  const ps = lead.passStart ?? [], pe = lead.passEnd ?? [];
  if (!ps.length || ps.length !== pe.length) return null;
  const t0 = ps[ps.length - 1], t1 = pe[pe.length - 1];
  if (!(t1 > t0) || t1 > lead.durS + 1e-6) return null;
  const end = lead.ballAt(t1), start = lead.ballAt(t0);
  if (dist(end, spot) > 0.8) return null; // the last pass is not the one that finds you
  if (end.z > 0.3) return null; // it arrives in the air: a header or volley's, not this
  // A ball over the top is fine (Leo's through ball), as long as it is down at
  // foot height by the time it is in your reach.
  for (let t = t1; t >= t0; t -= 0.02) {
    const q = lead.ballAt(t);
    if (dist(q, spot) > dials.reachEarly) break;
    if (q.z > 0.9) return null;
  }
  const L = dist(start, spot);
  if (L < 3) return null;
  const pre = lead.ballAt(Math.max(t0, t1 - 0.06));
  const dx = spot.x - pre.x, dy = spot.y - pre.y, m = Math.hypot(dx, dy);
  const u = m > 1e-4 ? { x: dx / m, y: dy / m } : { x: (spot.x - start.x) / L, y: (spot.y - start.y) / L };
  // A pass slows as it runs (it ends at 0.7 of its average pace); a carry is steady.
  const mid = lead.ballAt((t0 + t1) / 2);
  const carry = Math.abs(dist(start, mid) / L - 0.5) < 0.03;
  const v1 = (carry ? 1 : 0.7) * L / (t1 - t0);
  const handT = Math.max(t0 + 0.05, t1 - 1.1);
  const slow = clamp((t1 - handT) / dials.arriveS, dials.slowMin, 1);
  return { handT, t1, t0, carry, spot: { ...spot }, u, v1, slow };
}

/**
 * The plan for a chance with no build-up: a made-up pass from `from` (the
 * nearest team-mate, or 14 m behind you), along the ground at pass pace.
 */
export function planMadeUp(from: Vec2, spot: Vec2, dials: LiveDials = LIVE_DEFAULTS): LivePlan | null {
  const L = dist(from, spot);
  if (L < 3) return null;
  const avg = clamp(6 + L * 0.25, 8, 14); // m/s on average, longer passes harder
  const t1 = L / avg;
  const u = { x: (spot.x - from.x) / L, y: (spot.y - from.y) / L };
  const slow = clamp(t1 / dials.arriveS, dials.slowMin, 1);
  return { handT: 0, t1, t0: 0, carry: false, spot: { ...spot }, u, v1: 0.7 * avg, slow, from: { ...from } };
}

/** Where the made-up passer stands: the nearest team-mate at least 6 m away, else 14 m back toward your own goal. */
export function madeUpPasser(spot: Vec2, mates: Vec2[]): Vec2 {
  let best: Vec2 | null = null, bd = Infinity;
  for (const m of mates) { const d = dist(m, spot); if (d >= 6 && d < 32 && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x, y: best.y } : { x: spot.x, y: spot.y + 14 };
}

/** How far the ball has rolled past the spot `dt` seconds after reaching it (stops dead when it stops). */
export function rollPast(v1: number, decel: number, dt: number): number {
  const tStop = v1 / decel;
  const t = Math.min(Math.max(0, dt), tStop);
  return v1 * t - 0.5 * decel * t * t;
}

/** The ball at lead time T (pitch metres). Before t1: the build-up's own ball (or the made-up pass); after: rolling on. */
export function liveBallAt(plan: LivePlan, T: number, leadBallAt: ((t: number) => { x: number; y: number; z: number }) | null, decel = LIVE_DEFAULTS.rollDecel): Vec2 & { z: number } {
  if (T <= plan.t1) {
    if (plan.from) {
      const f = clamp(T / plan.t1, 0, 1), g = passEase(f);
      return { x: plan.from.x + (plan.spot.x - plan.from.x) * g, y: plan.from.y + (plan.spot.y - plan.from.y) * g, z: 0 };
    }
    if (leadBallAt) { const b = leadBallAt(T); return { x: b.x, y: b.y, z: Math.max(0, b.z) }; }
  }
  const s = rollPast(plan.v1, decel, T - plan.t1);
  return { x: plan.spot.x + plan.u.x * s, y: plan.spot.y + plan.u.y * s, z: 0 };
}
/** The ball's speed (m/s) at lead time T. */
export function liveSpeedAt(plan: LivePlan, T: number, decel = LIVE_DEFAULTS.rollDecel): number {
  if (T <= plan.t1) {
    if (plan.carry) return plan.v1;
    const f = clamp((T - plan.t0) / Math.max(1e-6, plan.t1 - plan.t0), 0, 1);
    return plan.v1 / 0.7 * (1.3 - 0.6 * f);
  }
  return Math.max(0, plan.v1 - decel * (T - plan.t1));
}
/**
 * The clock's rate right now (lead seconds per real second): the plan's slow
 * motion, and more of it (`nearSlow`) while the ball is within 2 m of your
 * reach, eased in over the 2 m before it, so the moment you strike is
 * playable on a phone.
 */
export function liveRate(plan: LivePlan, b: Vec2, dials: LiveDials = LIVE_DEFAULTS): number {
  const a = alongOf(plan, b);
  const into = a >= -dials.reachEarly ? 1 : clamp(1 - (-dials.reachEarly - a) / 2, 0, 1);
  const near = a > dials.reachLate + 0.15 ? 0 : into;
  return plan.slow * (1 - near * (1 - dials.nearSlow));
}
/** Metres along its line from the spot: negative = still coming, positive = gone past. */
export function alongOf(plan: LivePlan, b: Vec2): number { return (b.x - plan.spot.x) * plan.u.x + (b.y - plan.spot.y) * plan.u.y; }
/** Has it run past you, out of reach, with no swing? (The chance is gone.) */
export function runPast(plan: LivePlan, b: Vec2, dials: LiveDials = LIVE_DEFAULTS): boolean { return alongOf(plan, b) > dials.reachLate + 0.15; }
/** Has it stopped short of you, out of reach? (It never arrives: the chance is gone.) */
export function stoppedShort(plan: LivePlan, T: number, b: Vec2, dials: LiveDials = LIVE_DEFAULTS): boolean {
  return T > plan.t1 && liveSpeedAt(plan, T, dials.rollDecel) <= 0 && alongOf(plan, b) < -dials.reachEarly;
}

// ── The swing ──

export type SwingTiming = "early" | "sweet" | "late";
export type SwingRead =
  | { hit: false; why: "early" | "late"; along: number }
  | {
      hit: true; timing: SwingTiming; along: number;
      /** 0 = clean, 1 = the very edge of your reach. */
      off: number;
      /** Where on the ball you struck it (canvasEngine Contact: cy -1 top, +1 bottom). */
      contact: { cx: number; cy: number };
      dir: Vec2; power: number;
      /** Degrees the ball's own pace (and the timing) moved the shot off your aim. */
      bentDeg: number;
    };

/**
 * Read the swing: the ball at `b` moving at `speed`, your aim `aimDir` at
 * `power` (0..1). `r` is a seeded draw in [0, 1) for which way a stab skews.
 */
export function readSwing(plan: LivePlan, b: Vec2, speed: number, aimDir: Vec2, power: number, r: number, dials: LiveDials = LIVE_DEFAULTS): SwingRead {
  const along = alongOf(plan, b);
  const lat = -(b.x - plan.spot.x) * plan.u.y + (b.y - plan.spot.y) * plan.u.x;
  if (along < -dials.reachEarly || Math.abs(lat) > 1) return { hit: false, why: "early", along };
  if (along > dials.reachLate) return { hit: false, why: "late", along };
  const early = clamp((-along - dials.sweet) / Math.max(0.05, dials.reachEarly - dials.sweet), 0, 1);
  const late = clamp((along - dials.sweet) / Math.max(0.05, dials.reachLate - dials.sweet), 0, 1);
  const timing: SwingTiming = early > 0 ? "early" : late > 0 ? "late" : "sweet";
  const off = Math.max(early, late);
  // Where the foot meets it: a stab finds the top of the ball, a late one gets under it.
  const cy = timing === "early" ? -0.15 - 0.75 * early : timing === "late" ? -0.1 + 0.95 * late : -0.1;
  const cx = clamp(lat * 0.5, -0.5, 0.5);
  const am = Math.hypot(aimDir.x, aimDir.y) || 1;
  let ax = aimDir.x / am, ay = aimDir.y / am;
  // A stab skews off the toe one way or the other; a late one is dragged along the ball's line.
  const skew = timing === "early" ? (r < 0.5 ? -1 : 1) * 10 * early : 0;
  if (skew) { const c = Math.cos(skew * Math.PI / 180), s = Math.sin(skew * Math.PI / 180); [ax, ay] = [ax * c - ay * s, ax * s + ay * c]; }
  if (timing === "late") { ax += plan.u.x * 0.25 * late; ay += plan.u.y * 0.25 * late; }
  // The ball's own pace carries into the shot: the faster your strike, the less it shows.
  const strike = 8 + 24 * clamp(power, 0, 1);
  const carry = 0.3;
  const vx = ax * strike + plan.u.x * speed * carry, vy = ay * strike + plan.u.y * speed * carry;
  const vm = Math.hypot(vx, vy) || 1;
  const dir = { x: vx / vm, y: vy / vm };
  const bentDeg = Math.abs(Math.atan2(aimDir.x * dir.y - aimDir.y * dir.x, aimDir.x * dir.x + aimDir.y * dir.y)) * 180 / Math.PI;
  // Met coming onto you, a clean strike gets a little of its pace for free.
  const against = Math.max(0, -(plan.u.x * dir.x + plan.u.y * dir.y));
  const bonus = timing === "sweet" ? against * Math.min(speed, 14) / 14 * 0.08 : 0;
  const p = clamp(power * (1 - 0.45 * early - 0.3 * late) + bonus, 0.02, 1);
  return { hit: true, timing, along, off, contact: { cx, cy }, dir, power: p, bentDeg };
}

/** The line for the feed after a swing. */
export function swingLine(s: SwingRead, name: string): string {
  if (!s.hit) return s.why === "early" ? `${name} swings too early — fresh air!` : `${name} swings too late — it's gone past him.`;
  if (s.timing === "sweet") return Math.abs(s.along) < 0.15 ? `${name} meets it perfectly in his stride…` : `${name} hits it on the run…`;
  return s.timing === "early" ? `${name} stabs at it before it's there…` : `${name} lets it run too far and gets under it…`;
}
