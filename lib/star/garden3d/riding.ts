/**
 * RIDING YOUR HORSE — the maths (pure; no three.js). Harry, 21 Oct 2026: "Riding: round the … garden with the
 * walking controls (walk, gallop on hold)"; "Course: jumps and poles, timed lap + best time"; "every ride trains
 * a little and uses horse energy"; "Riding trains the horse (speed / stamina)". The 3D is ./levelZones.ts.
 *
 *  - GAITS: the stick's push picks walk / trot / canter (the same stick as walking); the gallop button (or Shift)
 *    with the stick pushed gallops. Speeds ease up and down; a tired horse cannot gallop, then cannot canter.
 *  - ENERGY: the horse's own 0-100 (career.horse.energy when you own one; otherwise the stable horse's, saved in
 *    career.gardenXp). Trotting and cantering cost a little, galloping more. It refills REFILL_PER_WEEK each week,
 *    as an owned horse already does between matches (careerFlow.ts).
 *  - THE COURSE: gates in order (jumps, a line of bending poles, the finish). A jump at a canter and nearly square
 *    is clean; at a trot, or at an angle, the top rail comes down (+RAIL_PENALTY s); at a walk he refuses
 *    (+REFUSAL_PENALTY s). Passing a bending pole too close knocks it (+POLE_PENALTY s). The lap's time is the
 *    clock plus the penalties; the best is kept.
 *  - TRAINING: behind RIDE_CAREER_EFFECT ("off", like the gym's flag). Off: a ride changes only the horse's energy,
 *    the best times and the lap count. On: a finished lap gives you +1 match fitness and the horse +0.5 speed and
 *    stamina, at most TRAIN_PER_WEEK laps a week.
 */

export type Gait = "halt" | "walk" | "trot" | "canter" | "gallop";

/** Metres a second for each gait (a real horse: walk ~1.7, trot ~3.5-4, canter ~5.5-6.5, gallop 9+). */
export const GAIT_SPEED: Record<Gait, number> = { halt: 0, walk: 1.7, trot: 3.6, canter: 6.0, gallop: 9.5 };
/** Stick push (0-1) where each gait starts. */
export const PUSH = { walk: 0.08, trot: 0.45, canter: 0.8 } as const;
/** Energy below which he will not gallop, and below which he will only walk. */
export const TIRED = { noGallop: 15, walkOnly: 5 } as const;
/** Energy (of 100) spent per second at each gait. A course lap at a canter, ~30 s: about 5; galloped: about 14. */
export const DRAIN: Record<Gait, number> = { halt: 0, walk: 0, trot: 0.06, canter: 0.16, gallop: 0.5 };
/** Energy back each week. */
export const REFILL_PER_WEEK = 20;
/** Speeding up and slowing down (m/s²), and how fast he can turn (radians a second) at a walk and at a gallop. */
export const ACCEL = 3.2;
export const DECEL = 5.0;
export const TURN = { slow: 2.4, fast: 1.1 } as const;

export const RAIL_PENALTY = 2;
export const REFUSAL_PENALTY = 4;
export const POLE_PENALTY = 1;
/** A jump taken more than this far off square (radians) knocks the rail. */
export const JUMP_ANGLE = (30 * Math.PI) / 180;
/** A bending pole passed nearer than this (m, centre to the horse's line) is knocked. */
export const POLE_CLEAR = 0.5;

/** Which gait the stick and the gallop button ask for, for a horse with this much energy. */
export function gaitFor(push: number, gallop: boolean, energy: number): Gait {
  if (push < PUSH.walk) return "halt";
  let g: Gait = push < PUSH.trot ? "walk" : push < PUSH.canter ? "trot" : "canter";
  if (gallop && push >= 0.5) g = "gallop";
  if (energy < TIRED.walkOnly) return "walk";
  if (g === "gallop" && energy < TIRED.noGallop) g = "canter";
  return g;
}

/** The gait he is in at a speed (for the clips and the HUD). */
export function gaitAt(speed: number): Gait {
  if (speed < 0.25) return "halt";
  if (speed < (GAIT_SPEED.walk + GAIT_SPEED.trot) / 2) return "walk";
  if (speed < (GAIT_SPEED.trot + GAIT_SPEED.canter) / 2) return "trot";
  if (speed < (GAIT_SPEED.canter + GAIT_SPEED.gallop) / 2) return "canter";
  return "gallop";
}

