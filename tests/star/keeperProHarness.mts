/**
 * The keeper measuring harness (Leo v0.15, "1. The goalkeeper"): one shot, the
 * way the match serves and strikes it, with everything the keeper does to it
 * written down. Used by tests/star/keeperPro.mts (and its --report mode, which
 * prints the before/after table in docs/gameplay15/keeper.md).
 */
import * as E from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind } from "../../lib/star/kindRules";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";
import * as B from "../../lib/star/keeperBrain";

const H = 1 / 180;

export interface ShotRec {
  kind: string;
  ks: number;
  /** Distance from the goal centre at the strike (m). */
  dist: number;
  /** "six" (inside the 6-yard box), "box" (rest of the area), "out" (outside). */
  zone: "six" | "box" | "out";
  goal: boolean;
  onTarget: boolean;
  /** First keeper contact: catch / parry / push / fumble, or null. */
  save: E.SaveResult | null;
  /** Ball as it reached his line. */
  speed: number; z: number; xAt: number;
  /** His depth off the goal line at the strike (m). */
  keeperY: number;
  /** |ball − keeper body| (m) at the moment of the save. */
  gap: number | null;
  /** 0.35 s after the save, his body is this far from where the ball was saved (m) — the "hand through the ball" check. */
  bodyEnd: number | null;
  /** After a parry/push: where the ball went. */
  parry: "danger" | "safe" | "out" | null;
  /** A goal after his first save (a rebound). */
  reboundGoal: boolean;
  /** Top corner (≥ 2.3 m off centre and ≥ 1.5 m high at his line). */
  top: boolean;
  outcome: string;
}

export interface ShotOpts {
  /** Aim: "any" = anywhere in the goal; "corner" = the outer 0.85 m; "body" = at him. */
  aim?: "any" | "corner" | "body";
  power?: [number, number];
  cy?: [number, number];
  /** Taker skills. */
  skill?: number;
}

function zoneOf(x: number, y: number): ShotRec["zone"] {
  if (y <= 5.5 && Math.abs(x - CX) <= 9.16) return "six";
  if (y <= 16.5 && Math.abs(x - CX) <= 20.16) return "box";
  return "out";
}

