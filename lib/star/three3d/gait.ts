/**
 * WALK → JOG → RUN → SPRINT, one way for every 3D screen with a thumb stick
 * (Harry, 9 Oct 2026: "the walk - jog - sprinting animation needs work, like
 * when you're pressing forward max you should be using stamina and be
 * sprinting").
 *
 * Pure (no three.js): Free Roam and the other play3d games (play3d/player.ts,
 * play3d/scene.ts), the 3D garden and the 3D shop all use it.
 *
 *   stickTarget   how far the stick is pushed → how fast he wants to go
 *   approach      weighty speed-up and slow-down (~0.25 s to full speed)
 *   pickGait      which loop his speed wants (with a band so he never flickers)
 *   loopRate      clip speed = ground speed ÷ (clip's own speed × body size): no foot slide
 *   sameFootTime  where to start the new loop so the same foot is down
 *   stepStamina   the sprint bar: drains sprinting, comes back easing off, locks out at empty
 *
 * The mocap loops' own speeds (public/star/anims3d/mocap.glb, m/s at the
 * capture actor's size): walk 1.05, jog 2.88, run 3.35, sprint 6.36. The run
 * and sprint share one cadence (0.73 s / 0.72 s a cycle); the sprint takes
 * the longer stride. Speeds below are chosen so each loop plays near its own
 * rate (walk ×1.3, jog ×1.2, run ×1.5, sprint ×1.05 at pace 50).
 *
 * Settings → Look → Motion: Old keeps the feel from before (callers check
 * motionLook() and skip all of this).
 */

export type Gait = "idle" | "walk" | "jog" | "run" | "sprint";
export const GAITS: Gait[] = ["idle", "walk", "jog", "run", "sprint"];

/** Top speed in each gait, m/s. */
export interface GaitSpeeds { walk: number; jog: number; run: number; sprint: number }

/** Sprint = this × run (Harry's brief: "about 1.35× run speed"). */
export const SPRINT_OVER_RUN = 1.35;

/** A footballer's speeds from his pace (0–100). Pace 50: walk 1.4, jog 3.4, run 5.0, sprint 6.75. */
export function speedsForPace(pace: number): GaitSpeeds {
  const p = Math.max(0, Math.min(100, pace)) / 100;
  const run = 4.6 + 0.8 * p;
  return { walk: 1.4, jog: 3.4, run, sprint: run * SPRINT_OVER_RUN };
}

/** The garden and the shop (no pace): the same shape, a touch gentler. */
export const STROLL_SPEEDS: GaitSpeeds = { walk: 1.45, jog: 3.4, run: 4.8, sprint: 4.8 * SPRINT_OVER_RUN };

/** Stick push (0..1) zones: below `dead` he stands, then walk, jog, run; `sprint` and up is a full push. */
export const STICK = { dead: 0.08, walk: 0.45, jog: 0.78, sprint: 0.92 };

/**
 * How fast he wants to go for this stick push. A small push walks (slow to
 * brisk), a medium push jogs, a near-full push runs, and a full push (or the
 * sprint button) sprints — unless `canSprint` is false (stamina out), then he runs.
 */
export function stickTarget(mag: number, sprintHeld: boolean, s: GaitSpeeds, canSprint = true): number {
  const m = Math.max(0, Math.min(1, mag));
  if (m < STICK.dead) return 0;
  if ((sprintHeld || m >= STICK.sprint) && canSprint) return s.sprint;
  if (m < STICK.walk) return s.walk * (0.45 + 0.55 * (m - STICK.dead) / (STICK.walk - STICK.dead));
  if (m < STICK.jog) return s.walk + (s.jog - s.walk) * (m - STICK.walk) / (STICK.jog - STICK.walk);
  if (m < STICK.sprint) return s.jog + (s.run - s.jog) * (m - STICK.jog) / (STICK.sprint - STICK.jog);
  return s.run;
}

/** Speed-up and slow-down times. */
export const MOVE = {
  /** Standing to his run speed, seconds. */
  upToRun: 0.25,
  /** Run to sprint, seconds (the last burst takes a little longer). */
  runToSprint: 0.45,
  /** Run speed to standing when you let go, seconds. */
  stopFromRun: 0.3,
};

/**
 * One step of speed `v` towards `target` (m/s): a steady push up (standing
 * to run in MOVE.upToRun, the last bit to sprint slower) and a short
 * slow-down, never an instant jump.
 */
