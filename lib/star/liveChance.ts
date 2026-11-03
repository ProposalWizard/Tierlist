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

/** What this phone has saved: the switch, the strike screen, the dials (Settings → Updates → Live chances). */
interface Saved { on: boolean; strike: boolean; dials: Partial<LiveDials> }
function readSaved(): Saved {
  const none: Saved = { on: false, strike: true, dials: {} };
  try {
    if (typeof window === "undefined") return none;
    const raw = window.localStorage.getItem(LIVE_KEY);
    if (!raw) return none;
    const s = JSON.parse(raw) as Partial<Saved>;
    return { on: s.on === true, strike: s.strike !== false, dials: s.dials && typeof s.dials === "object" ? s.dials : {} };
  } catch { return none; }
}
function writeSaved(s: Saved) {
  try { window.localStorage.setItem(LIVE_KEY, JSON.stringify(s)); } catch { /* private mode: stays off */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ }
}
/**
 * The test page's own setting (app/star-live-chances-dev): on for that page
 * only, with its strike screen and dials. Kept in memory, never saved;
 * leaving the page clears it and the game plays this phone's own settings.
 */
/** The test page's own setting. `stats`: pretend to be a player with these; `manual`: its dials by hand, over the stats. */
export interface LiveTest { on: boolean; strike: boolean; dials: Partial<LiveDials>; stats?: LiveSkills; manual?: boolean }
let testOverride: LiveTest | null = null;
export function setLiveTest(o: LiveTest | null) { testOverride = o; }
/** The test page's pretend player, if it set one (the match reads it instead of the career's). */
export function liveTestStats(): LiveSkills | null { return testOverride?.stats ?? null; }
/** Live chances on? The test page's own setting, else this phone's switch. Off by default; always off on the server. */
export function liveChancesOn(): boolean { return testOverride ? testOverride.on : readSaved().on; }
export function setLiveChances(on: boolean) { writeSaved({ ...readSaved(), on }); }
/**
 * THE KICK SCREEN (Leo, 30-31 Oct 2026: "a toggle for whether or not there's
 * still the kick part of the move after you aim and let go … what about
 * curve? chips? height?" … "i meant normal kick screen"). On (the default):
 * letting go is the moment you meet the pass (it sets early / clean / late
 * and stops the pass there), then the game's normal kick screen opens and
 * your tap on it is where on the ball (curve, chip, height). Out of reach
 * when you let go: fresh air, no kick screen. Off: letting go is the kick.
 */
export function liveStrikeScreenOn(): boolean { return testOverride ? testOverride.strike : readSaved().strike; }
export function setLiveStrikeScreen(strike: boolean) { writeSaved({ ...readSaved(), strike }); }
export const LIVE_EVENT = EVENT;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/**
 * The dials for a chance. In the game: from the player's stats (liveDialsFor;
 * Leo, 1 Nov 2026: "anything skill related should be related to levels").
 * On the test page: its pretend player's stats, or its dials by hand.
 */
export function liveDials(skills?: LiveSkills | null): LiveDials {
  const st = testOverride?.stats ?? skills ?? null;
  const out = st ? liveDialsFor(st) : { ...LIVE_DEFAULTS };
  if (!(testOverride && testOverride.manual)) return out;
  const d = testOverride.dials;
  for (const k of Object.keys(LIVE_DEFAULTS) as (keyof LiveDials)[]) {
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clamp(v, LIVE_LIMITS[k][0], LIVE_LIMITS[k][1]);
  }
  return out;
}
/** Save one dial on this phone (Settings), or all back to the defaults (null). */
export function setLiveDial(k: keyof LiveDials, v: number) { const s = readSaved(); writeSaved({ ...s, dials: { ...s.dials, [k]: clamp(v, LIVE_LIMITS[k][0], LIVE_LIMITS[k][1]) } }); }
export function resetLiveDials() { writeSaved({ ...readSaved(), dials: {} }); }

// ── Skill from the player's stats (Leo, 1 Nov 2026) ──

