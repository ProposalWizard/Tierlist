/**
 * KEEPER REALISM harness (Leo, round 16): YOUR OWN shot, struck from a chosen
 * spot at a chosen point of the goal, the way the real match strikes it
 * (CanvasMatch: launchShot with this phone's Shots / Contact field / Shot
 * power switches → brainStrike → strikeKind → 1/180 s flight with the keeper
 * brain), and what the keeper did with it.
 *
 * The aim is found, not guessed: for each shot the arrow and the tap height
 * are searched (keeper out of the way, same seeded strike) until the ball
 * crosses the goal line within 15 cm of the target point. Then the same
 * strike is played against the real keeper. So a "Henry" here is a side-foot
 * curler from the corner of the six-yard box that really does arrive low
 * inside the far post; the only question left is whether he saves it.
 *
 * Switches are read through a fake localStorage (setConfig) exactly as the
 * game reads them on a phone.
 */
const store = new Map<string, string>();
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
}
const LS = (globalThis as unknown as { localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } }).localStorage;

import * as E from "../../../lib/star/canvasEngine";
import * as B from "../../../lib/star/keeperBrain";
import { strikeKind, stepKind } from "../../../lib/star/kindRules";
import { mulberry32 } from "../../../lib/star/season";
import { CX, POST_L, POST_R } from "../../../lib/star/pitch";
import { launchShot, shotsPro } from "../../../lib/star/shotModel";
import { shotPowerOn, contactFieldOn, feelPower, feelLift } from "../../../lib/star/shotFeel";
import { oldStrikingPower } from "../../../lib/star/strikePower";

export const H = 1 / 180;
const DEBUG = !!process.env.KDEBUG;
export type KeeperStart = "centre" | "set" | "drawn";
export let KSTART: KeeperStart = (process.env.KSTART as KeeperStart) || "set";
export function setKeeperStart(v: KeeperStart) { KSTART = v; }

/** The rows the Oct 13 update test page flips together (oct13Update.ts OCT13_ALL, gameplay ones). */
export const OCT13_GAMEPLAY = ["shotPower", "contactField", "keeperFeel", "mateShots", "shotsPro", "keeperPro", "ballPhysics"];

/** "live" = every switch on its default; "oct13" = the Oct 13 update on. Extra keys override. */
export function setConfig(cfg: "live" | "oct13", extra: Record<string, "new" | "old"> = {}) {
  for (const s of [...OCT13_GAMEPLAY, "keeperFinish"]) LS.removeItem(`star-gameplay-${s}`);
  if (cfg === "oct13") for (const s of OCT13_GAMEPLAY) LS.setItem(`star-gameplay-${s}`, "new");
  for (const [k, v] of Object.entries(extra)) LS.setItem(`star-gameplay-${k}`, v);
}

export interface Placed {
  /** Where it is struck from (game metres: goal line y = 0, centre x = CX). */
  from: { x: number; y: number };
  /** Where it should cross the goal line. */
  targetX: number;
  targetZ: number;
  /** The drag, 0..1. */
  power: number;
  /** Side of the ball (−1..1): 0 = through the middle. Sign is chosen so the ball bends IN toward goal. */
  curl: number;
  ks: number;
  /** Shooter's power / technique stat. */
  skill: number;
  seed: number;
  /** Use the match's own served chance of this kind exactly as built (keeper, defenders), struck from its ball. */
  served?: E.ScenarioKind;
}

export interface Result {
  goal: boolean;
  saved: boolean;
  /** Missed the target after all (aim search failed). */
  off: boolean;
  /** Where it really crossed (aim-search check) and how fast it was struck. */
  x: number; z: number; kmh: number;
  keeperX: number; keeperY: number;
  save: string | null;
  outcome: string;
}

function kindFor(from: { x: number; y: number }): E.ScenarioKind {
  const lat = Math.abs(from.x - CX);
  if (from.y > 18) return "long_range";
  if (lat > 7 && from.y < 14) return "tight_angle";
  return "one_on_one";
}