export function approach(v: number, target: number, dt: number, s: GaitSpeeds): number {
  if (target > v) {
    const a = v < s.run ? s.run / MOVE.upToRun : Math.max(0.1, s.sprint - s.run) / MOVE.runToSprint;
    return Math.min(target, v + a * dt);
  }
  const d = s.run / MOVE.stopFromRun;
  return Math.max(target, v - d * dt);
}

/**
 * Which loop his speed wants. `edges` are where one gait hands over to the
 * next (m/s); `band` keeps him in the gait he's in until he's that far past
 * the edge, so he never flickers between two.
 */
export function gaitEdges(s: GaitSpeeds): [number, number, number, number] {
  return [0.3, (s.walk + s.jog) / 2, (s.jog + s.run) / 2, (s.run + s.sprint) / 2];
}

export function pickGait(cur: string, speed: number, edges: [number, number, number, number], band = 0.2): Gait {
  let i = 0;
  while (i < 4 && speed >= edges[i]) i++;
  const c = GAITS.indexOf(cur as Gait);
  if (c >= 0 && Math.abs(i - c) === 1) {
    const edge = edges[Math.min(i, c)];
    const b = Math.min(i, c) === 0 ? band * 0.5 : band;
    if (Math.abs(speed - edge) < b) i = c;
  }
  return GAITS[i];
}

/**
 * The loop's play rate so the feet match the ground: speed ÷ (clip speed × body size),
 * kept within limits so a loop is never played absurdly slow or fast.
 */
export function loopRate(speed: number, clipSpeed: number | undefined, size = 1, min = 0.5, max = 1.6): number {
  if (!clipSpeed || clipSpeed <= 0) return 1;
  return Math.max(min, Math.min(max, speed / (clipSpeed * size)));
}

/**
 * Start a new loop on the same foot: how far through its own cycle the old
 * loop is (from its first left-foot plant), the same distance through the new.
 */
export function sameFootTime(prevTime: number, prevDur: number, prevPlant: number, nextDur: number, nextPlant: number): number {
  if (!(prevDur > 0) || !(nextDur > 0)) return 0;
  const ph = ((((prevTime - prevPlant) / prevDur) % 1) + 1) % 1;
  return (nextPlant + ph * nextDur) % nextDur;
}

/** Crossfade between gaits, seconds. */
export const GAIT_BLEND = 0.2;

// ── Stamina ────────────────────────────────────────────────────────────────

export interface Stamina {
  /** 0 (empty) .. 1 (full). */
  v: number;
  /** Ran it to empty: no sprint until it is back to STAMINA.resume. */
  tired: boolean;
}

export const STAMINA = {
  /** Full to empty in this many seconds of sprinting. */
  sprintSeconds: 6,
  /** Back per second while running (not sprinting). */
  backRunning: 0.05,
  /** Back per second while jogging or walking. */
  backEasy: 0.16,
  /** Back per second standing still. */
  backStill: 0.25,
  /** Ran out: sprint again only from here. */
  resume: 0.25,
};

export const freshStamina = (): Stamina => ({ v: 1, tired: false });

/** Can he sprint right now? */
export const canSprint = (s: Stamina) => !s.tired && s.v > 0;

/**
 * One step of the stamina bar. `effort`: "sprint" drains it; "run", "easy"
 * (jog/walk) and "still" bring it back, faster the more he eases off.
 * `drainK` scales the drain (1 = normal; small for the garden/shop).
 */
export function stepStamina(s: Stamina, effort: "sprint" | "run" | "easy" | "still", dt: number, drainK = 1): Stamina {
  let v = s.v;
  if (effort === "sprint") v -= (dt / STAMINA.sprintSeconds) * drainK;
  else v += dt * (effort === "run" ? STAMINA.backRunning : effort === "easy" ? STAMINA.backEasy : STAMINA.backStill);
  v = Math.max(0, Math.min(1, v));
  let tired = s.tired;
  if (v <= 0) tired = true;
  else if (tired && v >= STAMINA.resume) tired = false;
  return { v, tired };
}

/** Which effort a speed is, against his own speeds. */
export function effortOf(speed: number, sprinting: boolean, s: GaitSpeeds): "sprint" | "run" | "easy" | "still" {
  if (sprinting && speed > s.run * 0.9) return "sprint";
  if (speed < 0.3) return "still";
  return speed > (s.jog + s.run) / 2 ? "run" : "easy";
}
