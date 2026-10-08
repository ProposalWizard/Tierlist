/**
 * PLAY3D TOUCHES — everything a man can do to the ball, as pure functions:
 * strike (the 2D match's launch maths), shoot from a drag, pass, first touch,
 * dribble touch, keepy-up touch, header/volley, tackle, a keeper's throw.
 *
 * Every one reads the man's own skills, so an 85 is visibly cleaner than a
 * 55 doing the same thing, and every one rolls its luck on the World's
 * seeded rng.
 */
import { BALL_R, G, GROUND_FRICTION, AIR_DRAG, MIN_POWER, MIN_PULL, clamp, powerFromPull, skill01, strikeNumbers, type Contact3 } from "./constants";
import type { Ball3 } from "./ball";
import type { P3 } from "./player";
import { gauss, type Rng } from "./rng";

const rot = (x: number, y: number, deg: number) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};
const unit = (x: number, y: number) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };

/** Put the ball on a man's foot (where a touch leaves it). */
export function ballAtFeet(b: Ball3, p: P3, ahead = 0.45) {
  b.x = p.x + Math.cos(p.facing) * ahead;
  b.y = p.y + Math.sin(p.facing) * ahead;
  b.z = BALL_R;
  b.vz = 0; b.spin = 0; b.topspin = 0;
}

/**
 * A strike, as the 2D match's launch() builds it: power 0-1, a contact point,
 * the man's power and technique. Returns the aim error rolled (degrees).
 */
export function strikeBall(b: Ball3, p: P3, dir: { x: number; y: number }, power: number, contact: Contact3, rng: Rng): number {
  const n = strikeNumbers(power, contact, p.skills.power, p.skills.technique);
  const noise = gauss(rng) * n.sigmaDeg;
  const d = rot(unit(dir.x, dir.y).x, unit(dir.x, dir.y).y, noise);
  b.vx = d.x * n.Sh; b.vy = d.y * n.Sh; b.vz = n.vz;
  b.spin = n.spin; b.topspin = n.topspin;
  b.z = Math.max(b.z, BALL_R + 0.01);
  b.inNet = false;
  p.act = "shot"; p.actT = 0; p.cooldown = 0.35;
  return noise;
}

/**
 * YOUR SHOT FROM A DRAG — the 2D game's gesture: `pull` is how far the thumb
 * travelled as a fraction of the real match's canvas height (kickInput.ts
 * screenPull), so the same finger movement is the same power. null when the
 * 2D game would not count it as a kick (the same two floors).
 */
export function shootFromPull(b: Ball3, p: P3, dir: { x: number; y: number }, pull: number, contact: Contact3, rng: Rng): { power: number } | null {
  if (pull < MIN_PULL) return null;
  const power = powerFromPull(pull, p.skills.power);
  if (power < MIN_POWER) return null;
  strikeBall(b, p, dir, power, contact, rng);
  return { power };
}

/** The pace a ground pass leaves the foot at, to arrive `d` metres away still rolling at `arrive` m/s. */
export function groundPassSpeed(d: number, arrive = 4.5): number {
  return Math.sqrt(arrive * arrive + 2 * GROUND_FRICTION * d);
}

/**
 * A pass to a point: along the grass, or lofted to drop on it. Error grows
 * as passing falls: the angle and the weight both wander.
 */
export function passTo(b: Ball3, p: P3, tx: number, ty: number, lofted: boolean, rng: Rng) {
  const sk = skill01(p.skills.passing ?? p.skills.technique);
  const dx = tx - b.x, dy = ty - b.y;
  const d = Math.max(0.5, Math.hypot(dx, dy));
  const ang = gauss(rng) * (1 + (1 - sk) * 7);
  const len = 1 + gauss(rng) * (0.03 + (1 - sk) * 0.12);
  const u = rot(dx / d, dy / d, ang);
  if (!lofted) {
    const s = groundPassSpeed(d * len);
    b.vx = u.x * s; b.vy = u.y * s; b.vz = 0; b.z = BALL_R;
    b.spin = 0; b.topspin = 0.3;
  } else {
    const T = 0.7 + d * 0.045;
    const k = 1 - AIR_DRAG * T / 2;
    const s = d * len / T / k;
    b.vx = u.x * s; b.vy = u.y * s;
    b.vz = (G * T) / 2 - (b.z - BALL_R) / T;
    b.z = Math.max(b.z, BALL_R + 0.01);
    b.spin = 0; b.topspin = -0.4;
  }
  b.inNet = false;
  p.act = lofted ? "loft" : "pass"; p.actT = 0; p.cooldown = 0.35;
}