/** One step of speed towards the gait's speed. */
export function stepSpeed(speed: number, want: Gait, dt: number): number {
  const target = GAIT_SPEED[want];
  if (speed < target) return Math.min(target, speed + ACCEL * dt);
  return Math.max(target, speed - DECEL * dt);
}

/** How fast he may turn at a speed (radians a second). */
export function turnRate(speed: number): number {
  const k = Math.max(0, Math.min(1, speed / GAIT_SPEED.gallop));
  return TURN.slow + (TURN.fast - TURN.slow) * k;
}

/** Energy after `dt` seconds at a speed. */
export function drain(energy: number, speed: number, dt: number): number {
  return Math.max(0, energy - DRAIN[gaitAt(speed)] * dt);
}

/** The stable horse's energy now: what was saved, plus REFILL_PER_WEEK for each week since. */
export function energyNow(saved: number | undefined, savedAt: string | undefined, season: number, week: number): number {
  if (saved === undefined || !savedAt) return 100;
  const [s, w] = savedAt.split("-").map(Number);
  const weeks = Number.isFinite(s) && Number.isFinite(w) ? Math.max(0, (season - s) * 52 + (week - w)) : 0;
  return Math.min(100, Math.max(0, saved) + REFILL_PER_WEEK * weeks);
}

// ── The course ──

export type GateKind = "jump" | "poles" | "finish" | "check";
/** A gate: a line from (x0, z0) to (x1, z1) to ride through, in order. Bending poles: the poles' spots. */
export interface CourseGate { kind: GateKind; x0: number; z0: number; x1: number; z1: number; poles?: [number, number][]; name?: string }

export interface LapState {
  /** Riding a lap now (after crossing the start). */
  on: boolean;
  /** Seconds on the clock. */
  t: number;
  /** Penalty seconds this lap. */
  pen: number;
  /** The next gate's index. */
  next: number;
  /** What happened this lap, for the HUD. */
  faults: string[];
  /** Poles already knocked this lap (gate index * 10 + pole). */
  knocked: number[];
}

export const newLap = (): LapState => ({ on: false, t: 0, pen: 0, next: 0, faults: [], knocked: [] });

