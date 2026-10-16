/**
 * THE SHOT LAB — the player's own shot, struck the way a person strikes it.
 *
 * Shared by tests/star/shotsPro.mts and the measuring scripts in
 * docs/gameplay15/shots.md. Not a test on its own.
 *
 * The match's own order (CanvasMatch): a served chance (makeChance) →
 * initDefenders → keeper brain set-up and his walk while you aim → the drag →
 * the tap on the ball → launch → brainStrike → strikeKind → flight at
 * 1/180 s (stepDefenders, stepKeeper, stepReactions, stepKind, brainStep,
 * stepBall).
 *
 * The thumb is a "human-like bot", not a perfect aimer:
 *  - it aims at a corner (mostly the one the keeper is further from), a little
 *    inside the post;
 *  - the drag is off the line it meant by a normal error (sd AIM_SD_DEG),
 *    about 3 px of a phone-sized drag;
 *  - most pulls are hard, some are medium;
 *  - the tap on the ball lands round the spot it meant (sd TAP_SD radii);
 *  - it means one of: a low drive (top half), a placed shot (middle) or a
 *    curler (the side, aimed at the post, bending back in).
 */
import * as E from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind } from "../../lib/star/kindRules";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";
import * as B from "../../lib/star/keeperBrain";
import { setPieceSkills } from "../../lib/star/setPieces";
import { strikingPower } from "../../lib/star/strikePower";
import { launchShot, stepKnuckle, shotSeedFor, type ContactRead } from "../../lib/star/shotModel";

export const H = 1 / 180;
export const AIM_SD_DEG = 2.5;
export const TAP_SD = 0.2;

export type Intent = "drive" | "placed" | "curler" | "chip";
export interface Thumb {
  /** Degrees off the line it meant (signed). */
  aimErrDeg: number;
  power: number;
  contact: E.Contact;
  intent: Intent;
  /** The x on the goal line it meant to put it. */
  targetX: number;
  /** Where it pointed the arrow (wide of the target for a curler). */
  aimX: number;
}

