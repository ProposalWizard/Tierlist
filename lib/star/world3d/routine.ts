/**
 * ROUTINES — a reason to move (world kit, phase 1; the RDR2 idea from
 * docs/research/world-3d-2026-11-20.md: people keep a daily schedule).
 *
 * A DayClock runs game minutes; a routine is a seeded list of steps on it
 * (arrive at the gate, sit on the bench for 3 to 5 minutes, stand and stretch,
 * leave). ./npc.ts plays a step; RoutineRunner says which step is due. The
 * same seed gives the same day, so a place can be filmed and tested.
 * Pure: no three.js. Test: tests/star/routine.mts.
 */
import { SIT_HOLD, type ClipStep } from "./smartObject";

export const DAY_MIN = 24 * 60;

export type DayPhase = "night" | "morning" | "midday" | "afternoon" | "evening";

/** Game time of day, in minutes. `rate`: how many times faster than real time it runs (1 = real time). */
export class DayClock {
  constructor(public minute = 9 * 60, public rate = 1, public day = 0) {}
  advance(dtSec: number) {
    this.minute += (Math.max(0, dtSec) / 60) * this.rate;
    while (this.minute >= DAY_MIN) { this.minute -= DAY_MIN; this.day++; }
  }
  /** "09:05". */
  get hhmm() {
    const m = Math.floor(this.minute);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }
  phase(): DayPhase { return phaseOf(this.minute); }
  /** Minutes since the start of day 0 (never wraps: for schedules). */
  get total() { return this.day * DAY_MIN + this.minute; }
}

export function phaseOf(minute: number): DayPhase {
  const m = ((minute % DAY_MIN) + DAY_MIN) % DAY_MIN;
  if (m < 6 * 60 || m >= 22 * 60) return "night";
  if (m < 11.5 * 60) return "morning";
  if (m < 14 * 60) return "midday";
  if (m < 18 * 60) return "afternoon";
  return "evening";
}

/**
 * Where the day starts on the career calendar: a match day, a training day or
 * a day off (the training centre will read the real calendar; phase 1 places
 * take the kind of day only).
 */
export function dayStart(kind: "matchday" | "training" | "rest"): number {
  return kind === "matchday" ? 10 * 60 : kind === "training" ? 8 * 60 + 30 : 10 * 60 + 30;
}

/** A small seeded random (mulberry32): the same seed, the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A number from a string id (for seeds). */
export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** What one step does. `target` is an object id, or "kind:seat" for any of a kind. */
export type RoutineDo =
  | { kind: "arrive"; via: string }
  | { kind: "use"; target: string; loop?: ClipStep[] }
  | { kind: "stretch" }
  | { kind: "wait" }
  | { kind: "leave"; via: string };

export interface TemplateStep {
  do: RoutineDo;
  /** Game minutes it lasts (min..max). Arrive/leave: the most it may take. */
  mins: [number, number];
  /** Game minutes of nothing before it (min..max). */
  gap?: [number, number];
  /** Chance it happens at all (1 = always). */
  chance?: number;
}

export interface RoutineTemplate {
  id: string;
  steps: TemplateStep[];
  /** Go round the steps again until the day's end. */
  repeat?: boolean;
}

export interface PlannedStep { at: number; until: number; do: RoutineDo }
export interface Routine { who: string; template: string; steps: PlannedStep[] }

/** A seeded day: each step its start and end in game minutes, in order, never overlapping. */
export function planRoutine(who: string, tpl: RoutineTemplate, start: number, end: number, seed: number): Routine {
  const r = seeded(seed ^ hashId(`${who}|${tpl.id}`));
  const between = (a: [number, number]) => a[0] + (a[1] - a[0]) * r();
  const steps: PlannedStep[] = [];
  let t = start;
  let rounds = 0;
  outer: do {
    for (const s of tpl.steps) {
      if (s.chance !== undefined && r() >= s.chance) continue;
      const at = t + (s.gap ? between(s.gap) : 0);
      const until = at + between(s.mins);
      if (until > end) break outer;
      steps.push({ at, until, do: s.do });
      t = until;
    }
    rounds++;
  } while (tpl.repeat && rounds < 500 && t < end);
  return { who, template: tpl.id, steps };
}