/** The stats a live chance reads (0..100 each; tired legs already taken off by the match). */
export interface LiveSkills { pace: number; power: number; technique: number; vision: number }
const share = (v: number) => clamp((Number.isFinite(v) ? v : 55) - 40, 0, 55) / 55;
/**
 * What each stat does (40 = the floor, 95 = the top):
 *  - Technique: the clean zone (0.22 → 0.50 m) and how early you can still get a foot to it (0.8 → 1.3 m).
 *  - Pace: how late you can still reach it (0.6 → 1.1 m); also your run after a touch (the match's own touchChaseSpeed).
 *  - Vision: how much time the pass gives you (1.3 → 2.3 s) and the slow motion near you (×0.72 → ×0.40).
 *  - Power: your strike, as everywhere (the match's own launch).
 */
export function liveDialsFor(st: LiveSkills): LiveDials {
  const t = share(st.technique), p = share(st.pace), v = share(st.vision);
  return {
    ...LIVE_DEFAULTS,
    sweet: lerpN(0.22, 0.5, t),
    reachEarly: lerpN(0.8, 1.3, t),
    reachLate: lerpN(0.6, 1.1, p),
    arriveS: lerpN(1.3, 2.3, v),
    nearSlow: lerpN(0.72, 0.4, v),
  };
}
function lerpN(a: number, b: number, t: number) { return a + (b - a) * t; }
/** How badly a mistimed touch comes off (technique): ×1.35 at 40 → ×0.6 at 95. */
export function touchErrorScale(technique: number): number { return lerpN(1.35, 0.6, share(technique)); }

