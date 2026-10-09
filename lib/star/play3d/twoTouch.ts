/**
 * TWO TOUCH — you and one team-mate keep the ball up between you. Two
 * touches each at most: one to control it up to yourself, one to send it
 * back in the air (or just one: send it straight back). The ball touching
 * the grass, or a third touch, ends the rally. Three rallies; your score is
 * the longest (passes across).
 *
 * The skill (Harry, 9 Oct 2026: "Two touch has no element of skill and
 * moving messes everything up"):
 *   - Every touch is GRADED by timing against the touch window
 *     (actions.ts juggleWindow, technique widens it): Perfect, Good, Heavy,
 *     or a miss. The grade sets how well the ball sits up: a Perfect first
 *     touch pops up high and straight; a Heavy one is low and drifts away.
 *   - The return is AIMED and WEIGHTED: a swipe's (or the mouse's) direction
 *     and length. Too wide, too hard or too soft and your team-mate has to
 *     run for it, and may miss it. A plain tap sends it back too, but loose.
 *   - You step under the ball on your own; the stick only nudges.
 * His touches use the same timing, with his error set by his real overall
 * (and how far he had to run for it).
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
/** The gap between you (metres). */
export const TWO_TOUCH_GAP = 8;
const GAP = TWO_TOUCH_GAP;

// ── grading ──
export type TouchGrade = "perfect" | "good" | "poor" | "miss";
/** Timing off perfect, as a share of your window: inside PERFECT_Q is Perfect, inside GOOD_Q Good, inside 1 Heavy, beyond it a miss. */
export const PERFECT_Q = 0.35;
export const GOOD_Q = 0.7;
export const GRADE_TEXT: Record<TouchGrade, string> = { perfect: "Perfect touch", good: "Good touch", poor: "Heavy", miss: "Scuffed it" };
/** How a first touch sets the ball up, by grade: how high it pops above where you met it (m) and how far it drifts off you (m). */
export const SETUP: Record<Exclude<TouchGrade, "miss">, { rise: number; drift: number }> = {
  perfect: { rise: 0.85, drift: 0.1 },
  good: { rise: 0.6, drift: 0.45 },
  poor: { rise: 0.3, drift: 1.1 },
};

/** The grade of a touch `tErr` seconds off perfect (− early, + late), for this technique. */
export function touchGrade(tErr: number, technique: number): TouchGrade {
  const q = Math.abs(tErr) / juggleWindow(technique);
  return q <= PERFECT_Q ? "perfect" : q <= GOOD_Q ? "good" : q <= 1 ? "poor" : "miss";
}

// ── the return ──
/** A swipe/drag this long (the kick's `pull`, a share of the real match's canvas height) is full weight. */
export const RETURN_FULL_PULL = 0.14;
/** The weight that drops it right on him (half of full). */
export const RETURN_IDEAL = 0.5;
/** Weight this far off ideal (share of ideal) reads "Too hard" / "Too soft"; aim this far off (degrees) reads "Too wide". */
export const RETURN_WEIGHT_OK = 0.3;
export const RETURN_AIM_OK = 20;
/** A plain tap's return: aimed at him, but loose (distance share and degrees, one standard deviation). */
export const TAP_RETURN = { dist: 0.2, deg: 11 };

/** Where an aimed, weighted return is sent: `dir` (any length) and `pull`. */
export function returnTarget(from: { x: number; y: number }, mate: { x: number; y: number }, dir: { x: number; y: number }, pull: number) {
  const gap = Math.hypot(mate.x - from.x, mate.y - from.y) || GAP;
  const d = Math.hypot(dir.x, dir.y) || 1;
  const weight = clamp(pull / RETURN_FULL_PULL, 0, 2);
  const dist = clamp(weight / RETURN_IDEAL, 0.25, 2.5) * gap;
  const aimOff = Math.abs(((Math.atan2(dir.y, dir.x) - Math.atan2(mate.y - from.y, mate.x - from.x)) * 180 / Math.PI + 540) % 360 - 180);
  const verdict = aimOff > RETURN_AIM_OK ? "Too wide" : weight > RETURN_IDEAL * (1 + RETURN_WEIGHT_OK) ? "Too hard" : weight < RETURN_IDEAL * (1 - RETURN_WEIGHT_OK) ? "Too soft" : "";
  return { x: from.x + dir.x / d * dist, y: from.y + dir.y / d * dist, verdict, aimOff, weight };
}

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
  /** Your last touch's grade, shown as a pop for a moment (world time it happened). */
  pop: { text: string; tone: "good" | "ok" | "bad"; at: number } | null;
  /** Your touches by grade (the session). */
  grades: Record<TouchGrade, number>;
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
/** How much harder a ball he had to run for is (his timing error grows by this share per metre run). */
export const MATE_RUN_PENALTY = 0.35;

