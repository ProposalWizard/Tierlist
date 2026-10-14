/**
 * HITBOX MEASUREMENTS — shared by tests/star/hitbox.mts and the numbers in
 * docs/gameplay16/hitbox.md. Each one is a controlled set-up on the real
 * engine (stepBall and friends), not a model of it.
 *
 *   clearance   the lowest height a ball can pass over a lone defender
 *               (or keeper) and not be touched, by distance and offset
 *   overMate    a lofted shot / chip pass over a team-mate's head: how
 *               often he gets in the way
 *   crosses     crosses to a runner: how often he gets it (header) and how
 *               often a defender cuts it out
 *   blocks      shots through a crowd: how often one is blocked
 */
import { POST_L, POST_R } from "../../lib/star/pitch";
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, isDriveAtGoal, type Outcome, type ScenarioKind, type Scenario, type Ball, type Runner,
} from "../../lib/star/canvasEngine";

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;
const G = 9.8;
/** The middle of the goal: x of every set-up below. */
export const CX = (POST_L + POST_R) / 2;

/** An empty pitch: the ball at (0, y0), nobody on it but the keeper, far away. */
function emptyScene(seed: number, y0: number): { sc: Scenario; ball: Ball; rng: () => number } {
  const rng = mulberry32(seed);
  const sc = buildScenario("long_range", rng, 60, 60, 60);
  sc.defenders = [];
  sc.secondaryRunners = [];
  sc.runner = null as unknown as Scenario["runner"];
  sc.teammates = [];
  sc.follower.active = false; sc.follower.shot = true;
  sc.follower.x = 30; sc.follower.y = 40;
  sc.ball = { x: CX, y: y0 };
  sc.player = { x: CX, y: y0 + 0.5 };
  sc.viewport = { x1: CX - 30, x2: CX + 30, y1: -4, y2: y0 + 6 };
  const ball = launch(sc, { x: 0, y: -1 }, 0.5, { cx: 0, cy: 0 }, { power: 60, technique: 60 }, rng);
  ball.pos = { x: CX, y: y0 }; ball.spin = 0; ball.topspin = 0;
  ball.contactCd = 0; ball.loose = false; ball.resting = false;
  return { sc, ball, rng };
}

/** Aim a ball from (0,y0) so it passes y = yAt at height h with ground speed s. */
function aim(ball: Ball, y0: number, yAt: number, h: number, s: number, x0 = 0, xAt = 0) {
  const dx = xAt - x0, dy = yAt - y0;
  const d = Math.hypot(dx, dy);
  const t = d / s;
  ball.z = 0.11;
  ball.vz = (h - ball.z + 0.5 * G * t * t) / t;
  ball.vel = { x: dx / d * s, y: dy / d * s };
}

export interface ClearanceRow { dist: number; offset: number; speed: number; shot: boolean; clearZ: number }

/**
 * The lowest height (to 5 cm) at which a ball passing a lone defender is NOT
 * touched. He stands `dist` metres in front of the ball, `offset` metres to
 * the side of its line. Heights measured where the ball actually was as it
 * passed him.
 */
export function clearance(dist: number, offset: number, speed: number, shot: boolean): number {
  const y0 = 34;
  for (let h = 0.3; h <= 4.0; h += 0.05) {
    const { sc, ball, rng } = emptyScene(1234, y0);
    sc.defenders = [{ x: CX + offset, y: y0 - dist, baseRole: "press", role: "press" } as Scenario["defenders"][number]];
    sc.receiverDone = true;
    aim(ball, y0, y0 - dist, h, speed);
    ball.shot = shot;
    let res: Outcome | null = null, zAt = h;
    const yd = y0 - dist;
    for (let i = 0; i < 400 && !res; i++) {
      stepReactions(sc, ball, DT, rng);
      const py = ball.pos.y, pz = ball.z;
      res = stepBall(ball, sc, rng, DT);
      if (py > yd && ball.pos.y <= yd) zAt = pz + (ball.z - pz) * ((py - yd) / (py - ball.pos.y || 1));
      if (ball.pos.y < yd - 3) break;
    }
    if (res !== "blocked" && res !== "tackled") return Math.round(zAt * 100) / 100;
  }
  return 9;
}