/** The dials as a player reads them (the Settings card and the test page share this list). */
export const LIVE_DIAL_INFO: { k: keyof LiveDials; name: string; unit: string; step: number; help: string }[] = [
  { k: "arriveS", name: "Time for the pass to reach you", unit: "s", step: 0.1, help: "Real seconds from the hand-over to the ball at your feet. Longer = more time to aim." },
  { k: "slowMin", name: "Slowest slow motion", unit: "×", step: 0.05, help: "How slow the pass may run to give you that time. 1 = never slowed." },
  { k: "nearSlow", name: "Extra slow motion near you", unit: "×", step: 0.05, help: "On top of the rest, while the ball is close to you. 1 = none." },
  { k: "sweet", name: "Sweet zone", unit: "m", step: 0.05, help: "Either side of the ring: a clean strike." },
  { k: "reachEarly", name: "Reach (early)", unit: "m", step: 0.05, help: "How far before the ring you can still stab at it." },
  { k: "reachLate", name: "Reach (late)", unit: "m", step: 0.05, help: "How far past the ring you can still get a foot to it." },
  { k: "rollDecel", name: "Roll slows by", unit: "m/s²", step: 0.1, help: "How fast a missed ball slows as it rolls on." },
];

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
  /** After your touch: the ball rolls from `from` along `u`, v0 m/s, slowing by decel m/s² (the whole way, before and after the spot). */
  roll?: { v0: number; decel: number };
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
  if (plan.roll && plan.from) {
    const d = rollPast(plan.roll.v0, plan.roll.decel, T);
    return { x: plan.from.x + plan.u.x * d, y: plan.from.y + plan.u.y * d, z: 0 };
  }
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
  if (plan.roll) return Math.max(0, plan.roll.v0 - plan.roll.decel * T);
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
export function readSwing(plan: LivePlan, b: Vec2, speed: number, aimDir: Vec2, power: number, r: number, dials: LiveDials = LIVE_DEFAULTS, tap?: { cx: number; cy: number }): SwingRead {
  const along = alongOf(plan, b);
  const lat = -(b.x - plan.spot.x) * plan.u.y + (b.y - plan.spot.y) * plan.u.x;
  if (along < -dials.reachEarly || Math.abs(lat) > 1) return { hit: false, why: "early", along };
  if (along > dials.reachLate) return { hit: false, why: "late", along };
  const early = clamp((-along - dials.sweet) / Math.max(0.05, dials.reachEarly - dials.sweet), 0, 1);
  const late = clamp((along - dials.sweet) / Math.max(0.05, dials.reachLate - dials.sweet), 0, 1);
  const timing: SwingTiming = early > 0 ? "early" : late > 0 ? "late" : "sweet";
  const off = Math.max(early, late);
  // Where the foot meets it: a stab finds the top of the ball, a late one gets under it.
  // With the kick screen (`tap`): where you tapped, moved by the timing (a stab
  // rides up the ball, a late one slides under it) and by where the ball is beside you.
  const cy = tap
    ? clamp(tap.cy - 0.6 * early + 0.7 * late, -1, 1)
    : timing === "early" ? -0.15 - 0.75 * early : timing === "late" ? -0.1 + 0.95 * late : -0.1;
  const cx = tap ? clamp(tap.cx + lat * 0.5, -1, 1) : clamp(lat * 0.5, -0.5, 0.5);
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

// ── The first touch (Leo, 31 Oct 2026) ──
//
// "you get played through one on one with the goalie and he's running towards
// you and just as the ball ends up at your feet you do a little swipe like a bit
// forwards and to the left on the ball to take it round the keeper and slot it
// into the open goal." ONE touch per chance.
//
//  - A quick flick from the ball (under TOUCH.maxMs, at least TOUCH.minSwipe of
//    the screen) is a touch in the flick's direction; its length is the weight.
//    A slower drag back is still the aim.
//  - Timed like a strike (readTouch): clean in the sweet zone; early or late it
//    runs heavier and off line; out of reach you miss it.
//  - The touched ball rolls on and you run onto it (planAfterTouch): a new ring
//    where you catch it, and the finish is the usual live strike.
//  - In a one-on-one the keeper rushes at you as the pass comes (keeperRushes);
//    at the touch he goes for the ball (keeperVsTouch): if he gets there before
//    you, he smothers it; if not, he is beaten, on the ground, slow to get back.

export const TOUCH = {
  /** A flick is quicker than this (ms) … */
  maxMs: 240,
  /** … and at least this long (share of the pitch's height on the screen). */
  minSwipe: 0.045,
  /** Swipe length for the heaviest touch (share of the pitch's height). */
  fullSwipe: 0.3,
  /** The ball off your foot (m/s): the softest touch and the heaviest. */
  vSoft: 3.6,
  vHeavy: 10.5,
  /** A touched ball slows on the grass (m/s²). */
  decel: 2.6,
  /** You set off after it this long after the touch (s), at your running speed. */
  setOffS: 0.12,
  /** You meet it this far behind the ball (m). */
  meetGap: 0.45,
  /** The keeper: how fast he rushes (m/s, by rating 0..1), how long he takes to react to a touch (s), how far he can reach for it (m). */
  rushV: [4.4, 6.0] as [number, number],
  reactS: [0.32, 0.2] as [number, number],
  reachM: 1.25,
  /** Beaten, he is on the ground this long (s), then walks back at this pace (m/s). */
  downS: 0.9,
  recoverV: 2.6,
  /** Once you have caught it up you carry it at your feet; shoot within this (real s) or you are closed down. */
  holdS: 2.5,
};

/** Which chances the keeper rushes in (he is through on goal against you). */
const RUSH_KINDS = new Set(["one_on_one", "through_ball"]);
export function keeperRushes(kind: string, keeper: Vec2, spot: Vec2): boolean {
  return RUSH_KINDS.has(kind) && dist(keeper, spot) < 24;
}
/** Where a rushing keeper heads: just in front of where the ball meets you, on your side of goal. */
export function rushTarget(spot: Vec2, goal: Vec2): Vec2 {
  const dx = goal.x - spot.x, dy = goal.y - spot.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1.5, d * 0.5);
  return { x: spot.x + (dx / d) * k, y: spot.y + (dy / d) * k };
}
/** Move a man toward a point at up to `v` m/s for `dt` s. */
export function stepToward(p: Vec2, to: Vec2, v: number, dt: number): Vec2 {
  const dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy);
  const s = Math.min(d, v * dt);
  return d > 1e-6 ? { x: p.x + (dx / d) * s, y: p.y + (dy / d) * s } : { ...p };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function keeperRushV(share: number): number { return lerp(TOUCH.rushV[0], TOUCH.rushV[1], clamp(share, 0, 1)); }
export function keeperReactS(share: number): number { return lerp(TOUCH.reactS[0], TOUCH.reactS[1], clamp(share, 0, 1)); }

/** Is this release a touch? Quick and long enough (screen fractions of the pitch's height). */
export function isTouchFlick(ms: number, swipe: number): boolean { return ms <= TOUCH.maxMs && swipe >= TOUCH.minSwipe; }
/** The touch's weight 0..1 from the swipe's length. */
export function touchWeight(swipe: number): number { return clamp((swipe - TOUCH.minSwipe) / (TOUCH.fullSwipe - TOUCH.minSwipe), 0, 1); }

export type TouchRead =
  | { ok: false; why: "early" | "late"; along: number }
  | { ok: true; timing: SwingTiming; along: number; off: number; from: Vec2; dir: Vec2; v0: number };

