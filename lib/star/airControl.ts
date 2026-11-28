/**
 * HEADERS AND VOLLEYS: FOUR WAYS TO DECIDE WHEN AND HOW YOU HIT IT
 * (Harry, 28 Nov 2026: "I think in general the headers and volleys system
 * just has never worked with WHEN you hit the ball, I think we need to think
 * of different ideas of how this could work").
 *
 * Test page only (/star-aerials-dev). The live match keeps "screen" (the
 * "Head it?" / "Volley it?" ball screen, lib/star/airTap.ts) until Harry picks.
 *
 * Every idea is played on the ONE engine: the cross comes in on the real
 * pitch, and the idea only decides three things the engine already reads,
 * then hands them to CanvasMatch's own handleContact (launch + applyAirborne
 * + airContactRead), exactly as the ball screen does:
 *   - the AIM (a direction from the ball to a spot on the goal line),
 *   - the POWER (0..1),
 *   - the CONTACT (where on the ball, and for a volley how high in its drop).
 *
 * WHEN is the same clock for all four: the cross arrives at the meeting point
 * at time D. You hit it Δt from D. Inside the sweet window (airSweetS, wider
 * with Aerial) it is clean; early you get under it (a header loops up, a
 * volley balloons), late you catch its edge (a header glances, a volley is
 * scuffed); far off (airWhiffS) you miss the timing and meet it late,
 * the ball screen's own late touch (airLateContact).
 *
 *   ghost   GHOST LANDING  a ring on the pitch closes onto the ball; drag back
 *                          to aim and power, let go as the ring closes.
 *   preaim  PICK THE SPOT  tap where in the goal while the cross is in the
 *                          air; your man meets it himself, timed by Aerial.
 *   swipe   SWIPE THROUGH  one swipe through the ball as it reaches the
 *                          contact ring: direction = aim, speed = power,
 *                          above or through the middle = nod down / drive.
 *   beat    THREE-BEAT     press = take off, hold = wind up, release = hit,
 *                          on a rhythm bar that runs with the cross.
 *
 * Pure: no React, no canvas, no random numbers (the bot thumbs take an rng).
 */
import { CX, GOAL_W } from "./pitch";
import { airCentreR, airLateContact } from "./airborneChance";

export type AirKind = "header" | "volley";
export type AirControlMode = "screen" | "ghost" | "preaim" | "swipe" | "beat";
export const AIR_CONTROL_MODES: readonly AirControlMode[] = ["screen", "ghost", "preaim", "swipe", "beat"];

export const AIR_CONTROL_INFO: Readonly<Record<AirControlMode, { name: string; line: string; how: string }>> = {
  screen: { name: "Today: ball screen", line: "The game as it is: the cross comes in, then the Head it? / Volley it? screen opens with its ring.", how: "Tap the ball before the ring runs out" },
  ghost: { name: "1 · Landing ring", line: "A ring on the pitch closes onto where you meet the ball. Drag back to aim and power, let go as the ring goes green.", how: "Drag back · let go as the ring closes" },
  preaim: { name: "2 · Aim first", line: "Tap where in the goal while the cross is in the air. Your man times it himself (his Aerial).", how: "Tap a spot in the goal before it arrives" },
  swipe: { name: "3 · Swipe through", line: "Swipe through the ball as it reaches the ring. Swipe direction aims it, speed is power.", how: "Swipe through the ball at the ring" },
  beat: { name: "4 · Tap, hold, release", line: "Press in the blue UP zone to take off, hold to wind up, let go on the green HIT line. Your thumb's place across the screen aims it.", how: "Press · hold · let go on the line" },
};

// ── The test switch (this page only, as setTestAerialMove) ──
let testMode: AirControlMode = "screen";
/** Set by /star-aerials-dev while it is open; cleared when it closes. */
export function setTestAirControl(m: AirControlMode | null): void { testMode = m ?? "screen"; }
/** The idea the match plays a header or volley with. Always "screen" outside the test page. */
export function airControlMode(): AirControlMode { return testMode; }

// ── The clock ──