/** The step due at `minute` (the last one started), or -1 before the first. */
export function stepAt(rt: Routine, minute: number): number {
  let k = -1;
  for (let i = 0; i < rt.steps.length; i++) if (rt.steps[i].at <= minute) k = i; else break;
  return k;
}

/**
 * Walks a routine on the clock. A step starts at its time AND once the last
 * one is finished (a walk to the bench takes what it takes); a "use" or
 * "stretch" ends at its time; an "arrive" or "leave" ends when the walk does.
 */
export class RoutineRunner {
  index = -1;
  private busy = false;
  constructor(public routine: Routine) {}
  /** Call each frame; `start(step)` begins a step, `done()` ends the walking ones. */
  tick(minute: number, start: (s: PlannedStep, i: number) => void, stop: (s: PlannedStep, i: number) => void) {
    this.last = minute;
    const cur = this.routine.steps[this.index];
    if (cur && this.busy && (cur.do.kind === "use" || cur.do.kind === "stretch" || cur.do.kind === "wait") && minute >= cur.until) {
      this.busy = false;
      stop(cur, this.index);
    }
    if (this.busy) return;
    const next = this.routine.steps[this.index + 1];
    if (next && minute >= next.at) {
      this.index++;
      this.busy = true;
      start(next, this.index);
    }
  }
  /** The walk of an arrive/leave step is over (or a step was cut short). A
   *  walk that took longer than planned pushes the rest of the day back. */
  done() {
    this.busy = false;
    const cur = this.routine.steps[this.index];
    const late = cur ? this.last - cur.until : 0;
    if (late > 0) for (let i = this.index + 1; i < this.routine.steps.length; i++) { this.routine.steps[i].at += late; this.routine.steps[i].until += late; }
  }
  private last = 0;
  get current(): PlannedStep | null { return this.routine.steps[this.index] ?? null; }
  get finished() { return !this.busy && this.index >= this.routine.steps.length - 1; }
}

// ── The routines phase 1 uses (house and garden) ─────────────────────────

/** A team-mate drops round: in at the gate, a sit on the bench (a drink, a chat), out again. */
export const GARDEN_VISITOR: RoutineTemplate = {
  id: "garden-visitor",
  repeat: true,
  steps: [
    { do: { kind: "arrive", via: "gate" }, mins: [0.4, 0.4], gap: [0.3, 1.2] },
    { do: { kind: "use", target: "kind:seat", loop: [
      { ...SIT_HOLD, secs: 3 },
      { ...SIT_HOLD, secs: 4, gesture: "drink" },
      { ...SIT_HOLD, secs: 4 },
    ] }, mins: [2.2, 3.2] },
    { do: { kind: "leave", via: "gate" }, mins: [0.4, 0.4] },
  ],
};

/** On the bench, chatting; now and then up for a stretch, then sat again. */
export const BENCH_MATE: RoutineTemplate = {
  id: "bench-mate",
  repeat: true,
  steps: [
    { do: { kind: "use", target: "kind:seat" }, mins: [2.5, 5] },
    { do: { kind: "stretch" }, mins: [0.8, 1.2], chance: 0.6 },
  ],
};

/** The gym (world3d/gymPlace.ts): a run on the far treadmill, a drink at the cooler, a stretch on the mat, round again. */
export const GYM_MATE: RoutineTemplate = {
  id: "gym-mate",
  repeat: true,
  steps: [
    // phase 2 (Harry: "he never stays on one thing for long"): a run, then round the new kit, each a short go
    // (testScene.ts mateGymFrame plays each one on a bot thumb with the same poses as yours)
    { do: { kind: "use", target: "treadmill2-belt", loop: [{ clip: "jog", secs: 6 }] }, mins: [1.4, 2.0] },
    { do: { kind: "use", target: "pullup", loop: [{ clip: "idle", secs: 6 }] }, mins: [0.6, 0.9] },
    { do: { kind: "use", target: "cooler" }, mins: [0.15, 0.2], gap: [0.05, 0.2] },
    { do: { kind: "use", target: "boxjump", loop: [{ clip: "idle", secs: 6 }] }, mins: [0.6, 0.9] },
    { do: { kind: "use", target: "ladder", loop: [{ clip: "idle", secs: 6 }] }, mins: [0.5, 0.8] },
    { do: { kind: "use", target: "mat", loop: [{ clip: "stretch", or: ["idle"], secs: 6 }] }, mins: [0.5, 0.8] },
  ],
};