/**
 * Read a touch: the ball at `b` moving at `speed` along the plan, your flick
 * `flick` (pitch direction) with weight 0..1. `r` a seeded draw for which way
 * a mistimed touch runs off.
 */
export function readTouch(plan: LivePlan, b: Vec2, speed: number, flick: Vec2, weight: number, r: number, dials: LiveDials = LIVE_DEFAULTS, errScale = 1): TouchRead {
  const along = alongOf(plan, b);
  if (along < -dials.reachEarly) return { ok: false, why: "early", along };
  if (along > dials.reachLate) return { ok: false, why: "late", along };
  const early = clamp((-along - dials.sweet) / Math.max(0.05, dials.reachEarly - dials.sweet), 0, 1);
  const late = clamp((along - dials.sweet) / Math.max(0.05, dials.reachLate - dials.sweet), 0, 1);
  const timing: SwingTiming = early > 0 ? "early" : late > 0 ? "late" : "sweet";
  const off = Math.max(early, late);
  const fm = Math.hypot(flick.x, flick.y) || 1;
  let fx = flick.x / fm, fy = flick.y / fm;
  // Mistimed, it comes off the foot wider and heavier.
  // Technique (errScale): a poor first touch is wider and heavier; even a clean one strays a little.
  const stray = (r < 0.5 ? -1 : 1) * (16 * off + 3 * Math.max(0, errScale - 0.6)) * errScale;
  if (stray !== 0) {
    const a = stray * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    [fx, fy] = [fx * c - fy * sn, fx * sn + fy * c];
  }
  const v = (TOUCH.vSoft + (TOUCH.vHeavy - TOUCH.vSoft) * clamp(weight, 0, 1)) * (1 + 0.35 * off * errScale);
  // A little of the ball's own pace carries through a first touch.
  const vx = fx * v + plan.u.x * speed * 0.18, vy = fy * v + plan.u.y * speed * 0.18;
  const vm = Math.hypot(vx, vy) || 1;
  return { ok: true, timing, along, off, from: { x: b.x, y: b.y }, dir: { x: vx / vm, y: vy / vm }, v0: vm };
}

/** Where you are (s after the touch) as you run onto it, from `start` to `meet` at `runV`. */
export function runnerAt(start: Vec2, meet: Vec2, runV: number, t: number): Vec2 {
  const d = dist(start, meet);
  const go = Math.min(d, runV * Math.max(0, t - TOUCH.setOffS));
  return d > 1e-6 ? { x: start.x + (meet.x - start.x) * go / d, y: start.y + (meet.y - start.y) * go / d } : { ...meet };
}

/**
 * After the touch: the ball rolls from `read.from`; you run from `you` at
 * `runV`. The new spot is where you catch it up (the ball's place then), and
 * the plan is a rolling one (liveBallAt's `roll`). Returns the plan and where
 * you stand to meet it.
 */
export function planAfterTouch(read: Extract<TouchRead, { ok: true }>, you: Vec2, runV: number, dials: LiveDials = LIVE_DEFAULTS): { plan: LivePlan; meet: Vec2 } {
  const { from, dir, v0 } = read;
  const ballAt = (t: number) => { const d = rollPast(v0, TOUCH.decel, t); return { x: from.x + dir.x * d, y: from.y + dir.y * d }; };
  const tStop = v0 / TOUCH.decel;
  let tc = tStop;
  for (let t = 0.2; t <= tStop + 3; t += 0.02) {
    const ball = ballAt(Math.min(t, tStop));
    const need = Math.max(0, dist(you, ball) - TOUCH.meetGap);
    if (runV * Math.max(0, t - TOUCH.setOffS) >= need) { tc = t; break; }
  }
  const spot = ballAt(Math.min(tc, tStop));
  const dd = Math.hypot(spot.x - you.x, spot.y - you.y) || 1;
  const meet = { x: spot.x - (spot.x - you.x) / dd * TOUCH.meetGap, y: spot.y - (spot.y - you.y) / dd * TOUCH.meetGap };
  const t1 = Math.max(0.25, tc);
  const slow = clamp(t1 / Math.max(0.6, dials.arriveS * 0.75), Math.max(0.45, dials.slowMin), 1);
  return {
    plan: { handT: 0, t0: 0, t1, carry: false, spot, u: { ...dir }, v1: Math.max(0, v0 - TOUCH.decel * t1), slow, from: { ...from }, roll: { v0, decel: TOUCH.decel } },
    meet,
  };
}