export type BodyPart = "foot" | "thigh" | "chest" | "head";
export function partFor(z: number): BodyPart {
  return z < 0.6 ? "foot" : z < 1.0 ? "thigh" : z < 1.55 ? "chest" : "head";
}
const PART_HARD: Record<BodyPart, number> = { foot: 0, thigh: 0.12, chest: 0.22, head: 0.4 };

/**
 * FIRST TOUCH: a ball arriving at foot, thigh, chest or head. Faster and
 * higher is harder; technique makes it cleaner. Clean: dead at his feet,
 * a step ahead the way he faces. Not clean: it bounces off him, loose.
 */
export function firstTouch(b: Ball3, p: P3, rng: Rng): { clean: boolean; part: BodyPart } {
  const part = partFor(b.z);
  const rel = Math.hypot(b.vx - p.vx, b.vy - p.vy, b.vz);
  const tech = skill01(p.skills.technique);
  const hard = rel / (11 + tech * 14) + PART_HARD[part];
  const pClean = clamp(1.18 - hard, 0.08, 0.98);
  const clean = rng() < pClean;
  p.act = part === "head" ? "header" : "touch"; p.actT = 0; p.cooldown = 0.18;
  if (clean) {
    ballAtFeet(b, p, 0.5);
    b.vx = p.vx + Math.cos(p.facing) * 0.6; b.vy = p.vy + Math.sin(p.facing) * 0.6;
  } else {
    // off him: back the way it came, slowed, a bit sideways
    const a = (rng() - 0.5) * 2.4;
    const back = rot(-b.vx, -b.vy, a * 57.3);
    const s = clamp(rel * (0.25 + rng() * 0.25), 1.5, 9);
    const u = unit(back.x, back.y);
    b.vx = u.x * s; b.vy = u.y * s; b.vz = part === "foot" ? 0.5 : 1.5 + rng() * 1.5;
    b.spin = 0;
  }
  return { clean, part };
}

/**
 * DRIBBLE TOUCH: a man running with the ball knocks it on ahead of himself.
 * The faster he goes, the further he has to knock it; a touch longer than he
 * can control (his dribbling sets how far that is) is a heavy touch, and the
 * ball is loose.
 */
export function dribbleTouchLength(speed: number): number { return 0.45 + 0.17 * speed; }
export function maxControlLength(dribbling: number): number { return 1.5 + skill01(dribbling) * 1.5; }

export function dribbleTouch(b: Ball3, p: P3, dir: { x: number; y: number }, rng: Rng): { lost: boolean; len: number } {
  const sp = Math.hypot(p.vx, p.vy);
  const drib = p.skills.dribbling ?? p.skills.technique;
  let len = dribbleTouchLength(sp) * (1 + gauss(rng) * (0.04 + (1 - skill01(drib)) * 0.18));
  const lost = len > maxControlLength(drib);
  if (lost) len *= 1.6;
  // gap(t) = u t − f t²/2 peaks at u²/2f: knock it on fast enough to open `len` metres
  const u = Math.sqrt(2 * GROUND_FRICTION * Math.max(0.05, len));
  const d = unit(dir.x, dir.y);
  ballAtFeet(b, p, 0.4);
  b.x = p.x + d.x * 0.4; b.y = p.y + d.y * 0.4;
  b.vx = d.x * (sp + u); b.vy = d.y * (sp + u); b.vz = 0;
  p.act = "touch"; p.actT = 0;
  return { lost, len };
}