/**
 * Seconds either side of the arrival that are clean: a header 0.10 s at
 * Aerial 30, 0.13 at 60, 0.16 at 90. A volley's window is VOLLEY_SWEET_K of
 * that: a dropping ball met with the foot is the harder thing to time, and
 * real volleys go in far less often than headers from the same chance.
 */
export const VOLLEY_SWEET_K = 0.7;
export function airSweetS(aerial = 60, kind: AirKind = "header"): number {
  return (0.07 + 0.001 * Math.max(0, Math.min(100, aerial))) * (kind === "volley" ? VOLLEY_SWEET_K : 1);
}
/** Further off than this you have missed the timing altogether. */
export function airWhiffS(aerial = 60, kind: AirKind = "header"): number { return 3 * airSweetS(aerial, kind); }

/** How far off the timing is: 0 clean, -1 badly early, +1 badly late (past ±1 is a miss). */
export function timingE(dt: number, aerial = 60, kind: AirKind = "header"): number { return dt / (2.5 * airSweetS(aerial, kind)); }

export type TimingWord = "PERFECT" | "EARLY" | "LATE" | "MISSED IT";
export function timingWord(dt: number, aerial = 60, kind: AirKind = "header"): TimingWord {
  const W = airSweetS(aerial, kind);
  if (Math.abs(dt) <= W) return "PERFECT";
  if (Math.abs(dt) > airWhiffS(aerial, kind)) return "MISSED IT";
  return dt < 0 ? "EARLY" : "LATE";
}

export interface AirStrikeIn {
  kind: AirKind;
  /** The ball's spot when you meet it (pitch m). */
  ball: { x: number; y: number };
  /** Where on the goal line you aim (pitch x). */
  aimX: number;
  /** 0..1 */
  power: number;
  /** Seconds from the arrival you hit it (negative = early). */
  dt: number;
  /** For a header: -1 top of the ball … 1 underneath (what you chose). Default: just over the middle. */
  meantCy?: number;
  aerial?: number;
}

export interface AirStrikeOut {
  contact: { cx: number; cy: number; lift: number; late?: boolean };
  aim: { dir: { x: number; y: number }; power: number };
  /** Where on the goal line it is aimed (pitch x). */
  aimX: number;
  word: TimingWord;
}

/** The hardest a volley is struck (today's ball screen strikes it at 0.92). */
export const VOLLEY_POWER_CAP = 0.92;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The aim, the power and the contact the engine reads, for a hit Δt from the arrival. */
export function airStrike(i: AirStrikeIn): AirStrikeOut {
  const aerial = i.aerial ?? 60;
  const word = timingWord(i.dt, aerial, i.kind);
  const aimX = clamp(i.aimX, CX - GOAL_W / 2 - 1.5, CX + GOAL_W / 2 + 1.5);
  const dx = aimX - i.ball.x, dy = -i.ball.y, L = Math.hypot(dx, dy) || 1;
  // Which side of the ball a late touch clips: the side away from the aim.
  const side = aimX >= i.ball.x ? -1 : 1;
  if (word === "MISSED IT") {
    // The ball screen's own late touch, struck at the middle of the goal.
    const mx = CX - i.ball.x, my = -i.ball.y, ml = Math.hypot(mx, my) || 1;
    return { contact: { ...airLateContact(i.kind, i.kind === "header" ? 0.9 : 0.1, side), late: true }, aim: { dir: { x: mx / ml, y: my / ml }, power: 0.7 }, aimX: CX, word };
  }
  const e = clamp(timingE(i.dt, aerial, i.kind), -1.2, 1.2);
  const R0 = airCentreR(aerial);
  let cx = 0, cy: number, lift: number;
  if (i.kind === "header") {
    cy = (i.meantCy ?? -0.3) + 1.1 * Math.max(0, -e);           // early: under it, it loops up
    cx = side * (e > 0 ? R0 + (1 - R0) * Math.min(1, e) : 0);    // late: off the side, it glances
    lift = 0.92;
  } else {
    cy = (i.meantCy ?? -0.1) + 0.35 * Math.max(0, -e);
    cx = side * (e > 0.4 ? (R0 + (1 - R0) * (e - 0.4)) : 0);
    lift = clamp(0.575 - 0.6 * e, 0, 1);                          // early: top of its drop; late: nearly on the grass
  }
  return { contact: { cx: clamp(cx, -1, 1), cy: clamp(cy, -1, 1), lift }, aim: { dir: { x: dx / L, y: dy / L }, power: clamp(i.power, 0.3, i.kind === "volley" ? VOLLEY_POWER_CAP : 1) }, aimX, word };
}

