/**
 * THE SPRINT RACE — forty metres down the touchline against a team-mate
 * (the story "Fastest in the squad", the-race.json, mode "pace-sprint").
 * Not football, so not the match engine (RUL-ENG-002 is about football): a
 * small phone game on YOUR LEGS (lib/star/legs.ts), the same speeds and
 * stamina bar the match and the 3D games use.
 *
 *   On your marks, set … GO. Press on GO: before it is a false start (the
 *   race starts again), late is time lost.
 *   HOLD to sprint, LET GO to run. Sprinting drains the bar, and the bar can
 *   never be fuller than your energy (legs.ts barCap): at 60 energy you have
 *   about 60% of a full sprint in you. Empty it and you are down to a run
 *   until it is back to a quarter, so a tired man fades in the last metres.
 *   Measured (tests/star/lifeModes.mts): holding the whole way beats saving
 *   it for the end, because getting from a run up to a sprint costs time.
 *   He runs on the same legs: his pace, the same energy as you (he did the
 *   same session), his own reaction, flat out from his first step.
 *
 * Pure and seeded: (state, dt, holding) → state, fixed sub-steps, so a film
 * and a test get the same race. Test: tests/star/lifeModes.mts.
 */
import { newLegs, stepLegs, KEY_PUSH, type Legs } from "../legs";
import { mulberry32 } from "../season";

export const SPRINT = {
  /** "On your marks" (s), then "Set" for a seeded wait before GO. */
  marks: 1.2,
  setMin: 1.0,
  setMax: 2.0,
  /** His reaction to GO (s): seeded inside this. A sharp human is about 0.2. */
  hisReaction: [0.16, 0.28] as [number, number],
  /** The longest a race may run after GO (s). */
  maxSecs: 20,
} as const;

export interface Runner {
  /** Metres from the start line. */
  d: number;
  legs: Legs;
  /** Seconds after GO that he went (null: not yet). */
  went: number | null;
  /** Seconds after GO that he crossed (null: not yet). */
  time: number | null;
}

export interface SprintState {
  /** Seconds since this start's "On your marks". */
  t: number;
  phase: "marks" | "set" | "race" | "done";
  /** When GO comes (s, on `t`). */
  goAt: number;
  metres: number;
  you: Runner;
  him: Runner;
  falseStarts: number;
  /** Your reaction (s after GO), shown at the end. */
  reaction: number | null;
  flash: { what: "false-start" | "go" | null; age: number };
  seed: number;
  hisReaction: number;
  /** Was the thumb down last step (a press is the change from up to down). */
  held: boolean;
}

export interface SprintSetup {
  metres?: number;
  seed: number;
  you: { pace: number; physical?: number; energy: number };
  him: { pace: number; physical?: number; energy?: number };
}

const SUB = 1 / 120;

function freshStart(s: { seed: number; falseStarts: number }, setup: SprintSetup): SprintState {
  const r = mulberry32(s.seed * 31 + s.falseStarts * 7 + 1);
  const goAt = SPRINT.marks + SPRINT.setMin + (SPRINT.setMax - SPRINT.setMin) * r();
  const hisReaction = SPRINT.hisReaction[0] + (SPRINT.hisReaction[1] - SPRINT.hisReaction[0]) * r();
  return {
    t: 0, phase: "marks", goAt, metres: setup.metres ?? 40,
    you: { d: 0, legs: newLegs({ pace: setup.you.pace, physical: setup.you.physical ?? 50, energy: setup.you.energy }), went: null, time: null },
    him: { d: 0, legs: newLegs({ pace: setup.him.pace, physical: setup.him.physical ?? 50, energy: setup.him.energy ?? setup.you.energy }), went: null, time: null },
    falseStarts: s.falseStarts, reaction: null, flash: { what: null, age: 9 }, seed: s.seed, hisReaction, held: false,
  };
}