export interface OverMate { trials: number; clipped: number; asPass: number }

/**
 * A ball lofted over a team-mate's head, the engine deciding (isDriveAtGoal,
 * as launch does) whether it is a shot or a ball to him.
 *
 * shot: he stands 4-12 m out, up to a metre off the line; the ball is struck
 * at goal (22 m/s) and passes him at 1.6-2.8 m.
 * pass: a chip to a second team-mate 10 m behind him, dropping to about
 * chest height at that man; only chips passing the first man at 1.6-2.8 m
 * are counted.
 * Clipped = the first man takes it.
 */
export function overMate(kind: "shot" | "pass", n: number): OverMate {
  let clipped = 0, trials = 0, asPass = 0;
  const mk = (x: number, y: number, role: "target" | "support"): Runner => ({ pos: { x, y }, to: { x, y }, speed: 7, moving: false, role });
  for (let i = 0; trials < n && i < n * 20; i++) {
    const r0 = mulberry32(9000 + i);
    const y0 = kind === "shot" ? 24 : 32, dist = 4 + r0() * 8;
    const { sc, ball, rng } = emptyScene(5000 + i, y0);
    const off = (r0() - 0.5) * 2;
    const near = mk(CX + off, y0 - dist, "support");
    if (kind === "shot") {
      sc.secondaryRunners = [near];
      aim(ball, y0, y0 - dist, 1.6 + r0() * 1.2, 22);
    } else {
      const far = mk(CX + (r0() - 0.5) * 2, y0 - dist - 10, "target");
      sc.runner = far;
      sc.secondaryRunners = [near];
      const dx = far.pos.x - CX, dy = far.pos.y - y0, d = Math.hypot(dx, dy);
      const s = 11 + r0() * 6, t = d / s;
      ball.z = 0.11;
      ball.vz = (1.2 - 0.11 + 0.5 * G * t * t) / t;
      ball.vel = { x: dx / d * s, y: dy / d * s };
      // its height as it passes the first man
      const tn = (near.pos.y - y0) / ball.vel.y;
      const zn = ball.z + ball.vz * tn - 0.5 * G * tn * tn;
      if (zn < 1.6 || zn > 2.8) continue;
    }
    sc.receiverDone = false;
    { const tl = (ball.vz + Math.sqrt(ball.vz * ball.vz + 2 * G * ball.z)) / G; ball.landAt = { x: ball.pos.x + ball.vel.x * tl, y: ball.pos.y + ball.vel.y * tl }; }
    ball.shot = isDriveAtGoal(ball, sc);
    ball.youStruckAtGoal = ball.shot;
    if (!ball.shot) asPass++;
    trials++;
    for (let k = 0; k < 400; k++) {
      stepReactions(sc, ball, DT, rng);
      const res = stepBall(ball, sc, rng, DT);
      if (sc.receivedBy === near) { clipped++; break; }
      if (res || sc.receiverDone || ball.pos.y < near.pos.y - 3) break;
    }
  }
  return { trials, clipped, asPass };
}

export interface CrossRow { kind: ScenarioKind; n: number; reached: number; cutOut: number; goals: number; headers: number }