/**
 * KEEPY-UP TOUCH (foot, thigh or head, by how high the ball is): `tErr` is
 * how early (−) or late (+) the touch is against the perfect moment, in
 * seconds. Technique widens the window. Inside it the ball goes up and over
 * to `aim` (a point and the height it should top out at); the further from
 * perfect, the further off it lands. Outside it the touch is a scuff.
 */
export function juggleWindow(technique: number): number { return 0.07 + skill01(technique) * 0.09; }

export function juggleTouch(
  b: Ball3, p: P3, tErr: number, aim: { x: number; y: number; apex: number }, rng: Rng,
): { clean: boolean; part: BodyPart; q: number } {
  const part = partFor(b.z);
  const tech = skill01(p.skills.technique);
  const q = Math.abs(tErr) / juggleWindow(p.skills.technique);
  p.act = part === "head" ? "juggle-head" : part === "thigh" ? "juggle-thigh" : "juggle-foot";
  p.actT = 0; p.cooldown = 0.2;
  b.spin = 0; b.topspin = 0;
  if (q > 1) {
    // a scuff: off the side of the foot, low and away
    const a = rng() * Math.PI * 2;
    const s = 2 + rng() * 3;
    b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.vz = 1 + rng() * 2;
    return { clean: false, part, q };
  }
  const dx = aim.x - b.x, dy = aim.y - b.y, d = Math.hypot(dx, dy);
  const apex = Math.max(b.z + 0.3, aim.apex);
  const vz = Math.sqrt(2 * G * (apex - b.z));
  const down = Math.sqrt(2 * (apex - 0.6) / G);
  const T = vz / G + down;
  const ang = gauss(rng) * (q * 9 + (1 - tech) * 5);
  const len = 1 + gauss(rng) * (q * 0.12 + (1 - tech) * 0.08);
  const u = d > 0.01 ? rot(dx / d, dy / d, ang) : { x: 0, y: 0 };
  const s = d * len / T / (1 - AIR_DRAG * T / 2);
  b.vx = u.x * s; b.vy = u.y * s; b.vz = vz;
  b.z = Math.max(b.z, BALL_R + 0.02);
  return { clean: true, part, q };
}

/**
 * HEADER / VOLLEY: a ball in the air within reach, struck at a target point
 * (x, y, z). A header is slower and gentler; a volley is a full strike with
 * more power and more chance to fly off. Returns the aim error rolled.
 */
export function airStrike(b: Ball3, p: P3, kind: "header" | "volley", target: { x: number; y: number; z: number }, rng: Rng): number {
  const tech = skill01(p.skills.technique), pow = skill01(p.skills.power);
  const fin = skill01(p.skills.shooting ?? p.skills.overall);
  const incoming = Math.hypot(b.vx, b.vy, b.vz);
  const speed = kind === "header" ? 9 + pow * 6 + incoming * 0.25 : 17 + pow * 11;
  const sigma = kind === "header" ? 2.5 + (1 - fin) * 6 + incoming * 0.08 : 2 + (1 - tech) * 9 + incoming * 0.1;
  const dx = target.x - b.x, dy = target.y - b.y, d = Math.max(0.5, Math.hypot(dx, dy));
  const ang = gauss(rng) * sigma;
  const u = rot(dx / d, dy / d, ang);
  const T = d / speed;
  const zErr = gauss(rng) * sigma * 0.02 * d;
  b.vx = u.x * speed; b.vy = u.y * speed;
  b.vz = (target.z + zErr - b.z) / T + 0.5 * G * T;
  b.spin = 0; b.topspin = kind === "volley" ? 0.4 : 0;
  b.inNet = false;
  p.act = kind; p.actT = 0; p.cooldown = 0.35;
  return ang;
}

