/**
 * REAL GOALS harness: strike a real goal along the real goal's line, the way
 * the real match strikes and flies a shot (CanvasMatch: launchShot → brainStrike
 * → strikeKind → 1/180 s flight with defenders, keeper brain, reactions), and
 * see whether it goes in.
 *
 * The aim is FOUND, not guessed (as tests/star/keeperFinish/harness.mts does):
 * the arrow and the tap height are searched with every body out of the way
 * until the ball crosses within a few centimetres of where the real goal did.
 * Then the same strike (plus a small human wobble) is played against the
 * defenders and keeper (placed by the game's rules: Wyscout has only the
 * shot), with the real lane on (the page) or off (before).
 */
const store = new Map<string, string>();
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
}

import { readFileSync } from "node:fs";
import * as E from "../../../lib/star/canvasEngine";
import * as B from "../../../lib/star/keeperBrain";
import { strikeKind, stepKind, enforceHardRules } from "../../../lib/star/kindRules";
import { mulberry32 } from "../../../lib/star/season";
import { launchShot, shotsPro } from "../../../lib/star/shotModel";
import { shotPowerOn, contactFieldOn, feelPower, feelLift } from "../../../lib/star/shotFeel";
import { oldStrikingPower } from "../../../lib/star/strikePower";
import { joinGoals, scenarioForGoal, realEnd, type RealGoal, type RgFile } from "../../../lib/star/realGoals";
import type { WyscoutShotFile } from "../../../lib/star/realMoments";

export const H = 1 / 180;
/** The page's striker (EnginePlay settings on the Real Goals page). */
export const SKILL = Number(process.env.RG_SKILL ?? 95);

export function loadGoals(): RealGoal[] {
  const shots = (JSON.parse(readFileSync("data/realmoments/wyscout_shots.json", "utf8")) as WyscoutShotFile).shots;
  const extras = (JSON.parse(readFileSync("data/realmoments/wyscout_goals.json", "utf8")) as RgFile).goals;
  return joinGoals(shots, extras);
}

/** The chance as the match sets it up (hard rules, defenders' roles, the keeper's brain and 1.5 s of aiming). */
function setUp(g: RealGoal, lane: boolean, seed: number): E.Scenario {
  const sc = scenarioForGoal(g, lane);
  enforceHardRules(sc);
  E.initDefenders(sc, mulberry32((seed ^ 0x1d) >>> 0));
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, sc.keeperStrength, B.brainOptionsHere());
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  return sc;
}

function strike(sc: E.Scenario, angle: number, power: number, cy: number, seed: number): E.Ball {
  const feel = shotPowerOn();
  // The power line from before 26 Oct 2026: these tests measure the lane, not the power curve.
  const skills = { power: feel ? feelPower(SKILL) : oldStrikingPower(SKILL), technique: SKILL };
  const pro = shotsPro(), field = contactFieldOn(), lift = feel ? feelLift(SKILL) : 1;
  const rec = { seed: (seed * 2654435761) >>> 0, pro, knuckle: false, field, lift };
  const dir = { x: Math.sin(angle), y: -Math.cos(angle) };
  return launchShot(sc, dir, power, { cx: 0, cy }, skills, mulberry32((seed ^ 0x51ed) >>> 0), rec, rec, E.launch).ball;
}

/** Where the strike crosses the goal line with nobody in the way. */
function crossing(g: RealGoal, angle: number, power: number, cy: number): { x: number; z: number } {
  const sc = scenarioForGoal(g, false);
  sc.defenders = []; sc.runner = null; sc.secondaryRunners = []; sc.teammates = [];
  sc.follower.x = 34; sc.follower.y = 80;
  sc.keeper.done = true; sc.keeper.y = -5;
  sc.goal = { ...sc.goal, x1: -200, x2: 300 };
  sc.crossbar = 99;
  const ball = strike(sc, angle, power, cy, 7);
  // Flown by the step itself (no bodies, no frame), so this file also runs on an engine without the real lane.
  const rng = mulberry32(0xbee);
  for (let i = 0; i < 180 * 5; i++) {
    const px = ball.pos.x, py = ball.pos.y, pz = ball.z;
    const out = E.stepBall(ball, sc, rng, H);
    if (py > 0 && ball.pos.y <= 0) { const f = py / (py - ball.pos.y || 1); return { x: px + (ball.pos.x - px) * f, z: pz + (ball.z - pz) * f }; }
    if (out) break;
  }
  const t = ball.vel.y < -0.1 ? ball.pos.y / -ball.vel.y : 99;
  return { x: ball.pos.x + ball.vel.x * t, z: 0 };
}