/** A shooting picture: you, the ball, the keeper. No defenders (nothing to block it). */
function picture(p: Placed): E.Scenario {
  if (p.served) {
    const sc = E.buildScenario(p.served, mulberry32(p.seed), p.ks, 60, 55);
    sc.follower.x = CX; sc.follower.y = 60;
    sc.runner = null; sc.passTarget = null; sc.secondaryRunners = []; sc.receiver = null;
    return sc;
  }
  const sc = E.buildScenario(kindFor(p.from), mulberry32(p.seed), p.ks, 60, 55);
  sc.ball = { x: p.from.x, y: p.from.y };
  sc.player = { x: p.from.x, y: p.from.y };
  sc.defenders = [];
  sc.runner = null;
  sc.passTarget = null;
  sc.secondaryRunners = [];
  sc.receiver = null;
  sc.teammates = [];
  // The poacher stays out of it (a ball across the six-yard box is not his to tap in here).
  sc.follower.x = CX; sc.follower.y = 60;
  // Where he starts, before the brain walks him (capped: 1 m in a tight
  // angle, 2.2 m elsewhere) while you aim, as in a match:
  //  "centre" (default): in the middle of his goal, 0.8 m out — the ball has
  //    come to this spot faster than he could get across. This is the case Leo
  //    describes ("if he's close to it"): the far post is near him.
  //  "set": already on the angle at his depth (bisector).
  //  "drawn": where buildTightAngle draws him (the near post, 2-3.4 m off centre).
  const kr = mulberry32((p.seed ^ 0x6ee9) >>> 0);
  const side = Math.sign(p.from.x - CX) || 1;
  if (KSTART === "drawn" && sc.kind === "tight_angle") {
    sc.keeper.x = CX + side * (p.from.y < 4 ? 3.4 : p.from.y < 8 ? 3.0 : 2.0);
    sc.keeper.y = 0.6 + kr() * 0.8;
  } else if (KSTART === "set") {
    sc.keeper.y = B.idealDepth(p.from);
    sc.keeper.x = B.bisectorX(p.from, sc.keeper.y) + (kr() - 0.5) * 0.6;
  } else {
    sc.keeper.x = CX;
    sc.keeper.y = 0.8;
  }
  return sc;
}

function strike(sc: E.Scenario, dir: E.Vec2, p: Placed, cy: number): E.Ball {
  const stat = p.skill;
  const feel = shotPowerOn();
  // The power line from before 26 Oct 2026: these tests measure the keeper,
  // and a change to the power curve must not move their fingerprints.
  const skills = { power: feel ? feelPower(stat) : oldStrikingPower(stat), technique: stat };
  const contact = { cx: p.curl, cy };
  const pro = shotsPro(), field = contactFieldOn(), lift = feel ? feelLift(stat) : 1;
  const rec = { seed: (p.seed * 2654435761) >>> 0, pro, knuckle: false, field, lift };
  return launchShot(sc, dir, p.power, contact, skills, mulberry32((p.seed ^ 0x51ed) >>> 0), rec, rec, E.launch).ball;
}

/** Fly with the keeper out of the way: where does it cross the goal line? */
function crossing(p: Placed, angle: number, cy: number): { x: number; z: number } {
  const sc = picture(p);
  sc.keeper.done = true;
  // No frame for the search: a ball off the bar or post never "crosses", and
  // the search must see where it WOULD cross.
  sc.goal = { ...sc.goal, x1: -200, x2: 300 };
  sc.crossbar = 99;
  const dir = { x: Math.sin(angle), y: -Math.cos(angle) };
  const ball = strike(sc, dir, p, cy);
  // The same flight stream play() uses, so a ball that wobbles or bounces does so the same way.
  const rng = mulberry32((p.seed ^ 0xbee) >>> 0);
  let px = ball.pos.x, py = ball.pos.y, pz = ball.z;
  for (let i = 0; i < 180 * 4; i++) {
    px = ball.pos.x; py = ball.pos.y; pz = ball.z;
    const out = E.stepBall(ball, sc, rng, H);
    if (ball.pos.y <= 0 && py > 0) {
      const f = py / (py - ball.pos.y || 1);
      return { x: px + (ball.pos.x - px) * f, z: pz + (ball.z - pz) * f };
    }
    if (out) break;
  }
  // Never got there: extrapolate the last heading (a counted miss).
  const t = ball.vel.y < -0.1 ? ball.pos.y / -ball.vel.y : 99;
  return { x: ball.pos.x + ball.vel.x * t, z: Math.max(0, ball.z + ball.vz * t - 4.9 * t * t) };
}