/**
 * A DELIVERY (a cross, a set ball) that reaches the point `to` at height
 * `to.z` after `T` seconds, struck by `p`. His passing (else technique) sets
 * how far off it actually goes: the point wanders by up to a couple of metres
 * for a poor crosser, the height by a few tens of centimetres. Air drag is
 * allowed for. Returns where it was really sent (the target after the error).
 * A ball arriving on the grass (to.z ≈ BALL_R, `ground`) is a driven low cross.
 */
export function crossTo(
  b: Ball3, p: P3, to: { x: number; y: number; z: number }, T: number, rng: Rng, ground = false,
): { x: number; y: number; z: number } {
  const sk = skill01(p.skills.passing ?? p.skills.technique);
  const spread = 0.35 + (1 - sk) * 2.2;
  const tx = to.x + gauss(rng) * spread, ty = to.y + gauss(rng) * spread * 0.8;
  const tz = ground ? BALL_R : Math.max(BALL_R + 0.1, to.z + gauss(rng) * (0.08 + (1 - sk) * 0.3));
  const dx = tx - b.x, dy = ty - b.y, d = Math.max(0.5, Math.hypot(dx, dy));
  if (ground) {
    // along the grass: fast enough to still be going at `arrive` when it gets there
    const s = d / T + GROUND_FRICTION * T / 2;
    b.vx = dx / d * s; b.vy = dy / d * s; b.vz = 0; b.z = BALL_R;
    b.spin = 0; b.topspin = 0.4;
  } else {
    const k = 1 - AIR_DRAG * T / 2;
    const s = d / T / k;
    b.vx = dx / d * s; b.vy = dy / d * s;
    b.vz = (tz - b.z) / T + 0.5 * G * T;
    b.z = Math.max(b.z, BALL_R + 0.01);
    b.spin = 0; b.topspin = -0.3;
  }
  b.inNet = false;
  p.act = ground ? "pass" : "loft"; p.actT = 0; p.cooldown = 0.6;
  return { x: tx, y: ty, z: tz };
}

/**
 * A TACKLE / POKE on a man with the ball. His dribbling against the
 * tackler's defending. Won: the ball is knocked loose, away from the
 * dribbler, and he stumbles. Lost: the tackler is left on the floor a moment.
 */
export function tackleChance(tackler: P3, dribbler: P3): number {
  const def = skill01(tackler.skills.defending ?? tackler.skills.overall);
  const drib = skill01(dribbler.skills.dribbling ?? dribbler.skills.technique);
  return clamp(0.38 + (def - drib) * 0.9, 0.08, 0.85);
}

export function tackle(b: Ball3, tackler: P3, dribbler: P3, rng: Rng): boolean {
  const won = rng() < tackleChance(tackler, dribbler);
  tackler.act = "tackle"; tackler.actT = 0;
  if (won) {
    const away = unit(b.x - tackler.x, b.y - tackler.y);
    const side = rot(away.x, away.y, (rng() - 0.5) * 90);
    const s = 3 + rng() * 4;
    b.vx = side.x * s; b.vy = side.y * s; b.vz = rng() * 1.5;
    dribbler.cooldown = 0.6;
    tackler.cooldown = 0.25;
  } else {
    tackler.cooldown = 0.9;
  }
  return won;
}

/** A keeper throwing (or rolling) it out to a point. */
export function throwOut(b: Ball3, k: P3, tx: number, ty: number, rng: Rng) {
  b.x = k.x + Math.cos(k.facing) * 0.4; b.y = k.y + Math.sin(k.facing) * 0.4; b.z = 1.5;
  const dx = tx - b.x, dy = ty - b.y, d = Math.max(1, Math.hypot(dx, dy));
  const T = 0.6 + d * 0.04;
  const u = rot(dx / d, dy / d, gauss(rng) * 3);
  const s = d / T / (1 - AIR_DRAG * T / 2);
  b.vx = u.x * s; b.vy = u.y * s;
  b.vz = (BALL_R - b.z) / T + 0.5 * G * T;
  b.spin = 0; b.topspin = 0; b.inNet = false;
  k.act = "throw"; k.actT = 0; k.cooldown = 0.6;
}