export function sprintStart(setup: SprintSetup): SprintState {
  return freshStart({ seed: setup.seed, falseStarts: 0 }, setup);
}

/** How far his bar can carry him at a sprint from here (m). */
function sprintReach(l: Legs): number {
  return l.stamina.v * l.fit.sprintSeconds * l.speeds.sprint;
}

/** One frame. `hold`: your thumb is down. A press before GO is a false start (the race restarts). */
export function sprintStep(s0: SprintState, dt: number, hold: boolean, setup: SprintSetup): SprintState {
  if (s0.phase === "done") return s0;
  let s: SprintState = { ...s0, you: { ...s0.you, legs: { ...s0.you.legs } }, him: { ...s0.him, legs: { ...s0.him.legs } }, flash: { ...s0.flash } };
  const press = hold && !s0.held;
  let left = Math.max(0, Math.min(0.25, dt));
  while (left > 1e-9 && s.phase !== "done") {
    const h = Math.min(SUB, left);
    left -= h;
    s.t += h;
    s.flash.age += h;
    if (s.phase === "marks" || s.phase === "set") {
      if (s.t >= SPRINT.marks) s.phase = "set";
      if (press && s.phase === "set" && s.t < s.goAt) {
        // jumped the gun: everyone back to the line
        const again = freshStart({ seed: s.seed, falseStarts: s.falseStarts + 1 }, setup);
        return { ...again, flash: { what: "false-start", age: 0 }, held: hold };
      }
      if (s.t >= s.goAt) { s.phase = "race"; s.flash = { what: "go", age: 0 }; }
      continue;
    }
    const since = s.t - s.goAt;
    // you go on your first press after GO (or a thumb already down at GO: that was a guess, so it waits for a fresh press)
    if (s.you.went === null && press) { s.you.went = since; s.reaction = since; }
    if (s.him.went === null && since >= s.hisReaction) s.him.went = since;
    for (const who of ["you", "him"] as const) {
      const r = s[who];
      if (r.went === null || r.time !== null) continue;
      const sprint = who === "you" ? hold : true;
      const p = { x: 0, y: r.d };
      stepLegs(r.legs, p, { x: 0, y: KEY_PUSH }, sprint, h, { bounds: false });
      const before = r.d;
      r.d = p.y;
      if (r.d >= s.metres) {
        // the moment he crossed, inside this sub-step
        const v = (r.d - before) / h || 1;
        r.time = since - (r.d - s.metres) / v;
        r.d = s.metres;
      }
    }
    if ((s.you.time !== null && s.him.time !== null) || since > SPRINT.maxSecs) s.phase = "done";
  }
  s = { ...s, held: hold };
  return s;
}

export interface SprintResult { won: boolean; yourTime: number | null; hisTime: number | null; reaction: number | null; falseStarts: number; headline: string }

export function sprintResult(s: SprintState): SprintResult {
  const y = s.you.time, h = s.him.time;
  const won = y !== null && (h === null || y < h);
  const gap = y !== null && h !== null ? Math.abs(y - h) : null;
  const headline = y === null ? "You never got going" : won ? `You won by ${gap !== null ? gap.toFixed(2) : "a mile"} s` : `He won by ${gap !== null ? gap.toFixed(2) : "a mile"} s`;
  return { won, yourTime: y, hisTime: h, reaction: s.reaction, falseStarts: s.falseStarts, headline };
}

/**
 * A bot thumb for tests and films. `plan` "smart": a sharp start, run, then
 * sprint once the line is inside your bar; "flat": hold the whole way.
 */
export function sprintBot(s: SprintState, plan: "smart" | "flat" = "smart"): boolean {
  if (s.phase === "marks" || s.phase === "set") return false;
  if (s.phase !== "race") return false;
  const since = s.t - s.goAt;
  if (s.you.went === null) return since >= 0.2;
  if (plan === "flat") return true;
  return s.you.d + sprintReach(s.you.legs) * 0.95 >= s.metres;
}