export type KeeperVsTouch =
  | { smother: true; t: number; at: Vec2 }
  | { smother: false; lunge: Vec2 };
/**
 * The keeper at `k` goes for your touched ball: after reacting he runs at it at
 * `v`; if he gets within his reach of it before you get there (`tYou`), he
 * smothers it. If not he lunges where it was going and is beaten.
 */
export function keeperVsTouch(k: Vec2, v: number, react: number, plan: LivePlan, tYou: number, reach = TOUCH.reachM): KeeperVsTouch {
  for (let t = 0; t <= tYou - 0.04; t += 0.02) {
    const b = liveBallAt(plan, t, null);
    const can = v * Math.max(0, t - react) + reach;
    if (dist(k, b) <= can) return { smother: true, t, at: { x: b.x, y: b.y } };
  }
  // Beaten: he dives at where the ball was a beat after the touch, as far as he gets.
  const aim = liveBallAt(plan, Math.min(tYou, react + 0.15), null);
  return { smother: false, lunge: stepToward(k, aim, 2.2, 1) };
}

/** The feed line for a touch. */
export function touchLine(t: TouchRead, name: string, roundKeeper: boolean): string {
  if (!t.ok) return t.why === "early" ? `${name} goes to take a touch and it isn't there yet!` : `${name} goes to take a touch and it's gone past him!`;
  if (t.timing !== "sweet") return `${name} takes a heavy touch…`;
  return roundKeeper ? `${name} takes it round the keeper…` : `${name} takes a touch into his stride…`;
}

/** The "drag back = aim · flick = touch" hint: shown on a player's first few live chances (per phone). */
const HINT_KEY = "kib-live-touch-hint";
export const TOUCH_HINT_TIMES = 5;
export function touchHintWanted(): boolean {
  try { return Number(window.localStorage.getItem(HINT_KEY) ?? "0") < TOUCH_HINT_TIMES; } catch { return false; }
}
export function touchHintSeen() {
  try { window.localStorage.setItem(HINT_KEY, String(Number(window.localStorage.getItem(HINT_KEY) ?? "0") + 1)); } catch { /* private mode */ }
}

// ── Everyone moves (Leo, 1 Nov 2026: "moving everything") ──
//
// Defenders: each one near the play heads for the goal side of where the
// ball meets you (between it and goal), the nearest one closing you down
// to just short of it; after your touch the nearest one or two chase it and
// can win it before you get there (TACKLED). Team-mates keep running the way
// they were going, easing off.

export const DEF = {
  /** Their running speed (m/s), × the defender's own speed. */
  v: 5.6,
  /** Only men within this of the play react (m). */
  near: 16,
  /** The presser stops this far short of the ball (m), until your touch. */
  pressGap: 1.4,
  /** After your touch: their reaction (s) and reach for the ball (m). */
  reactS: 0.3,
  reachM: 0.9,
  /** Team-mates carry on at this share of their pace, easing to a stop over this long (s). */
  mateCarry: 0.85,
  mateEaseS: 1.6,
};
/** Where a defender heads while the pass comes: the presser to the ball, the rest to the goal side of it. */
export function defenderTarget(d: Vec2, spot: Vec2, goal: Vec2, presser: boolean): Vec2 {
  const gx = goal.x - spot.x, gy = goal.y - spot.y, gd = Math.hypot(gx, gy) || 1;
  if (presser) {
    const dx = spot.x - d.x, dy = spot.y - d.y, dd = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, dd - DEF.pressGap);
    return { x: d.x + (dx / dd) * k, y: d.y + (dy / dd) * k };
  }
  // A cover man drifts onto the line from the ball to goal, as far from the ball as he already is (at most 6 m).
  const along = Math.min(6, Math.max(2, Math.hypot(d.x - spot.x, d.y - spot.y) * 0.6));
  return { x: spot.x + (gx / gd) * along, y: spot.y + (gy / gd) * along };
}
/** The defender nearest a point, and his distance (index -1: none). */
export function nearestTo(men: Vec2[], p: Vec2): { i: number; d: number } {
  let i = -1, best = Infinity;
  men.forEach((m, k) => { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < best) { best = d; i = k; } });
  return { i, d: best };
}