export interface Aim { angle: number; power: number; cy: number; x: number; z: number }

/** The arrow, the power and the tap that put the ball where the real one went. */
export function aimAtReal(g: RealGoal): Aim {
  const e = realEnd(g);
  const sc0 = scenarioForGoal(g, false);
  const from = sc0.ball;
  const dist = Math.hypot(e.x - from.x, from.y);
  const power = Math.min(0.95, 0.55 + dist / 60);
  const base = Math.atan2(e.x - from.x, from.y);
  const angleFor = (cy: number) => {
    let lo = base - 0.5, hi = base + 0.5;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (crossing(g, m, power, cy).x < e.x) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  let best: Aim = { angle: base, power, cy: 0, x: 0, z: 0 }, bestErr = Infinity;
  for (let i = 0; i <= 20; i++) {
    const cy = -1 + i * 0.1;
    const a = angleFor(cy);
    const c = crossing(g, a, power, cy);
    const err = Math.hypot(c.x - e.x, c.z - e.z);
    if (err < bestErr) { bestErr = err; best = { angle: a, power, cy, x: c.x, z: c.z }; }
  }
  // Refine the tap around the best one.
  let lo = Math.max(-1, best.cy - 0.1), hi = Math.min(1, best.cy + 0.1);
  for (let i = 0; i < 10; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const c1 = crossing(g, angleFor(m1), power, m1), c2 = crossing(g, angleFor(m2), power, m2);
    if (Math.abs(c1.z - e.z) < Math.abs(c2.z - e.z)) hi = m2; else lo = m1;
  }
  const cy = (lo + hi) / 2, a = angleFor(cy), c = crossing(g, a, power, cy);
  if (Math.hypot(c.x - e.x, c.z - e.z) < bestErr) best = { angle: a, power, cy, x: c.x, z: c.z };
  return best;
}

export interface Play { goal: boolean; outcome: string; inLane: boolean; x: number; z: number }

/** Play one strike (the found aim plus a wobble) against the real men. */
export function playStrike(g: RealGoal, aim: Aim, lane: boolean, seed: number, wobble = true): Play {
  const sc = setUp(g, lane, seed);
  const r = mulberry32((seed ^ 0x77) >>> 0);
  // A human wobble on the line: up to ±0.4° on the arrow and ±0.03 on the tap.
  const angle = aim.angle + (wobble ? (r() - 0.5) * 2 * (0.4 * Math.PI / 180) : 0);
  const cy = aim.cy + (wobble ? (r() - 0.5) * 0.06 : 0);
  const ball = strike(sc, angle, aim.power, cy, seed);
  B.brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
  const rng = mulberry32((seed ^ 0xbee) >>> 0);
  const rngR = mulberry32((seed ^ 0xabc) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: sc.keeperStrength, power: SKILL, technique: SKILL });
  let out: E.Outcome | null = null;
  let x = NaN, z = NaN;
  for (let i = 0; i < 180 * 6 && !out; i++) {
    E.stepDefenders(sc, H, ball.pos, false, ball);
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rngR);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    const px = ball.pos.x, py = ball.pos.y, pz = ball.z;
    out = E.stepBall(ball, sc, rng, H);
    if (Number.isNaN(x) && py > 0 && ball.pos.y <= 0) { const f = py / (py - ball.pos.y || 1); x = px + (ball.pos.x - px) * f; z = pz + (ball.z - pz) * f; }
  }
  return { goal: out === "goal" || out === "rebound", outcome: String(out), inLane: ball.realLane === true, x, z };
}

/** The ball the instant the found aim is struck (for a test page still: hand it to the match's setBall). */
export function launchState(g: RealGoal, aim = aimAtReal(g), seed = 9001) {
  const sc = setUp(g, true, seed);
  const b = strike(sc, aim.angle, aim.power, aim.cy, seed);
  return { x: b.pos.x, y: b.pos.y, z: b.z, vx: b.vel.x, vy: b.vel.y, vz: b.vz, spin: b.spin, shot: true };
}