/** Crosses to the runner, delivered the way finishing.mts delivers them. */
export function crosses(kind: ScenarioKind, n: number): CrossRow {
  const row: CrossRow = { kind, n: 0, reached: 0, cutOut: 0, goals: 0, headers: 0 };
  for (let seed = 0; seed < n; seed++) {
    const rng = mulberry32(seed * 1013 + kind.length * 7919 + 17);
    const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
    initDefenders(sc, rng);
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
    if (!t) continue;
    const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
    const ball = launch(sc,
      { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
      Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
      { cx: (rng() - 0.5) * 0.6, cy: -0.2 - rng() * 0.6 },
      { power: 60, technique: 60 }, rng);
    row.n++;
    let res: Outcome | null = null;
    let reachedAtZ = -1;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      const was = sc.receiverReached;
      const z = ball.z;
      res = stepBall(ball, sc, rng, DT);
      if (!was && sc.receiverReached) reachedAtZ = z;
    }
    if (sc.receiverReached) { row.reached++; if (reachedAtZ > 1.3) row.headers++; }
    else if (res === "tackled" || res === "blocked") row.cutOut++;
    if (res === "goal" || res === "rebound") row.goals++;
  }
  return row;
}

export interface HeaderRow { n: number; reached: number; goals: number; jumped: number; byBand: Record<string, { n: number; reached: number; goals: number }> }

/**
 * A cross played onto a team-mate's head: byline_cross and corner chances,
 * the ball aimed to arrive at the runner at 1.4-2.8 m (16 m/s). How often he
 * gets it, and scores, by arrival height.
 */
export function headers(n: number, log?: (seed: number, res: string, reached: boolean, z: number) => void): HeaderRow {
  const row: HeaderRow = { n: 0, reached: 0, goals: 0, jumped: 0, byBand: {} };
  for (let seed = 0; seed < n; seed++) {
    const kind: ScenarioKind = seed % 2 ? "corner" : "byline_cross";
    const rng = mulberry32(seed * 3301 + 99);
    const sc = buildScenario(kind, rng, 60, 60, 60);
    initDefenders(sc, rng);
    const r = sc.runner ?? sc.secondaryRunners[0];
    if (!r) continue;
    const H = 1.4 + rng() * 1.4;
    const ball = launch(sc, { x: r.pos.x - sc.ball.x, y: r.pos.y - sc.ball.y }, 0.6, { cx: 0, cy: -0.3 }, { power: 65, technique: 65 }, rng);
    const dx = r.pos.x - sc.ball.x, dy = r.pos.y - sc.ball.y, d = Math.hypot(dx, dy);
    const s = 16, t = d / s;
    ball.pos = { x: sc.ball.x, y: sc.ball.y }; ball.z = 0.11; ball.spin = 0; ball.topspin = 0;
    ball.vel = { x: dx / d * s, y: dy / d * s };
    ball.vz = (H - 0.11 + 0.5 * G * t * t) / t;
    { const tl = (ball.vz + Math.sqrt(ball.vz * ball.vz + 2 * G * ball.z)) / G; ball.landAt = { x: ball.pos.x + ball.vel.x * tl, y: ball.pos.y + ball.vel.y * tl }; }
    ball.shot = isDriveAtGoal(ball, sc);
    const band = H < 1.8 ? "1.4-1.8" : H < 2.2 ? "1.8-2.2" : H < 2.5 ? "2.2-2.5" : "2.5-2.8";
    const b = (row.byBand[band] ??= { n: 0, reached: 0, goals: 0 });
    row.n++; b.n++;
    let res: Outcome | null = null;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      const was = sc.receiverReached, z = ball.z;
      res = stepBall(ball, sc, rng, DT);
      // Taken in the air, above a standing man's head: only a jump reaches that.
      if (!was && sc.receiverReached && z > 1.96 && (sc.receivedBy?.jump?.z ?? 0) > 0.05) row.jumped++;
    }
    if (sc.receiverReached) { row.reached++; b.reached++; }
    if (res === "goal" || res === "rebound") { row.goals++; b.goals++; }
    log?.(seed, String(res), !!sc.receiverReached, H);
  }
  return row;
}

export interface BlockRow { kind: ScenarioKind; n: number; blocked: number; goals: number }