export function shoot(kind: E.ScenarioKind, seed: number, ks: number, o: ShotOpts = {}): ShotRec {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null, set: "new" }).sc;
  E.initDefenders(sc, rng);
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { openPlay: 0.55 });
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const k = sc.keeper;
  const kr = mulberry32((seed ^ 0xa11ce) >>> 0);
  const side = kr() < 0.5 ? -1 : 1;
  const aim = o.aim ?? "any";
  const tx = aim === "corner" ? CX + side * (3.66 - 0.3 - kr() * 0.55)
    : aim === "body" ? k.x + (kr() - 0.5) * 0.6
    : POST_L + 0.15 + kr() * (POST_R - POST_L - 0.3);
  const [p0, p1] = o.power ?? [0.8, 0.95];
  const [c0, c1] = o.cy ?? [-0.9, 0.6];
  const cy = c0 + kr() * (c1 - c0), power = p0 + kr() * (p1 - p0), cx = (kr() - 0.5) * 0.4;
  const dx = tx - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const dist = Math.hypot(sc.ball.x - CX, sc.ball.y);
  const zone = zoneOf(sc.ball.x, sc.ball.y);
  const keeperY = k.y;
  const sk = o.skill ?? 75;
  const ball = E.launch(sc, { x: dx / L, y: dy / L }, power, { cx, cy }, { power: sk, technique: sk }, rng);
  B.brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: sk, technique: sk });
  let out: E.Outcome | null = null;
  let speed = 0, z = 0, xAt = 0, gap: number | null = null, bodyEnd: number | null = null;
  let save: E.SaveResult | null = null, savedAtSeq = -1, saveX = 0;
  let parry: ShotRec["parry"] = null;
  let i = 0, saveStep = -1;
  const SETTLE = 63; // 0.35 s after the save: where his body has got to
  for (; i < 180 * 7 && !out; i++) {
    if (saveStep >= 0 && bodyEnd === null && i - saveStep >= SETTLE) bodyEnd = Math.abs(k.x - saveX);
    E.stepDefenders(sc, H, ball.pos, false, ball);
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rng);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    const kxBefore = k.x;
    if (save === null && ball.lastTouch === "attack" && !ball.loose && ball.vel.y < -0.5 && ball.pos.y > k.y) {
      speed = Math.hypot(ball.vel.x, ball.vel.y, ball.vz);
      const dtc = (ball.pos.y - k.y) / -ball.vel.y;
      xAt = ball.pos.x + ball.vel.x * dtc;
      z = Math.max(0, ball.z + ball.vz * dtc - 4.9 * dtc * dtc);
    }
    out = E.stepBall(ball, sc, rng, H);
    const log = ball.actionLog ?? [];
    if (save === null) {
      const s = log.find((a) => a.kind === "save" && a.save && a.save !== "beaten");
      if (s) { save = s.save!; savedAtSeq = s.seq; saveX = s.at?.x ?? xAt; gap = Math.abs(saveX - kxBefore); saveStep = i; }
    }
    if (save && parry === null && (save === "parry" || save === "push") && !out) {
      const sp = Math.hypot(ball.vel.x, ball.vel.y);
      const touched = log.some((a) => a.seq > savedAtSeq && a.actor !== "keeper");
      if (sp < 4 || touched) parry = (ball.pos.y < 12 && Math.abs(ball.pos.x - CX) < 9) ? "danger" : "safe";
    }
  }
  // Let him finish moving (the result phase keeps stepping him), then see where his body ended.
  if (save && bodyEnd === null) {
    for (let j = i - saveStep; j < SETTLE; j++) { E.stepKeeper(sc, H); B.brainStep(sc, null, H); }
    bodyEnd = Math.abs(k.x - saveX);
  }
  if (save === "push" && parry === null && out === "saved") parry = "out";
  if ((save === "parry" || save === "push") && parry === null) parry = out === "goal" || out === "rebound" ? "danger" : "safe";
  const goal = out === "goal" || out === "rebound";
  const top = Math.abs(xAt - CX) >= 2.3 && z >= 1.5;
  const onTarget = goal || save !== null || k.saves > 0;
  return { kind, ks, dist, zone, goal, onTarget, save, speed, z, xAt, keeperY, gap, bodyEnd, parry,
    reboundGoal: goal && save !== null, top, outcome: String(out) };
}

export const pctS = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;

/**
 * Save % of on-target shots, the way the real figures count it: the first
 * shot is saved if he stopped it (a rebound scored afterwards is a new shot);
 * a ball he touched and let in (a fumble) or that went through him is a goal.
 */
export function firstSaved(r: ShotRec): boolean { return r.save !== null && r.save !== "fumble"; }
export function saveRate(rs: ShotRec[]) {
  const on = rs.filter((r) => r.onTarget);
  const saved = on.filter(firstSaved);
  return { n: on.length, rate: saved.length / Math.max(1, on.length) };
}

export { CX, POST_L, POST_R, GOAL_H };

export interface DeliveryRec {
  kind: string; ks: number;
  /** The ball came into his area (the box). */
  intoBox: boolean;
  /** He came for it (a claim was set). */
  came: boolean;
  /** What happened at his hands: catch / punch / flap — or null. */
  claim: "catch" | "punch" | "flap" | null;
  /** The chance ended in a goal. */
  goal: boolean;
  outcome: string;
}

