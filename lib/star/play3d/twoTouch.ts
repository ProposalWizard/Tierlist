/**
 * TWO TOUCH — you and one team-mate keep the ball up between you. Two
 * touches each at most: one to control it up to yourself, one to send it
 * back in the air (or just one: send it straight back). The ball touching
 * the grass, or a third touch, ends the rally. Three rallies; your score is
 * the longest (passes across).
 *
 * The touch is a timing tap (actions.ts juggleTouch): the perfect moment is
 * when the dropping ball reaches your foot; technique widens the window.
 * His touches use the same function, with his timing error set by his real
 * overall.
 */
import { BALL_R, CX, G, clamp, skill01 } from "./constants";
import { juggleTouch, juggleWindow } from "./actions";
import { makePlayer, stepMover, towards, type P3 } from "./player";
import { gauss } from "./rng";
import { World, type Rules } from "./world";
import { gameReward } from "../relationships";
import type { Person3 } from "./freeRoam";

export const TWO_TOUCH_RALLIES = 3;
/** The longest rally that counts as a good session (wins the Team bar). Reasoned. */
export const TWO_TOUCH_TARGET = 6;
/** The ideal height to meet the dropping ball (knee high: a late touch is lower, down to the grass). */
export const TOUCH_Z = 0.7;
/** A tap further ahead of the ball reaching your foot than this is ignored (not a touch yet). */
export const TAP_EARLIEST = 0.45;
/** Max reach sideways for a keepy-up touch. */
export const JUGGLE_REACH = 0.9;
const GAP = 8;

export interface TwoTouchState {
  rally: number;
  longest: number;
  ralliesLeft: number;
  touches: number;
  /** Who should play it next. */
  receiver: string;
  over: boolean;
  last: string;
  /** Rally lengths so far. */
  rallies: number[];
}

/** Seconds until a dropping ball reaches the touch height (negative: it's gone below). */
export function timeToTouch(b: { z: number; vz: number }): number {
  const a = -0.5 * G, c = b.z - TOUCH_Z;
  const disc = b.vz * b.vz - 4 * a * c;
  if (disc < 0) return Infinity;
  return (-b.vz - Math.sqrt(disc)) / (2 * a);
}

/** How a mate of this overall misses the perfect moment (seconds, one standard deviation). */
export function mateTimingSigma(overall: number): number { return 0.04 + (1 - skill01(overall)) * 0.14; }