/** Search the arrow (and the tap height) so the strike crosses at the target. */
export function aimFor(p: Placed): { angle: number; cy: number; x: number; z: number } {
  const base = Math.atan2(p.targetX - p.from.x, p.from.y);
  let cy = 0, angle = base;
  let x = 0, z = 0;
  for (let round = 0; round < 3; round++) {
    let lo = base - 0.6, hi = base + 0.6;
    for (let i = 0; i < 16; i++) {
      const m = (lo + hi) / 2;
      const c = crossing(p, m, cy);
      if (c.x < p.targetX) lo = m; else hi = m;
    }
    angle = (lo + hi) / 2;
    // Height: scan the tap (the Shots model's height is not always monotonic in it), then refine.
    let best = 0, bestErr = Infinity;
    const zs: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const v = -1 + i * 0.1;
      const zz = crossing(p, angle, v).z;
      zs.push(zz);
      const e = Math.abs(zz - p.targetZ);
      if (e < bestErr) { bestErr = e; best = i; }
    }
    cy = -1 + best * 0.1;
    for (const j of [best - 1, best]) {
      if (j < 0 || j >= 20) continue;
      const z0 = zs[j], z1 = zs[j + 1];
      if ((z0 - p.targetZ) * (z1 - p.targetZ) > 0) continue;
      let a = -1 + j * 0.1, b = a + 0.1;
      const up = z1 > z0;
      for (let i = 0; i < 10; i++) {
        const m = (a + b) / 2;
        if ((crossing(p, angle, m).z < p.targetZ) === up) a = m; else b = m;
      }
      cy = (a + b) / 2;
      break;
    }
  }
  // Last, the arrow again for the final tap.
  {
    let lo = angle - 0.3, hi = angle + 0.3;
    for (let i = 0; i < 16; i++) {
      const m = (lo + hi) / 2;
      if (crossing(p, m, cy).x < p.targetX) lo = m; else hi = m;
    }
    angle = (lo + hi) / 2;
  }
  const c = crossing(p, angle, cy);
  x = c.x; z = c.z;
  return { angle, cy, x, z };
}

/** Play the found strike against the real keeper. */
export function play(p: Placed, aim = aimFor(p)): Result {
  const sc = picture(p);
  B.brainSetup(sc, (p.seed ^ 0x4b7e) >>> 0, p.ks, { openPlay: 0.55 });
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const k = sc.keeper;
  const keeperX = k.x, keeperY = k.y;
  const dir = { x: Math.sin(aim.angle), y: -Math.cos(aim.angle) };
  const ball = strike(sc, dir, p, aim.cy);
  const kmh = Math.hypot(ball.vel.x, ball.vel.y, ball.vz) * 3.6;
  B.brainStrike(sc, ball, (p.seed ^ 0x6b1e5) >>> 0);
  const rng = mulberry32((p.seed ^ 0xbee) >>> 0);
  const rngR = mulberry32((p.seed ^ 0xabc) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((p.seed ^ 0x6b1d) >>> 0), { keeperStrength: p.ks, power: p.skill, technique: p.skill });
  let out: E.Outcome | null = null;
  let save: string | null = null;
  for (let i = 0; i < 180 * 6 && !out; i++) {
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rngR);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    const py = ball.pos.y;
    if (DEBUG && k.saves === 0 && !k.done) {
      const ny = py + ball.vel.y * H;
      if (py > k.y && ny <= k.y) {
        const st = B.brainStateOf(sc);
        console.log(`  @line kx ${k.x.toFixed(2)} ky ${k.y.toFixed(2)} ball ${ball.pos.x.toFixed(2)} z ${ball.z.toFixed(2)} reach ${E.keeperSaveRadius(sc).toFixed(2)} (mult ${(sc.keeperReach ?? 1).toFixed(2)}) phase ${st?.phase} t ${st?.t.toFixed(2)}`);
      }
    }
    out = E.stepBall(ball, sc, rng, H);
    if (save === null) {
      const s = (ball.actionLog ?? []).find((a) => a.kind === "save" && a.save && a.save !== "beaten");
      if (s) {
        save = s.save!;
        if (DEBUG) { const st = B.brainStateOf(sc); console.log(`  SAVE ${save} at ${s.at?.x.toFixed(2)},${s.at?.y.toFixed(2)} z ${s.at?.z.toFixed(2)} keeper ${k.x.toFixed(2)},${k.y.toFixed(2)} phase ${st?.phase} t ${st?.t.toFixed(2)} rt ${st?.rt.toFixed(2)} mult ${(sc.keeperReach ?? 1).toFixed(2)}`); }
      }
    }
  }
  // First shot only, the way real save % counts it: stopped = saved, a
  // fumble or a ball that went in = goal (a rebound later is a new shot).
  const saved = save !== null && save !== "fumble";
  const goal = !saved && (out === "goal" || out === "rebound" || save === "fumble");
  const offT = Math.abs(aim.x - p.targetX) > 0.15 || Math.abs(aim.z - p.targetZ) > 0.3;
  return { goal, saved, off: offT, x: aim.x, z: aim.z, kmh, keeperX, keeperY, save, outcome: String(out) };
}