function gauss(r: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** What a person does with this chance. `perfect` drops all the errors. */
/** The strike screen's ball moves for some chances (CanvasMatch contactMotion):
 *  a thumb lands less precisely on a moving ball. */
export function tapSdFor(kind: E.ScenarioKind, seed: number): number {
  if (kind === "header" || kind === "volley") return 0.33;
  if (kind === "one_on_one" || kind === "tight_angle" || kind === "long_range") {
    return ((Math.imul(seed, 2654435761) >>> 0) % 100) < 35 ? 0.25 : TAP_SD;
  }
  return TAP_SD;
}

export function humanThumb(sc: E.Scenario, r: () => number, perfect = false, tapSd = TAP_SD): Thumb {
  const k = sc.keeper;
  const farSide = k.x < CX ? 1 : -1;
  const side = r() < 0.75 ? farSide : -farSide;
  const roll = r();
  const intent: Intent = roll < 0.4 ? "drive" : roll < 0.72 ? "placed" : roll < 0.95 ? "curler" : "chip";
  // Where it should end up: inside the post by 0.35–0.95 m.
  const inset = 0.35 + r() * 0.6;
  const targetX = side > 0 ? POST_R - inset : POST_L + inset;
  const meant: E.Contact = intent === "drive" ? { cx: 0, cy: -0.4 }
    : intent === "placed" ? { cx: 0, cy: 0.1 }
    : intent === "curler" ? { cx: side * 0.45, cy: 0.25 }
    : { cx: 0, cy: 0.9 };
  const hard = r() < 0.6;
  const power = intent === "chip" ? 0.35 + r() * 0.2 : hard ? 0.88 + r() * 0.12 : 0.55 + r() * 0.33;
  // A curler is aimed wide of where it should finish, by the bend he expects
  // (a person's guess: 70–130% of the real bend for that strike).
  let aimX = targetX;
  if (intent === "curler") {
    const v = power * 29.7, dist = Math.hypot(targetX - sc.ball.x, sc.ball.y), t = dist / Math.max(1, v);
    const a = Math.abs(meant.cx) * 0.8 * 1.85 * power * 0.48 * v;
    aimX = targetX + side * 0.5 * a * t * t * (perfect ? 1 : 0.7 + r() * 0.6);
  }
  if (perfect) return { aimErrDeg: 0, power, contact: meant, intent, targetX, aimX };
  let cx = meant.cx + gauss(r) * tapSd, cy = meant.cy + gauss(r) * tapSd;
  const d = Math.hypot(cx, cy);
  if (d > 1) { cx /= d; cy /= d; }
  return { aimErrDeg: gauss(r) * AIM_SD_DEG, power, contact: { cx, cy }, intent, targetX, aimX };
}

export function rotate(v: E.Vec2, deg: number): E.Vec2 {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export interface ShotResult {
  kind: E.ScenarioKind;
  out: E.Outcome | null;
  goal: boolean;
  /** Reached the keeper (saved/caught) or scored. */
  onTarget: boolean;
  blocked: boolean;
  /** Where the arrow's line crosses the goal line, and where the ball did (clean flight). */
  arrowX: number;
  ballX: number | null;
  ballZ: number | null;
  speedAtLine: number | null;
  thumb: Thumb;
  read?: ContactRead;
  /** The keeper's first touch on it (catch / parry / push / fumble), if any. */
  save?: E.SaveResult;
  /** Metres from the goal centre at the strike. */
  dist?: number;
}

export interface LabOptions {
  keeper?: number;
  skills?: E.KickSkills;
  perfect?: boolean;
  /** Called with the ball just after launch — the place a new strike rule hooks in. */
  afterLaunch?: (ball: E.Ball, sc: E.Scenario, thumb: Thumb, rng: () => number) => void;
  /** The Shots model (null = plain launch, today's game). */
  model?: { pro: boolean; knuckle: boolean } | null;
  /** The stat the ball is struck with (default: the v0.15 knee, strikingPower). */
  strikePower?: (stat: number) => number;
  /** Contact field on (shotFeel.ts). */
  field?: boolean;
  /** Shot power's rise share for this real stat (shotFeel.ts feelLift). */
  lift?: (stat: number) => number;
  /** Shoot THIS served chance (a copy of it) instead of making one of `kind`. */
  scenario?: E.Scenario;
}

/** Where a struck ball crosses y = 0 with nobody in the way: the real
 *  engine, on a copy of the chance with the defence, keeper and team-mates
 *  taken off the pitch. */
export function cleanCrossing(sc0: E.Scenario, ball0: E.Ball): { x: number; z: number; speed: number } | null {
  const sc: E.Scenario = JSON.parse(JSON.stringify(sc0));
  const ball: E.Ball = JSON.parse(JSON.stringify(ball0));
  sc.defenders = []; sc.teammates = []; sc.runner = null; sc.secondaryRunners = [];
  sc.follower = { ...sc.follower, x: -150, y: 300 };
  sc.keeper.x = -60; sc.keeper.startX = -60; sc.keeper.targetX = -60; sc.keeper.done = true;
  const r = mulberry32(1);
  for (let i = 0; i < 180 * 5; i++) {
    const px = ball.pos.x, py = ball.pos.y, pz = ball.z;
    const sp = Math.hypot(ball.vel.x, ball.vel.y);
    const out = E.stepBall(ball, sc, r, H);
    if (py > 0 && ball.pos.y <= 0) {
      const f = py / Math.max(1e-6, py - ball.pos.y);
      return { x: px + (ball.pos.x - px) * f, z: pz + (ball.z - pz) * f, speed: sp };
    }
    if (out) return null;
  }
  return null;
}

export function shoot(kind: E.ScenarioKind, seed: number, o: LabOptions = {}): ShotResult {
  const ks = o.keeper ?? 62;
  const rng = mulberry32(seed);
  const sc = o.scenario ? structuredClone(o.scenario)
    : makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null }).sc;
  E.initDefenders(sc, rng);
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { openPlay: 0.55 });
  const aimR = mulberry32((seed ^ 0xa11ce) >>> 0);
  // The aim takes a second or two; the keeper gets set meanwhile.
  const aimT = 1 + aimR() * 1.5;
  for (let t = 0; t < aimT; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const thumb = humanThumb(sc, aimR, o.perfect, tapSdFor(kind, seed));
  const dx = thumb.aimX - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const dir = rotate({ x: dx / L, y: dy / L }, thumb.aimErrDeg);
  const arrowX = sc.ball.x + dir.x * (sc.ball.y / -dir.y);
  const base = o.skills ?? { power: 65, technique: 65 };
  const withSet = setPieceSkills(base, base.technique, kind);
  const curve = o.strikePower ?? strikingPower;
  const skills = { ...withSet, power: curve(withSet.power) };
  let read: ContactRead | undefined;
  let ball: E.Ball;
  let model: { pro: boolean; knuckle: boolean; field?: boolean; lift?: number } | null | undefined = o.model;
  if (o.field || o.lift) {
    model = { ...(o.model ?? { pro: false, knuckle: false }), field: !!o.field, lift: o.lift ? o.lift(withSet.power) : 1 };
  }
  if (model) {
    const st = launchShot(sc, dir, thumb.power, thumb.contact, skills, rng, { seed: shotSeedFor(seed, 0) }, model, E.launch);
    ball = st.ball; read = st.read;
  } else ball = E.launch(sc, dir, thumb.power, thumb.contact, skills, rng);
  o.afterLaunch?.(ball, sc, thumb, rng);
  const clean = cleanCrossing(sc, ball);
  B.brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: skills.power, technique: skills.technique });
  let out: E.Outcome | null = null;
  for (let i = 0; i < 180 * 6 && !out; i++) {
    E.stepDefenders(sc, H, ball.pos, false, ball);
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rng);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    stepKnuckle(ball, H);
    out = E.stepBall(ball, sc, rng, H);
  }
  const goal = out === "goal" || out === "rebound";
  return {
    kind, out, goal,
    onTarget: goal || sc.keeper.saves > 0 || out === "saved" || out === "caught",
    blocked: out === "blocked" || out === "tackled",
    arrowX, ballX: clean?.x ?? null, ballZ: clean?.z ?? null, speedAtLine: clean?.speed ?? null,
    thumb, read, dist: Math.hypot(sc.ball.x - CX, sc.ball.y),
    save: (ball.actionLog ?? []).find((a) => a.kind === "save" && a.save && a.save !== "beaten")?.save,
  };
}

export function inFrame(x: number | null, z: number | null): boolean {
  return x !== null && z !== null && x > POST_L && x < POST_R && z < GOAL_H;
}

export const SHOOTING_KINDS: E.ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "volley", "header", "penalty", "free_kick"];