export function makeTwoTouch(o: { seed: number; you: Person3; mate: Person3; autoYou?: boolean }): { world: World; state: TwoTouchState } {
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: !o.autoYou, x: CX - GAP / 2, y: 22, facing: 0, skills: o.you.skills, photo: o.you.photo });
  const mate = makePlayer({ id: o.mate.id, name: o.mate.name, x: CX + GAP / 2, y: 22, facing: Math.PI, skills: o.mate.skills, photo: o.mate.photo });
  const state: TwoTouchState = { rally: 0, longest: 0, ralliesLeft: TWO_TOUCH_RALLIES, touches: 0, receiver: you.id, over: false, last: "", rallies: [] };
  const other = (id: string) => (id === you.id ? mate : you);
  const isAuto = (p: P3) => !p.human;

  /** He serves it up to the receiver (a gentle lob from the hands). */
  const serve = (w: World) => {
    you.x = CX - GAP / 2; you.y = 22; mate.x = CX + GAP / 2; mate.y = 22;
    you.vx = you.vy = mate.vx = mate.vy = 0; you.facing = 0; mate.facing = Math.PI;
    const b = w.ball;
    b.x = mate.x - 0.4; b.y = mate.y; b.z = 1.2;
    const T = 1.2;
    b.vx = (you.x + 0.3 - b.x) / T; b.vy = 0; b.vz = (TOUCH_Z - b.z) / T + 0.5 * G * T;
    b.spin = 0; b.topspin = 0; b.inNet = false;
    w.owner = null; w.lastTouch = mate.id;
    state.receiver = you.id; state.touches = 0; state.rally = 0;
    for (const p of [you, mate]) p.mind.err = undefined;
  };

  const endRally = (w: World, why: string) => {
    state.rallies.push(state.rally);
    state.longest = Math.max(state.longest, state.rally);
    state.ralliesLeft--;
    state.last = why;
    w.emit({ kind: "drop", text: why });
    if (state.ralliesLeft <= 0) { state.over = true; w.frozen = 1e9; return; }
    w.frozen = 1.4;
    w.after(1.4, () => serve(w));
    state.receiver = "";
  };

  /** One touch by p, `tErr` seconds off perfect (− early, + late). */
  const touch = (w: World, p: P3, tErr: number, sendBack: boolean) => {
    if (state.receiver !== p.id) return;
    const b = w.ball;
    if (Math.hypot(b.x - p.x, b.y - p.y) > JUGGLE_REACH) return;
    state.touches++;
    if (state.touches > 2) { endRally(w, "Third touch"); return; }
    const pass = sendBack || state.touches === 2;
    const to = other(p.id);
    const aim = pass ? { x: to.x + Math.cos(to.facing) * 0.3, y: to.y + Math.sin(to.facing) * 0.3, apex: 2.4 } : { x: p.x + Math.cos(p.facing) * 0.25, y: p.y + Math.sin(p.facing) * 0.25, apex: 1.45 };
    const r = juggleTouch(b, p, tErr, aim, w.rng);
    w.lastTouch = p.id;
    w.emit({ kind: "juggle", who: p.id, clean: r.clean, text: pass ? "pass" : "control" });
    if (pass && r.clean) {
      state.rally++;
      state.receiver = to.id;
      state.touches = 0;
      to.mind.err = undefined;
      p.mind.err = undefined;
    } else if (!pass) p.mind.err = undefined;
    state.last = r.clean ? (pass ? "Over to " + to.name : "Controlled") : "Scuffed it";
  };

  const rules: Rules = {
    id: "two-touch",
    step(w) {
      if (state.over || w.frozen > 0) return;
      const b = w.ball;
      if (!state.receiver) return;
      if (b.z <= BALL_R + 0.02 && b.vz <= 0.01) { endRally(w, "It hit the grass"); return; }
      // you, without the stick: drift under the ball
      const r = w.get(state.receiver)!;
      w.assist = null;
      if (r.human) {
        const at = landing(b);
        w.assist = { move: towards(r, at.x, at.y, 0.8), sprint: Math.hypot(at.x - r.x, at.y - r.y) > 3 };
      }
      // the AI: picks its moment, misses it by its own timing error
      for (const p of [you, mate]) {
        if (!isAuto(p) || p.id !== state.receiver) continue;
        if (p.mind.err === undefined) p.mind.err = gauss(w.rng) * mateTimingSigma(p.skills.overall);
        const t = timeToTouch(b);
        if (b.vz < 0 && t <= -(p.mind.err as number)) {
          const awkward = Math.hypot(b.x - p.x, b.y - p.y) > 0.45 || Math.hypot(b.vx, b.vy) > 4.5;
          const firstTime = state.touches === 0 && !awkward && w.rng() < 0.25 + skill01(p.skills.overall) * 0.2;
          touch(w, p, p.mind.err as number, firstTime);
        }
      }
    },
    brain(w, p, dt) {
      const b = w.ball;
      if (state.receiver === p.id) { const at = landing(b); stepMover(p, towards(p, at.x, at.y, 0.8), Math.hypot(at.x - p.x, at.y - p.y) > 3, dt, Math.atan2(other(p.id).y - p.y, other(p.id).x - p.x)); }
      else stepMover(p, { x: 0, y: 0 }, false, dt, Math.atan2(b.y - p.y, b.x - p.x));
      return true;
    },
    onEvent(w, e) {
      if (e.kind === "bounce" && state.receiver && !state.over && w.frozen <= 0) endRally(w, "It hit the grass");
    },
    onReach: () => true,
    onAction(w, a) {
      if (state.over || w.frozen > 0 || !state.receiver) return true;
      const p = you;
      if (state.receiver !== p.id) return true;
      const b = w.ball;
      const t = timeToTouch(b);
      if (b.vz > 0 && b.z > TOUCH_Z + 0.3) return true; // still going up: too early to count
      if (t > TAP_EARLIEST) return true;
      touch(w, p, -t, a.kind === "pass" || a.kind === "shoot");
      return true;
    },
    finished: () => state.over,
  };
  const world = new World({ seed: o.seed, players: [you, mate], goal: null, rules, bounds: { x1: 0, x2: 68, y1: 0, y2: 60 } });
  serve(world);
  return { world, state };
}

/** Where the ball will drop through the touch height. */
function landing(b: { x: number; y: number; z: number; vx: number; vy: number; vz: number }): { x: number; y: number } {
  const t = clamp(timeToTouch(b), 0, 3);
  return { x: b.x + b.vx * t, y: b.y + b.vy * t };
}

export function twoTouchReward(s: TwoTouchState, team: number, roll: number) {
  const won = s.longest >= TWO_TOUCH_TARGET;
  return { won, gain: gameReward(won, team, roll, "team") };
}

export { juggleWindow };
