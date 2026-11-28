/**
 * KEEP-UPS — you, a ball, and a count. The story "Bet you can't do fifty"
 * (keep-ups.json, mode "two-touch") plays it from the activity host. Solo,
 * one go: your first tap drops it from your hands onto your foot and keep it up until it touches the
 * grass. Every clean touch counts one.
 *
 * The 3D engine's own keepy-up touch, nothing new (3D games are the
 * one-engine rule's exception, RUL-3D-001):
 *   - a touch is timed against the moment the ball drops to knee height
 *     (twoTouch.ts timeToTouch / touchGrade; technique widens the window,
 *     actions.ts juggleWindow);
 *   - the grade sets how well it sits back up (twoTouch.ts SETUP): a Perfect
 *     touch pops straight up, a Heavy one drifts and you have to step after it;
 *   - outside the window it is a scuff (actions.ts juggleTouch) and it is gone.
 * You step under the ball on your own (as in Two Touch); the stick only nudges.
 *
 * The kid's count is rolled once at the start (she goes after you) and shown
 * at the end. You win if you beat it.
 */
import { BALL_R, CX } from "./constants";
import { juggleTouch } from "./actions";
import { makePlayer, towards } from "./player";
import { World, type Rules } from "./world";
import type { Person3 } from "./freeRoam";
import type { DrillDef } from "./drills";
import { GRADE_TEXT, SETUP, TAP_EARLIEST, TOUCH_Z, JUGGLE_REACH, landing, timeToTouch, touchGrade, type TouchGrade } from "./twoTouch";

/** A hundred and the kids lose count: the go ends there (about 80 s of perfect touches). */
export const KEEP_UPS_MAX = 100;
/** A safety net (s), past any real go. */
export const KEEP_UPS_MAX_S = 150;
/** Her count on the day: between these (she claims 62; nerves in front of four hundred kids). Reasoned. */
export const KID_COUNT = { min: 18, max: 62 };

export interface KeepUpsState {
  count: number;
  over: boolean;
  last: string;
  /** Your last touch's grade, shown for a moment (world time it happened). */
  pop: { text: string; tone: "good" | "ok" | "bad"; at: number } | null;
  grades: Record<TouchGrade, number>;
  /** Her count, rolled at the start. */
  kid: number;
  /** The ball has left your hands (your first tap drops it; until then it waits). */
  started: boolean;
}

/** Her count on the day, from the seed (the same seed, the same count). */
export function kidCount(rng: () => number): number {
  // Two rolls averaged: most days in the 30s and 40s, now and then near her 62.
  const r = (rng() + rng()) / 2;
  return Math.round(KID_COUNT.min + (KID_COUNT.max - KID_COUNT.min) * r);
}