// ── Each idea's input → the strike ──

/** A: GHOST LANDING. A drag back (screen px; +y down the screen) sets aim and power; let go = the hit. */
export function ghostStrike(kind: AirKind, ball: { x: number; y: number }, drag: { dx: number; dy: number }, dt: number, aerial?: number): AirStrikeOut {
  const back = Math.max(0, drag.dy);
  const power = clamp(0.45 + back / 160, 0.45, 1);
  // Dragging back and to the LEFT aims right (as the ground shot's arrow does).
  const across = clamp(-drag.dx / Math.max(40, back * 0.9), -1, 1);
  const aimX = CX + across * (GOAL_W / 2 - 0.3);
  return airStrike({ kind, ball, aimX, power, dt, aerial });
}

/** B: PICK THE SPOT. `u` -1 left post … 1 right post, `v` 0 on the grass … 1 under the bar. The man's own timing error is `dt`. */
export function preaimStrike(kind: AirKind, ball: { x: number; y: number }, u: number, v: number, dt: number, aerial?: number): AirStrikeOut {
  const aimX = CX + clamp(u, -1.1, 1.1) * (GOAL_W / 2 - 0.3);
  // A header aimed low is nodded down; aimed high, met through the middle.
  const meantCy = kind === "header" ? -0.45 + 0.4 * clamp(v, 0, 1) : -0.15 + 0.2 * clamp(v, 0, 1);
  return airStrike({ kind, ball, aimX, power: kind === "header" ? 0.85 : 0.92, dt, meantCy, aerial });
}
/** B: how far off the man's own timing is, from his Aerial: an sd of 0.17 s at 30, 0.12 s at 60, 0.08 s at 90. */
export function preaimTimingSd(aerial = 60): number { return clamp(0.215 - 0.0015 * aerial, 0.05, 0.22); }

/**
 * C: SWIPE THROUGH. `ang` the swipe's direction off straight up the screen
 * (radians, + = to the right), `speed` px/s, `offset` how far the swipe
 * passed from the middle of the ball (-1 its left edge … 1 its right edge, in
 * contact-ring radii: off the middle it is met on its side and glances),
 * dt when it passed.
 */
export function swipeStrike(kind: AirKind, ball: { x: number; y: number }, ang: number, speed: number, offset: number, dt: number, aerial?: number): AirStrikeOut {
  // The swipe's direction aims it: straight up = the middle, 18° off = the post.
  const across = clamp(ang / (18 * Math.PI / 180), -1.15, 1.15);
  const aimX = CX + across * (GOAL_W / 2 - 0.3);
  const power = clamp(0.35 + speed / 2200, 0.35, 1);
  const out = airStrike({ kind, ball, aimX, power, dt, meantCy: kind === "header" ? -0.35 : -0.1, aerial });
  if (out.word !== "MISSED IT") out.contact.cx = clamp(out.contact.cx + clamp(offset, -1.3, 1.3) * 0.75, -1, 1);
  return out;
}

/**
 * D: THREE-BEAT. `pressDt` when you took off (from the arrival; you must be
 * up by BEAT_TAKEOFF_S before it), `holdS` how long you held (power),
 * `u` where your thumb was across the screen at the release (-1 … 1), dt the release.
 */
export const BEAT_TAKEOFF_S = 0.25;
export function beatStrike(kind: AirKind, ball: { x: number; y: number }, pressDt: number, holdS: number, u: number, dt: number, aerial?: number): AirStrikeOut {
  const aimX = CX + clamp(u, -1.1, 1.1) * (GOAL_W / 2 - 0.3);
  const power = clamp(0.5 + holdS * 0.9, 0.5, 1);
  // Took off too late: not up in time, met lower (a header off the top of the head, a volley on the half-volley).
  const lateUp = Math.max(0, pressDt + BEAT_TAKEOFF_S);
  const out = airStrike({ kind, ball, aimX, power, dt: dt + lateUp * 0.6, aerial });
  return out;
}