/** Case definitions (side = −1 struck from the left channel (x < CX), +1 the right). */
export type CaseId = string;
export interface CaseDef { id: CaseId; label: string; make: (seed: number, r: () => number) => Placed }

const jit = (r: () => number, a: number) => (r() - 0.5) * 2 * a;

/** Sign of the side-of-ball tap that bends a ball from `fromX` in toward goal centre. Found once by experiment. */
let CURL_IN: number | null = null;
function curlIn(): number {
  if (CURL_IN !== null) return CURL_IN;
  // From the left channel, curl +0.6 or −0.6: which one needs an arrow aimed
  // further outside the far post than the target (= bends back in)?
  const from = { x: CX - 9, y: 6 };
  const p = (c: number): Placed => ({ from, targetX: POST_R - 0.4, targetZ: 0.3, power: 0.7, curl: c, ks: 80, skill: 80, seed: 11 });
  const a = aimFor(p(0.6)), b = aimFor(p(-0.6));
  // The arrow's line at the goal line: tan(angle)·from.y + from.x.
  const lineX = (ang: number) => from.x + Math.tan(ang) * from.y;
  CURL_IN = lineX(a.angle) > lineX(b.angle) ? 1 : -1;
  return CURL_IN;
}

export function cases(): CaseDef[] {
  const ci = curlIn();
  const side = (r: () => number) => (r() < 0.5 ? -1 : 1);
  const C: CaseDef[] = [];
  // (a) Top corners from the edge of the box, central-ish, by power.
  for (const [pw, lab] of [[0.55, "low"], [0.75, "medium"], [0.95, "full"]] as const) {
    C.push({
      id: `top-${lab}`, label: `Top corner, ${lab} power (12-16 m, central)`,
      make: (seed, r) => {
        const s = side(r);
        return { from: { x: CX + jit(r, 3), y: 12 + r() * 4 }, targetX: s > 0 ? POST_R - 0.35 - r() * 0.3 : POST_L + 0.35 + r() * 0.3,
          targetZ: 1.95 + r() * 0.25, power: pw, curl: 0, ks: 80, skill: 80, seed };
      },
    });
  }
  // (b) Near-post top corner from close range, a tight angle.
  C.push({
    id: "near-top", label: "Near-post top corner, close (6-12 m, tight angle)",
    make: (seed, r) => {
      const s = side(r);
      return { from: { x: CX + s * (5 + r() * 4), y: 6 + r() * 6 }, targetX: s > 0 ? POST_R - 0.3 - r() * 0.25 : POST_L + 0.3 + r() * 0.25,
        targetZ: 1.9 + r() * 0.3, power: 0.8 + r() * 0.15, curl: 0, ks: 80, skill: 80, seed };
    },
  });
  // Near post, low, from close at an angle (real: saved 36%, n 53).
  C.push({
    id: "near-low", label: "Near-post bottom corner, close (6-12 m, angle)",
    make: (seed, r) => {
      const s = side(r);
      return { from: { x: CX + s * (5 + r() * 4), y: 6 + r() * 6 }, targetX: s > 0 ? POST_R - 0.3 - r() * 0.25 : POST_L + 0.3 + r() * 0.25,
        targetZ: 0.15 + r() * 0.25, power: 0.8 + r() * 0.15, curl: 0, ks: 80, skill: 80, seed };
    },
  });
  // (c) The Henry: corner of the six-yard box / channel, side-foot curl, far post bottom corner.
  for (const [lab, y0, y1, x0, x1] of [["six", 5, 7.5, 8, 10], ["box", 9, 14, 8, 12]] as const) {
    C.push({
      id: `henry-${lab}`, label: lab === "six" ? "Henry: corner of the 6-yard box, curled far post low" : "Henry: channel 9-14 m out, curled far post low",
      make: (seed, r) => {
        const s = side(r);
        // Struck from side s, so the far post is the other side.
        const far = -s;
        return { from: { x: CX + s * (x0 + r() * (x1 - x0)), y: y0 + r() * (y1 - y0) },
          targetX: far > 0 ? POST_R - 0.35 - r() * 0.3 : POST_L + 0.35 + r() * 0.3,
          targetZ: 0.15 + r() * 0.25, power: 0.7 + r() * 0.25, curl: ci * -s * (0.5 + r() * 0.3), ks: 80, skill: 80, seed };
      },
    });
  }
  // The Henry on the match's own served chances: a tight-angle or one-on-one
  // chance whose ball is in the channel (6-12 m across, 4-14 m out), keeper
  // and defenders where the builder put them.
  for (const kind of ["tight_angle", "one_on_one"] as const) {
    C.push({
      id: `henry-served-${kind}`, label: `Henry on served ${kind.replace("_", "-")} chances (channel)`,
      make: (seed, r) => {
        let s2 = seed;
        for (let tries = 0; tries < 400; tries++, s2 = (Math.imul(s2, 1103515245) + 12345) >>> 0) {
          const sc = E.buildScenario(kind, mulberry32(s2), 80, 60, 55);
          const lat = Math.abs(sc.ball.x - CX);
          if (lat >= 6 && lat <= 12 && sc.ball.y >= 4 && sc.ball.y <= 14) {
            const s = Math.sign(sc.ball.x - CX);
            const far = -s;
            return { from: { ...sc.ball }, targetX: far > 0 ? POST_R - 0.35 - r() * 0.3 : POST_L + 0.35 + r() * 0.3,
              targetZ: 0.15 + r() * 0.25, power: 0.7 + r() * 0.25, curl: ci * -s * (0.5 + r() * 0.3), ks: 80, skill: 80, seed: s2, served: kind };
          }
        }
        throw new Error("no served chance in the channel");
      },
    });
  }
  // The same far-post low finish, no curl (a plain side-foot).
  C.push({
    id: "far-low-plain", label: "Far post low, no curl, from the 6-yard-box corner",
    make: (seed, r) => {
      const s = side(r);
      const far = -s;
      return { from: { x: CX + s * (8 + r() * 2), y: 5 + r() * 2.5 }, targetX: far > 0 ? POST_R - 0.35 - r() * 0.3 : POST_L + 0.35 + r() * 0.3,
        targetZ: 0.15 + r() * 0.25, power: 0.75 + r() * 0.2, curl: 0, ks: 80, skill: 80, seed };
    },
  });
  // (d) Controls: central low and straight at him.
  C.push({
    id: "central-low", label: "Central, low (inside 1.2 m of the middle), 10-16 m",
    make: (seed, r) => ({ from: { x: CX + jit(r, 4), y: 10 + r() * 6 }, targetX: CX + jit(r, 1.1), targetZ: 0.2 + r() * 0.3,
      power: 0.7 + r() * 0.25, curl: 0, ks: 80, skill: 80, seed }),
  });
  C.push({
    id: "at-him", label: "Straight at him (chest height), 10-16 m",
    make: (seed, r) => ({ from: { x: CX + jit(r, 3), y: 10 + r() * 6 }, targetX: CX + jit(r, 0.4), targetZ: 0.9 + r() * 0.4,
      power: 0.7 + r() * 0.25, curl: 0, ks: 80, skill: 80, seed }),
  });
  C.push({
    id: "mid-low-out", label: "Low, 1.2-2.4 m off centre, from 18-24 m",
    make: (seed, r) => {
      const s = side(r);
      return { from: { x: CX + jit(r, 5), y: 18 + r() * 6 }, targetX: CX + s * (1.2 + r() * 1.2), targetZ: 0.2 + r() * 0.3,
        power: 0.75 + r() * 0.2, curl: 0, ks: 80, skill: 80, seed };
    },
  });
  C.push({
    id: "corner-low-out", label: "Bottom corner from outside the box (18-24 m)",
    make: (seed, r) => {
      const s = side(r);
      return { from: { x: CX + jit(r, 5), y: 18 + r() * 6 }, targetX: s > 0 ? POST_R - 0.35 - r() * 0.3 : POST_L + 0.35 + r() * 0.3,
        targetZ: 0.2 + r() * 0.3, power: 0.8 + r() * 0.15, curl: 0, ks: 80, skill: 80, seed };
    },
  });
  return C;
}

export interface CaseStats { n: number; off: number; goal: number; saved: number; kmh: number }
export function runCase(c: CaseDef, n: number, seed0 = 1, ks?: number): CaseStats {
  const st: CaseStats = { n: 0, off: 0, goal: 0, saved: 0, kmh: 0 };
  for (let i = 0; i < n; i++) {
    const seed = (seed0 * 100003 + i * 7919) >>> 0;
    const r = mulberry32((seed ^ 0xcafe) >>> 0);
    const p = c.make(seed, r);
    if (ks !== undefined) p.ks = ks;
    const res = play(p);
    if (res.off) { st.off++; continue; }
    st.n++; st.kmh += res.kmh;
    if (res.goal) st.goal++; else if (res.saved) st.saved++;
  }
  st.kmh /= Math.max(1, st.n);
  return st;
}

export const savePct = (s: CaseStats) => (100 * s.saved) / Math.max(1, s.saved + s.goal);