export function makeKeepUps(o: { seed: number; you: Person3; autoYou?: boolean }): { world: World; state: KeepUpsState } {
  const home = { x: CX, y: 24 };
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: !o.autoYou, x: home.x, y: home.y, facing: -Math.PI / 2, skills: o.you.skills, photo: o.you.photo });
  const state: KeepUpsState = { count: 0, over: false, last: "", pop: null, grades: { perfect: 0, good: 0, poor: 0, miss: 0 }, kid: 0, started: !!o.autoYou };

  const end = (w: World, why: string) => {
    if (state.over) return;
    state.over = true;
    state.last = why;
    w.emit({ kind: "drop", text: why });
    w.frozen = 1e9;
  };

  /** One touch, `tErr` seconds off perfect (− early, + late). */
  const touch = (w: World, tErr: number) => {
    const b = w.ball;
    if (Math.hypot(b.x - you.x, b.y - you.y) > JUGGLE_REACH) return;
    const grade = touchGrade(tErr, you.skills.technique);
    const s = SETUP[grade === "miss" ? "poor" : grade];
    const a = w.rng() * Math.PI * 2;
    const aim = { x: you.x + Math.cos(a) * s.drift, y: you.y + Math.sin(a) * s.drift, apex: Math.max(1.1, b.z + s.rise) };
    const r = juggleTouch(b, you, tErr, aim, w.rng);
    w.lastTouch = you.id;
    w.emit({ kind: "juggle", who: you.id, clean: r.clean, text: "keep-up" });
    state.grades[r.clean ? grade : "miss"]++;
    if (r.clean) state.count++;
    state.pop = { text: r.clean ? GRADE_TEXT[grade] : GRADE_TEXT.miss, tone: !r.clean ? "bad" : grade === "poor" ? "ok" : "good", at: w.t };
    state.last = r.clean ? `${state.count}` : "Scuffed it";
    you.mind.err = undefined;
  };

  /** The ball in your hands, at your waist. */
  function hold(w: World) {
    const b = w.ball;
    b.x = you.x + 0.15; b.y = you.y - 0.1; b.z = 1.15;
    b.vx = 0; b.vy = 0; b.vz = 0;
    b.spin = 0; b.topspin = 0; b.inNet = false;
    w.owner = null; w.lastTouch = you.id;
  }
  /** You drop it from your hands onto your foot. */
  function drop(w: World) {
    hold(w);
    w.ball.vz = 0.4;
  }

  const rules: Rules = {
    id: "keep-ups",
    step(w) {
      if (state.over) return;
      const b = w.ball;
      // held in your hands until your first tap (so the go never starts before you are looking)
      if (!state.started) { hold(w); return; }
      if (state.count >= KEEP_UPS_MAX) { end(w, "A hundred. The kids lose count"); return; }
      if (w.t > KEEP_UPS_MAX_S) { end(w, "Time"); return; }
      if (b.z <= BALL_R + 0.02 && b.vz <= 0.01) { end(w, "It hit the grass"); return; }
      // you step under where it drops (the stick only nudges)
      const at = landing(b);
      w.assist = { move: towards(you, at.x, at.y, 0.8), sprint: Math.hypot(at.x - you.x, at.y - you.y) > 3 };
      w.assistNudge = 0.35;
      // a film or a test: a steady thumb (the same timing error a decent player has)
      if (o.autoYou && b.vz < 0) {
        if (you.mind.err === undefined) you.mind.err = (w.rng() - 0.5) * 0.08;
        if (timeToTouch(b) <= -(you.mind.err as number)) touch(w, you.mind.err as number);
      }
    },
    brain() { return true; },
    onEvent(w, e) { if (e.kind === "bounce" && !state.over) end(w, "It hit the grass"); },
    onReach: () => true,
    onAction(w, a) {
      if (state.over || o.autoYou) return true;
      void a;
      if (!state.started) { state.started = true; drop(w); return true; }
      const b = w.ball;
      const t = timeToTouch(b);
      if (b.vz > 0 && b.z > TOUCH_Z + 0.3) return true; // still going up: too early to count
      if (t > TAP_EARLIEST) return true;
      touch(w, -t);
      return true;
    },
    finished: () => state.over,
  };
  const world = new World({ seed: o.seed, players: [you], goal: null, rules, bounds: { x1: 0, x2: 68, y1: 0, y2: 60 } });
  state.kid = kidCount(world.rng);
  if (state.started) drop(world); else hold(world);
  return { world, state };
}

/** The story's keep-ups as a 3D drill for Play3D (not on the training picker: the story opens it). */
export function keepUpsDrill(o: { kidName: string; target: number; onState?: (s: KeepUpsState) => void }): DrillDef {
  return {
    id: "keep-ups", name: "Keep-ups", blurb: "Keep it up as long as you can.", status: "ready", kind: "play3d",
    start(ctx) {
      const { world, state } = makeKeepUps({ seed: ctx.seed, you: ctx.you });
      o.onState?.(state);
      return {
        world, camera: "practice", stick: "corner",
        frame: () => ({ target: { x: CX, y: 4 } }),
        hint: "Tap as the ball drops to your foot. You step under it yourself.",
        hints: {
          touch: "Tap anywhere as the ball drops to your foot. Early or late and it drifts; miss the moment and it's gone.",
          pc: "Space or click as the ball drops to your foot. Early or late and it drifts; miss the moment and it's gone.",
        },
        hud: () => ({
          big: `${state.count}`,
          small: `Keep-ups · the bet: ${o.target} · ${o.kidName} goes next`,
          banner: state.started ? null : { text: "TAP TO DROP IT", tone: "info" },
          flash: state.over ? state.last : undefined,
          pop: state.pop && world.t - state.pop.at < 0.9 ? state.pop : null,
        }),
        done: () => state.over,
        result() {
          const won = state.count > state.kid;
          return { won, gain: 0, line: `You: ${state.count}. ${o.kidName}: ${state.kid}.${state.count >= o.target ? ` You did ${o.target}.` : ""}` };
        },
      };
    },
  };
}