/** Do segments p→q and a→b cross? Returns where along p→q (0-1), or -1. */
export function crossAt(px: number, pz: number, qx: number, qz: number, ax: number, az: number, bx: number, bz: number): number {
  const rx = qx - px, rz = qz - pz, sx = bx - ax, sz = bz - az;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return -1;
  const t = ((ax - px) * sz - (az - pz) * sx) / den;
  const u = ((ax - px) * rz - (az - pz) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

/** How a jump went: speed (m/s) and the angle off square (radians). */
export function jumpResult(speed: number, offSquare: number): "clean" | "rail" | "refusal" {
  if (speed < (GAIT_SPEED.walk + GAIT_SPEED.trot) / 2) return "refusal";
  if (speed < (GAIT_SPEED.trot + GAIT_SPEED.canter) / 2 || offSquare > JUMP_ANGLE) return "rail";
  return "clean";
}

/** The angle between a move (dx, dz) and the square line through a gate (radians, 0 = straight through). */
export function offSquare(g: CourseGate, dx: number, dz: number): number {
  const gx = g.x1 - g.x0, gz = g.z1 - g.z0;
  const gl = Math.hypot(gx, gz) || 1, ml = Math.hypot(dx, dz) || 1;
  const along = Math.abs((gx * dx + gz * dz) / (gl * ml)); // cos of angle to the gate line
  return Math.asin(Math.min(1, along));
}

export interface LapEvent { kind: "start" | "gate" | "jump" | "pole" | "finish" | "wrong"; result?: "clean" | "rail" | "refusal"; time?: number; best?: boolean; gate?: number }

/**
 * One step of the lap. The horse moved from (px, pz) to (qx, qz) at `speed` over `dt`. `gates[0]` is the start
 * and finish line (kind "finish"); the rest are ridden in order, then the finish again. Returns the new state and
 * what happened (for the HUD and the sound). A refusal stops nothing here; the 3D stops the horse.
 */
export function stepLap(s: LapState, gates: CourseGate[], px: number, pz: number, qx: number, qz: number, speed: number, dt: number, best: number | undefined): { lap: LapState; events: LapEvent[] } {
  const lap: LapState = { ...s, faults: s.faults, knocked: s.knocked };
  const events: LapEvent[] = [];
  if (lap.on) lap.t += dt;
  const dx = qx - px, dz = qz - pz;
  const finish = gates[0];
  const crossFinish = crossAt(px, pz, qx, qz, finish.x0, finish.z0, finish.x1, finish.z1) >= 0;
  if (!lap.on) {
    if (crossFinish) { Object.assign(lap, newLap(), { on: true, next: 1 }); events.push({ kind: "start" }); }
    return { lap, events };
  }
  // bending poles: any pole of the next pole gate passed too close is knocked
  for (let gi = 1; gi < gates.length; gi++) {
    const g = gates[gi];
    if (g.kind !== "poles" || !g.poles) continue;
    g.poles.forEach(([x, z], pi) => {
      const id = gi * 10 + pi;
      if (lap.knocked.includes(id)) return;
      // nearest distance from the pole to this step's segment
      const l2 = dx * dx + dz * dz;
      const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / l2)) : 0;
      const d = Math.hypot(px + dx * t - x, pz + dz * t - z);
      if (d < POLE_CLEAR) {
        lap.knocked = [...lap.knocked, id];
        lap.pen += POLE_PENALTY;
        lap.faults = [...lap.faults, `pole +${POLE_PENALTY}s`];
        events.push({ kind: "pole", gate: gi });
      }
    });
  }
  if (lap.next < gates.length) {
    const g = gates[lap.next];
    if (crossAt(px, pz, qx, qz, g.x0, g.z0, g.x1, g.z1) >= 0) {
      if (g.kind === "jump") {
        const r = jumpResult(speed, offSquare(g, dx, dz));
        if (r === "rail") { lap.pen += RAIL_PENALTY; lap.faults = [...lap.faults, `rail +${RAIL_PENALTY}s`]; }
        if (r === "refusal") { lap.pen += REFUSAL_PENALTY; lap.faults = [...lap.faults, `refusal +${REFUSAL_PENALTY}s`]; }
        events.push({ kind: "jump", result: r, gate: lap.next });
      } else events.push({ kind: "gate", gate: lap.next });
      lap.next++;
    }
  } else if (crossFinish) {
    const time = lap.t + lap.pen;
    events.push({ kind: "finish", time, best: best === undefined || time * 1000 < best });
    Object.assign(lap, newLap(), { on: true, next: 1 }); // straight into the next lap
    events.push({ kind: "start" });
    return { lap, events };
  }
  // crossing the finish before every gate: a wrong way round, nothing counted
  if (crossFinish && lap.next > 1 && lap.next < gates.length) events.push({ kind: "wrong" });
  return { lap, events };
}

/** "0:34.2" for a time in seconds. */
export function lapClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(1)}`;
}

// ── Training (behind the flag) ──

export type RideEffectMode = "off" | "on";
/** OFF until Harry tries it, like the gym's GYM_CAREER_EFFECT. */
export const RIDE_CAREER_EFFECT: RideEffectMode = "off";
let rideOverride: RideEffectMode | null = null;
/** For tests only. */
export function setRideEffectForTest(m: RideEffectMode | null) { rideOverride = m; }
export const rideEffectMode = (): RideEffectMode => rideOverride ?? RIDE_CAREER_EFFECT;
export const TRAIN_PER_WEEK = 3;

/** What a finished lap trains: you (+match fitness) and the horse (+speed, +stamina). All 0 while the flag is off. */
export function lapTraining(lapsTrainedThisWeek: number): { fitness: number; horseSpeed: number; horseStamina: number } {
  if (rideEffectMode() !== "on" || lapsTrainedThisWeek >= TRAIN_PER_WEEK) return { fitness: 0, horseSpeed: 0, horseStamina: 0 };
  return { fitness: 1, horseSpeed: 0.5, horseStamina: 0.5 };
}
