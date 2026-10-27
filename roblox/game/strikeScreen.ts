/**
 * The strike screen without the drawing: components/star/ContactBall.tsx
 * (tap where on the ball to hit it) and components/star/PowerShotContact.tsx
 * (the power shot's green circle), as state on a clock. Roblox draws it from
 * strikeView() and passes taps to strikeTap(); strikeStep() fires the
 * website's timers (the countdown, the beat before the ball goes).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 * The taps are in ball radii from the ball's centre: cx +right, cy +down.
 */
import { gradeContact } from "../../lib/star/shotModel";
import { powerShotQuality } from "../../lib/star/shotModel";
import { airContactRead, airLateContact, airStrikeTimerS } from "../../lib/star/airborneChance";
import { headerJump } from "../../lib/star/aerial";
import { airTapContactCx } from "../../lib/star/airTap";
import * as M from "./match";

type BallMotion = M.StrikeInputs["motion"];

/** ContactBall.ballMotionAt: where the moving ball is, as a share of the strike area (x across, y up is negative). */
export function ballMotionAt(motion: BallMotion, t: number, period: number): { x: number; y: number } {
  if (motion === "still") return { x: 0, y: 0 };
  const phase = (t / period) % 2;
  const sweep = phase < 1 ? phase : 2 - phase;
  const x = -0.12 + 0.24 * (0.5 - 0.5 * Math.cos(Math.PI * sweep));
  if (motion === "float") return { x, y: -0.42 - 0.08 * Math.sin(Math.PI * sweep) };
  if (motion === "bounce") {
    const b = Math.abs(Math.sin(Math.PI * 2.5 * sweep));
    return { x, y: -0.26 * b };
  }
  // bobble: small, quick hops on the grass.
  const b = Math.abs(Math.sin(Math.PI * 6 * sweep));
  return { x: x * 0.6, y: -0.05 * b };
}

const TOO_SLOW_MS = 350;
const AIR_VERDICT_MS = 300;
/** How far out from the ball's centre a touch still strikes it, in ball radii. */
export const STRIKE_ZONE_R = 1.18;
const POWER_GIVE_UP_S = 1.2;

export interface StrikeScreen {
  inputs: M.StrikeInputs;
  /** The screen's own clock, seconds (strikeStep moves it). */
  t: number;
  period: number;
  airKind: "header" | "volley" | null;
  limitS: number | undefined;
  /** The clock starts two frames after the screen is drawn (ContactBall's `started`). */
  framesSeen: number;
  startedAt: number | null;
  locked: boolean;
  timedOut: boolean;
  /** Where it was hit, for the spark (ball radii). */
  spark: { cx: number; cy: number } | null;
  verdict: { label: string; good: boolean } | null;
  /** What goes to the match, and when. */
  send: { at: number; fire: (m: M.MatchState) => void } | null;
  lift: number;
  sweepX: number;
  // the power shot
  powerSpot: { x: number; y: number };
  powerShowAt: number;
  powerShownAt: number | null;
}

/** The screen opens (CanvasMatch mounts ContactBall when the phase becomes "contact"). */
export function openStrike(m: M.MatchState): StrikeScreen | null {
  const inputs = M.strikeInputs(m);
  if (!inputs) return null;
  const airKind = inputs.motion === "float" ? "header" : inputs.motion === "bounce" ? "volley" : null;
  const limitS = inputs.timeLimitS && inputs.timeLimitS > 0 ? inputs.timeLimitS : airKind ? airStrikeTimerS(airKind, inputs.aerial) : undefined;
  // PowerShotContact's spot and wait use Math.random, as on the website
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.55;
  return {
    inputs, t: 0,
    period: 2.2 + Math.max(0, Math.min(100, inputs.technique) - 40) / 60 * 1.2,
    airKind, limitS, framesSeen: 0, startedAt: null, locked: false, timedOut: false,
    spark: null, verdict: null, send: null, lift: 0, sweepX: 0,
    powerSpot: { x: Math.cos(a) * r, y: Math.sin(a) * r },
    powerShowAt: 0.25 + Math.random() * 0.5, powerShownAt: null,
  };
}

/** One frame of the strike screen: the ball's motion, the countdown, the delayed strike. */
export function strikeStep(s: StrikeScreen, m: M.MatchState, dt: number) {
  s.framesSeen++;
  if (!s.locked) {
    s.t += dt;
    const p = ballMotionAt(s.inputs.motion, s.t, s.period);
    s.sweepX = p.x;
    const top = s.inputs.motion === "float" ? 0.5 : s.inputs.motion === "bounce" ? 0.26 : 0.05;
    s.lift = Math.max(0, Math.min(1, -p.y / top));
  } else s.t += dt;
  if (s.inputs.powerShot) {
    if (s.powerShownAt === null && s.t >= s.powerShowAt) s.powerShownAt = s.t;
    if (!s.locked && s.t >= 0.75 + POWER_GIVE_UP_S) finishPower(s, 0, NaN);
  } else {
    if (s.startedAt === null && s.framesSeen >= 2 && s.limitS) s.startedAt = s.t;
    if (!s.locked && s.startedAt !== null && s.limitS && s.t - s.startedAt >= s.limitS) {
      s.locked = true;
      s.timedOut = true;
      const lift = s.lift, sweep = s.sweepX, airKind = s.airKind, ownTimer = !!(s.inputs.timeLimitS && s.inputs.timeLimitS > 0);
      s.send = {
        at: s.t + TOO_SLOW_MS / 1000,
        fire: (mm) => {
          if (airKind && !ownTimer) M.contact(mm, { ...airLateContact(airKind, lift, sweep), late: true });
          else M.contactTimeout(mm);
        },
      };
    }
  }
  if (s.send && s.t >= s.send.at) {
    const f = s.send.fire;
    s.send = null;
    f(m);
  }
}