// ── The bot thumbs (assumed, not measured on people; see docs/plans/AERIALS_OPTIONS_2026-11-28.md) ──

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** An average thumb's errors per idea: timing sd (s), aim sd (share of half the goal), power sd. */
export const AVERAGE_THUMB: Readonly<Record<Exclude<AirControlMode, "screen">, { timeSd: number; aimSd: number; powSd: number }>> = {
  // Letting go as a ring closes onto a moving ball: a coincidence-timing task (people: ~60-100 ms sd).
  ghost: { timeSd: 0.09, aimSd: 0.3, powSd: 0.1 },
  // No timing for the thumb (Aerial times it); a tap on a goal ~120 px wide.
  preaim: { timeSd: 0, aimSd: 0.22, powSd: 0 },
  // A swipe is harder to time than a release and its direction wanders more.
  swipe: { timeSd: 0.12, aimSd: 0.38, powSd: 0.15 },
  // Rhythm with a bar to read: anticipation, the steadiest timing of the four.
  beat: { timeSd: 0.08, aimSd: 0.3, powSd: 0.1 },
};

/**
 * What scripts/aerial/control-measure.mts printed on 28 Nov 2026 (400
 * chances a cell, the bot thumbs above): goals per 100 at Aerial 30 / 60 / 90
 * and clean hits at Aerial 60, for the test page to show. Re-run the script
 * after changing anything above and copy its numbers here.
 */
export const AIR_CONTROL_NUMBERS: Readonly<Record<AirControlMode, { header: [number, number, number]; volley: [number, number, number]; cleanH?: number; cleanV?: number; note?: string }>> = {
  screen: { header: [13, 22, 28], volley: [16, 24, 29], note: "the ring ran out 10 (header) / 17 (volley) in 100 at Aerial 60" },
  ghost: { header: [13, 18, 27], volley: [30, 36, 44], cleanH: 83, cleanV: 70 },
  preaim: { header: [9, 15, 23], volley: [21, 29, 41], cleanH: 70, cleanV: 52 },
  swipe: { header: [8, 14, 16], volley: [18, 23, 28], cleanH: 72, cleanV: 53 },
  beat: { header: [10, 15, 22], volley: [25, 30, 37], cleanH: 88, cleanV: 75 },
};
/** The game's ground shots, the same bot (scripts/b10/measure.mts others): goals per 100. */
export const GROUND_NUMBERS = { oneOnOne: 45, tightAngle: 23, longRange: 23.5 };

/** One bot hit for an idea: the strike it makes on a ball at `ball`, aiming at goal-line x `targetX`. */
export function botStrike(mode: Exclude<AirControlMode, "screen">, kind: AirKind, ball: { x: number; y: number }, targetX: number, aerial: number, r: () => number): AirStrikeOut {
  const t = AVERAGE_THUMB[mode];
  const u0 = (targetX - CX) / (GOAL_W / 2 - 0.3);
  const u = u0 + gauss(r) * t.aimSd;
  const dt = mode === "preaim" ? gauss(r) * preaimTimingSd(aerial) : gauss(r) * t.timeSd;
  if (mode === "ghost") {
    const back = clamp(110 + gauss(r) * 160 * t.powSd, 20, 200);
    return ghostStrike(kind, ball, { dx: -u * Math.max(40, back * 0.9), dy: back }, dt, aerial);
  }
  if (mode === "preaim") return preaimStrike(kind, ball, u, kind === "header" ? 0.2 : 0.4, dt, aerial);
  if (mode === "swipe") {
    const off = gauss(r) * 0.35;
    return swipeStrike(kind, ball, u * 18 * Math.PI / 180, clamp(1300 + gauss(r) * 2200 * t.powSd, 200, 2600), off, dt, aerial);
  }
  const press = -0.45 + gauss(r) * 0.12;
  return beatStrike(kind, ball, press, clamp(0.4 + gauss(r) * t.powSd, 0, 0.6), u, dt, aerial);
}