/** The action a touch is: control it up, or send it back (aimed, or a tap's loose one). */
type TouchKind = { kind: "control" } | { kind: "return"; aim?: { dir: { x: number; y: number }; pull: number } };

export function makeTwoTouch(o: { seed: number; you: Person3; mate: Person3; autoYou?: boolean }): { world: World; state: TwoTouchState } {
  const home = { you: { x: CX - GAP / 2, y: 22 }, mate: { x: CX + GAP / 2, y: 22 } };
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: !o.autoYou, x: home.you.x, y: home.you.y, facing: 0, skills: o.you.skills, photo: o.you.photo });
  const mate = makePlayer({ id: o.mate.id, name: o.mate.name, x: home.mate.x, y: home.mate.y, facing: Math.PI, skills: o.mate.skills, photo: o.mate.photo });
  const state: TwoTouchState = { rally: 0, longest: 0, ralliesLeft: TWO_TOUCH_RALLIES, touches: 0, receiver: you.id, over: false, last: "", rallies: [], pop: null, grades: { perfect: 0, good: 0, poor: 0, miss: 0 } };
  const other = (id: string) => (id === you.id ? mate : you);
  const isAuto = (p: P3) => !p.human;

  /** He serves it up to the receiver (a gentle lob from the hands). */
  const serve = (w: World) => {
    you.x = home.you.x; you.y = home.you.y; mate.x = home.mate.x; mate.y = home.mate.y;
    you.vx = you.vy = mate.vx = mate.vy = 0; you.facing = 0; mate.facing = Math.PI;
    const b = w.ball;
    b.x = mate.x - 0.4; b.y = mate.y; b.z = 1.2;
    const T = 1.2;
    b.vx = (you.x + 0.3 - b.x) / T; b.vy = 0; b.vz = (TOUCH_Z - b.z) / T + 0.5 * G * T;
    b.spin = 0; b.topspin = 0; b.inNet = false;
    w.owner = null; w.lastTouch = mate.id;
    state.receiver = you.id; state.touches = 0; state.rally = 0;
    for (const p of [you, mate]) { p.mind.err = undefined; p.mind.run = undefined; }
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
  const touch = (w: World, p: P3, tErr: number, how: TouchKind) => {
    if (state.receiver !== p.id) return;
    const b = w.ball;
    if (Math.hypot(b.x - p.x, b.y - p.y) > JUGGLE_REACH) return;
    state.touches++;
    if (state.touches > 2) { endRally(w, "Third touch"); return; }
    const pass = how.kind === "return" || state.touches === 2;
    const to = other(p.id);
    const grade = touchGrade(tErr, p.skills.technique);
    let verdict = "";
    let aim: { x: number; y: number; apex: number };
    if (pass) {
      if (how.kind === "return" && how.aim) {
        const t = returnTarget(p, to, how.aim.dir, how.aim.pull);
        verdict = t.verdict;
        aim = { x: t.x, y: t.y, apex: 2.4 };
      } else if (p.human) {
        // a tap: aimed at him, loose weight
        const gap = Math.hypot(to.x - p.x, to.y - p.y) || GAP;
        const k = 1 + gauss(w.rng) * TAP_RETURN.dist, a = Math.atan2(to.y - p.y, to.x - p.x) + gauss(w.rng) * TAP_RETURN.deg * Math.PI / 180;
        aim = { x: p.x + Math.cos(a) * gap * k, y: p.y + Math.sin(a) * gap * k, apex: 2.4 };
      } else aim = { x: to.x + Math.cos(to.facing) * 0.3, y: to.y + Math.sin(to.facing) * 0.3, apex: 2.4 };
    } else {
      // the first touch: the grade decides how well it sits up for you
      const s = SETUP[grade === "miss" ? "poor" : grade];
      const a = w.rng() * Math.PI * 2;
      aim = { x: p.x + Math.cos(p.facing) * 0.25 + Math.cos(a) * s.drift, y: p.y + Math.sin(p.facing) * 0.25 + Math.sin(a) * s.drift, apex: Math.max(0.9, b.z + s.rise) };
    }
    const r = juggleTouch(b, p, tErr, aim, w.rng);
    w.lastTouch = p.id;
    w.emit({ kind: "juggle", who: p.id, clean: r.clean, text: pass ? "pass" : "control" });
    if (p.human) {
      state.grades[r.clean ? grade : "miss"]++;
      const text = !r.clean ? GRADE_TEXT.miss : verdict ? `${GRADE_TEXT[grade]} · ${verdict}` : GRADE_TEXT[grade];
      state.pop = { text, tone: !r.clean ? "bad" : verdict || grade === "poor" ? "ok" : "good", at: w.t };
    }
    if (pass && r.clean) {
      state.rally++;
      state.receiver = to.id;
      state.touches = 0;
      to.mind.err = undefined;
      // how far he'll have to go for it
      const at = landing(b);
      to.mind.run = Math.hypot(at.x - to.x, at.y - to.y);
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
      // you step under the ball on your own (the stick only nudges): to where it drops when it's yours, back to your spot when it's his
      w.assist = null;
      w.assistNudge = 0;
      if (you.human) {
        const mine = state.receiver === you.id;
        const at = mine ? landing(b) : home.you;
        w.assist = { move: towards(you, at.x, at.y, 0.8), sprint: mine && Math.hypot(at.x - you.x, at.y - you.y) > 3 };
        w.assistNudge = 0.35;
      }
      // the AI: picks its moment, misses it by its own timing error (worse the further he had to run)
      for (const p of [you, mate]) {
        if (!isAuto(p) || p.id !== state.receiver) continue;
        if (p.mind.err === undefined) p.mind.err = gauss(w.rng) * mateTimingSigma(p.skills.overall) * (1 + MATE_RUN_PENALTY * ((p.mind.run as number) ?? 0));
        const t = timeToTouch(b);
        if (b.vz < 0 && t <= -(p.mind.err as number)) {
          const awkward = Math.hypot(b.x - p.x, b.y - p.y) > 0.45 || Math.hypot(b.vx, b.vy) > 4.5;
          const firstTime = state.touches === 0 && !awkward && w.rng() < 0.25 + skill01(p.skills.overall) * 0.2;
          touch(w, p, p.mind.err as number, firstTime ? { kind: "return" } : { kind: "control" });
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
      // face him as you play it
      p.facing = Math.atan2(mate.y - p.y, mate.x - p.x);
      const how: TouchKind = a.kind === "shoot" ? { kind: "return", aim: { dir: a.dir, pull: a.pull } } : a.kind === "pass" ? { kind: "return" } : { kind: "control" };
      touch(w, p, -t, how);
      return true;
    },
    finished: () => state.over,
  };
  const world = new World({ seed: o.seed, players: [you, mate], goal: null, rules, bounds: { x1: 0, x2: 68, y1: 0, y2: 60 } });
  serve(world);
  return { world, state };
}

/** Where the ball will drop through the touch height. */
export function landing(b: { x: number; y: number; z: number; vx: number; vy: number; vz: number }): { x: number; y: number } {
  const t = clamp(timeToTouch(b), 0, 3);
  return { x: b.x + b.vx * t, y: b.y + b.vy * t };
}

export function twoTouchReward(s: TwoTouchState, team: number, roll: number) {
  const won = s.longest >= TWO_TOUCH_TARGET;
  return { won, gain: gameReward(won, team, roll, "team") };
}

export { juggleWindow };
