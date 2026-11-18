/**
 * ONE CHANCE, PLAYED BY THE SHARED RULES (lib/star/canvasEngine.ts).
 *
 * The same calls in the same order as the website's match and the tests
 * (tests/star/finishing.mts): build the chance, place the defence, launch the
 * kick, then step defenders, keeper, reactions and ball every 1/60 s. Nothing
 * here decides an outcome; the engine does. Only the screen side is the phone's.
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, dragForFullPower,
  type Scenario, type Ball, type Outcome, type ScenarioKind, type Contact,
} from "@/lib/star/canvasEngine";

export const DT = 1 / 60;

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Skills { power: number; technique: number; vision: number }

export interface Chance {
  sc: Scenario;
  rng: () => number;
  ball: Ball | null;
  outcome: Outcome | null;
  steps: number;
}

export function newChance(kind: ScenarioKind, seed: number, s: Skills): Chance {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, s.power, s.technique, s.vision);
  initDefenders(sc, rng);
  return { sc, rng, ball: null, outcome: null, steps: 0 };
}

/** Kick: dir in pitch metres, power 0..1, contact on the ball (centre = 0,0). */
export function kick(ch: Chance, dir: { x: number; y: number }, power: number, contact: Contact, s: Skills) {
  ch.ball = launch(ch.sc, dir, power, contact, { power: s.power, technique: s.technique }, ch.rng);
}

/**
 * One 1/60 s frame of everything, in the engine's order: like the website's
 * match, three 1/180 s steps a frame (CanvasMatch's frame loop). The real
 * match uses src/match/driver.ts; this one-chance helper is for the tools.
 */
export function step(ch: Chance): Outcome | null {
  const { sc, ball, rng } = ch;
  if (!ball || ch.outcome) return ch.outcome;
  for (let i = 0; i < 3 && !ch.outcome; i++) {
    const h = DT / 3;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    ch.outcome = stepBall(ball, sc, rng, h);
  }
  ch.steps++;
  if (!ch.outcome && ch.steps > 2500) ch.outcome = "saved" as Outcome;
  return ch.outcome;
}

/**
 * Drag to power, as the website measures it: the pull as a share of the
 * classic 5:8 canvas height this width would have, over the player's
 * full-power drag (dragForFullPower).
 */
export function powerFromPull(pullPx: number, widthPx: number, powerSkill: number) {
  const refH = widthPx * 8 / 5;
  return Math.max(0, Math.min(1, (pullPx / refH) / dragForFullPower(powerSkill)));
}