/** Where a lofted ball first drops to head height (1.9 m), or lands, after its peak (no players, light drag). */
function dropPoint(sc: E.Scenario, dir: { x: number; y: number }, power: number, cy: number, sk: number): { x: number; y: number } | null {
  const c = structuredClone(sc) as E.Scenario;
  const b = E.launch(c, dir, power, { cx: 0, cy }, { power: sk, technique: sk }, mulberry32(1));
  let peaked = false;
  for (let i = 0; i < 180 * 4; i++) {
    const vz0 = b.vz;
    b.vz -= 9.81 * H; b.z += b.vz * H; b.pos.x += b.vel.x * H; b.pos.y += b.vel.y * H;
    const s = Math.hypot(b.vel.x, b.vel.y); const drag = 0.012 * s * s * H;
    if (s > 0) { b.vel.x *= 1 - drag / s; b.vel.y *= 1 - drag / s; }
    if (vz0 > 0 && b.vz <= 0) peaked = true;
    if ((peaked && b.z <= 1.9) || b.z <= 0) return { x: b.pos.x, y: b.pos.y };
  }
  return null;
}
const MISS = Number(process.env.MISS ?? 5);
const clamp01 = (v: number) => Math.max(0.05, Math.min(1, v));

/** A cross or a through ball played toward the runner, about as well as a player judges it — then whatever happens. */
export function deliver(kind: "corner" | "byline_cross" | "through_ball", seed: number, ks: number): DeliveryRec {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null, set: "new" }).sc;
  E.initDefenders(sc, rng);
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { openPlay: 0.55 });
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const k = sc.keeper;
  const kr = mulberry32((seed ^ 0xc1055) >>> 0);
  const tgt = sc.passTarget ?? sc.runner?.pos ?? { x: CX, y: 8 };
  // A real delivery misses its man by metres: in the Premier League only about
  // a quarter of crosses find a team-mate (Opta). MISS sets the spread (m).
  const gx = (kr() + kr() + kr() - 1.5) * MISS, gy = (kr() + kr() + kr() - 1.5) * MISS;
  const aim = { x: tgt.x + gx, y: tgt.y + gy };
  const dx = aim.x - sc.ball.x, dy = aim.y - sc.ball.y, L = Math.hypot(dx, dy);
  const dir = { x: dx / L, y: dy / L };
  const lofted = kind !== "through_ball";
  const cy = lofted ? 0.45 + kr() * 0.5 : -0.6 + kr() * 0.5;
  // The power whose ball drops nearest the aim point (a player judging the weight).
  let power = 0.6, best = Infinity;
  if (lofted) {
    for (let p = 0.3; p <= 1.0001; p += 0.05) {
      const d = dropPoint(sc, dir, p, cy, 75);
      const err = d ? Math.hypot(d.x - aim.x, d.y - aim.y) : Infinity;
      if (err < best) { best = err; power = p; }
    }
  } else power = 0.35 + L / 60;
  power = clamp01(power + (kr() - 0.5) * 0.12);
  const ball = E.launch(sc, dir, power, { cx: (kr() - 0.5) * 0.3, cy }, { power: 75, technique: 75 }, rng);
  B.brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: 75, technique: 75 });
  let out: E.Outcome | null = null, intoBox = false, came = false;
  for (let i = 0; i < 180 * 7 && !out; i++) {
    E.stepDefenders(sc, H, ball.pos, false, ball);
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rng);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    if (k.claim) came = true;
    if (ball.pos.y <= 16.5 && Math.abs(ball.pos.x - CX) <= 20.16 && ball.lastTouch === "attack") intoBox = true;
    out = E.stepBall(ball, sc, rng, H);
  }
  const log = ball.actionLog ?? [];
  const first = log.find((a) => a.actor === "keeper" && a.kind === "save");
  let claim: DeliveryRec["claim"] = null;
  if (came && first) claim = first.save === "catch" ? "catch" : first.save === "push" ? "punch" : first.save === "beaten" ? "flap" : null;
  return { kind, ks, intoBox, came, claim, goal: out === "goal" || out === "rebound", outcome: String(out) };
}