/** A tap on the strike screen, in ball radii from the ball's centre as drawn now. */
export function strikeTap(s: StrikeScreen, cx: number, cy: number) {
  if (s.locked) return;
  if (s.inputs.powerShot) {
    if (cx * cx + cy * cy > 1.15) return;
    if (s.powerShownAt === null) { finishPower(s, 0, NaN); return; }
    const rt = s.t - s.powerShownAt;
    const hit = Math.hypot(cx - s.powerSpot.x, cy - s.powerSpot.y) < 0.3;
    finishPower(s, powerShotQuality(rt, hit), hit ? rt : NaN);
    return;
  }
  const d = Math.hypot(cx, cy);
  if (d > STRIKE_ZONE_R) return;
  if (d > 1) { cx /= d; cy /= d; }
  s.locked = true;
  s.spark = { cx, cy };
  const inp = s.inputs;
  const air = inp.motion === "float" || inp.motion === "bounce";
  const lift = s.lift;
  if (air) {
    const kind = inp.motion === "float" ? "header" : "volley";
    const readCx = inp.aimFromTap ? airTapContactCx(kind, cx, inp.aerial) : cx;
    const rd = airContactRead({ kind, lift, cx: readCx, cy, tech: inp.technique, aerial: inp.aerial },
      inp.motion === "float" && inp.ballZ !== undefined ? inp.ballZ * (0.85 + 0.15 * lift) : undefined);
    s.verdict = { label: rd.label, good: rd.good };
  } else if (inp.grades) {
    const g = gradeContact({ cx, cy }, inp.power, inp.knuckles, inp.field);
    if (g.label) s.verdict = { label: g.label, good: g.grade === "clean" || g.grade === "knuckle" || g.label === "CURLER" };
  }
  const c = air ? { cx, cy, lift } : { cx, cy };
  s.send = { at: s.t + (air ? AIR_VERDICT_MS : inp.grades ? 420 : 200) / 1000, fire: (mm) => M.contact(mm, c) };
}

function finishPower(s: StrikeScreen, q: number, _rt: number) {
  if (s.locked) return;
  s.locked = true;
  s.verdict = { label: q >= 0.95 ? "PERFECT!" : q >= 0.6 ? "GOOD" : q > 0 ? "LATE" : "MISSED", good: q >= 0.6 };
  s.send = { at: s.t + 0.35, fire: (mm) => M.powerContact(mm, q) };
}

/** What to draw. */
export interface StrikeView {
  /** The ball's offset in the strike area, shares of its width/height. */
  ballX: number; ballY: number;
  lift: number;
  /** The countdown left, 1 full .. 0, or null when untimed. */
  ring: number | null;
  powerPct: number;
  powerColor: string;
  verdict: { label: string; good: boolean } | null;
  spark: { cx: number; cy: number } | null;
  timedOut: boolean;
  heading: string;
  /** A header: how high you must jump for it. */
  jump: { jumpM: number; maxJumpM: number; overM: number } | null;
  /** The power shot's green circle, once it shows. */
  powerSpot: { x: number; y: number } | null;
}

export function strikeView(s: StrikeScreen): StrikeView {
  const inp = s.inputs;
  const p = s.locked ? { x: s.sweepX, y: -s.lift * (inp.motion === "float" ? 0.5 : inp.motion === "bounce" ? 0.26 : 0.05) } : ballMotionAt(inp.motion, s.t, s.period);
  const powerPct = Math.round(inp.power * 100);
  const ring = s.inputs.powerShot || !s.limitS ? null
    : s.startedAt === null ? 1 : Math.max(0, 1 - (s.t - s.startedAt) / s.limitS);
  return {
    ballX: p.x, ballY: p.y, lift: s.lift, ring,
    powerPct, powerColor: powerPct < 40 ? "#22c55e" : powerPct < 75 ? "#eab308" : "#ef4444",
    verdict: s.verdict, spark: s.spark, timedOut: s.timedOut,
    heading: inp.powerShot ? "Power shot" : s.airKind === "header" ? "Head it!" : s.airKind === "volley" ? "Volley it!" : "Strike it!",
    jump: inp.motion === "float" && inp.ballZ !== undefined && inp.aerial !== undefined ? headerJump(inp.ballZ, inp.aerial) : null,
    powerSpot: inp.powerShot && s.powerShownAt !== null && !s.locked ? s.powerSpot : null,
  };
}