/** Shots at goal through whatever defence the chance was built with. */
export function blocks(kind: ScenarioKind, n: number, lift: number): BlockRow {
  const row: BlockRow = { kind, n: 0, blocked: 0, goals: 0 };
  for (let seed = 0; seed < n; seed++) {
    const rng = mulberry32(seed * 7717 + kind.length * 31 + Math.round(lift * 100));
    const sc = buildScenario(kind, rng, 60, 60, 60);
    initDefenders(sc, rng);
    const gx = CX + (rng() - 0.5) * 6;
    const ball = launch(sc, { x: gx - sc.ball.x, y: -sc.ball.y }, 0.75 + rng() * 0.2,
      { cx: (rng() - 0.5) * 0.3, cy: lift }, { power: 70, technique: 70 }, rng);
    row.n++;
    let res: Outcome | null = null;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      res = stepBall(ball, sc, rng, DT);
    }
    if (res === "blocked") row.blocked++;
    if (res === "goal" || res === "rebound") row.goals++;
  }
  return row;
}

/** The lowest height a ball can pass over a keeper standing `off` m off his line. */
export function keeperClearance(off: number, strength: number): number {
  const y0 = 20;
  for (let h = 1.5; h <= 4.5; h += 0.05) {
    let saved = 0;
    const zs: number[] = [];
    for (let s = 0; s < 40; s++) {
      const { sc, ball, rng } = emptyScene(777 + s, y0);
      sc.keeper.y = off; sc.keeper.x = CX; sc.keeper.targetX = CX;
      (sc as { keeperStrength?: number }).keeperStrength = strength;
      sc.receiverDone = true;
      aim(ball, y0, off, h, 14);
      ball.shot = true;
      let res: Outcome | null = null;
      for (let i = 0; i < 400 && !res; i++) {
        const py = ball.pos.y, pz = ball.z;
        res = stepBall(ball, sc, rng, DT);
        if (py > off && ball.pos.y <= off) zs.push(pz + (ball.z - pz) * ((py - off) / (py - ball.pos.y || 1)));
        if (ball.pos.y < off - 1) break;
      }
      if (sc.keeper.done || res === "caught" || res === "saved" || ball.lastTouch === "keeper") saved++;
    }
    if (saved <= 20) return Math.round((zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length)) * 100) / 100;
  }
  return 9;
}

/**
 * Every outcome and where the ball and every body finished, over 1,200
 * seeded crosses and shots, hashed. With the hitbox switch Old the engine
 * must give exactly the hash it gave before the switch existed.
 */
export function hitboxFingerprint(): string {
  let h = 2166136261 >>> 0;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const kind of ["byline_cross", "corner", "long_range", "cutback", "through_ball", "midfield_pass"] as ScenarioKind[]) {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed * 4241 + kind.length * 131);
      const sc = buildScenario(kind, rng, 60, 60, 60);
      initDefenders(sc, rng);
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos ?? { x: CX, y: 0 };
      const toGoal = seed % 2 === 0;
      const tx = toGoal ? CX + (rng() - 0.5) * 6 : t.x, ty = toGoal ? 0 : t.y;
      const d = Math.hypot(tx - sc.ball.x, ty - sc.ball.y);
      const ball = launch(sc, { x: tx - sc.ball.x, y: ty - sc.ball.y },
        Math.min(0.95, 0.25 + d / 30), { cx: (rng() - 0.5) * 0.5, cy: -rng() * 0.7 }, { power: 65, technique: 65 }, rng);
      let res: Outcome | null = null, i = 0;
      for (; i < 2000 && !res; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        res = stepBall(ball, sc, rng, DT);
      }
      mix(`${kind}|${seed}|${res}|${i}|${!!sc.receiverReached}|${ball.pos.x.toFixed(5)},${ball.pos.y.toFixed(5)},${ball.z.toFixed(5)}|`
        + sc.defenders.map((q) => `${q.x.toFixed(4)},${q.y.toFixed(4)},${(q.z ?? 0).toFixed(4)}`).join(";"));
    }
  }
  return h.toString(16);
}
