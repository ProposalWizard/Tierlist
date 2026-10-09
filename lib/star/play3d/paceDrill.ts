/**
 * PACE DRILL — a timed 30 m sprint with a defender chasing you (Harry,
 * 9 Oct 2026: "your walk/jog/sprint should also scale with your stats, so you
 * could actually add a pace drill and feel a sense of improving speed").
 *
 * 3 · 2 · 1 · GO, then flat out to the finish line, 30 m towards the goal. A
 * defender starts just behind you, off your shoulder, and chases. He catches
 * you (within CATCH_R) and the run is over with no stars.
 *
 * It trains PACE the way the 2D drills do (lib/star/trainingLevels.ts): you
 * run your next level; the stars on it (3 / 2 / 1 by time) bank through
 * applyLevelResult in the career. A level's target time is the time a player
 * of that level's pace (levelDifficulty) runs, so as your pace grows, your
 * time and your "Top speed" readout grow with it.
 *
 * Pure: no React, no three.js.
 */
import { CX } from "./constants";
import { makePlayer, skillsOf, speedOf, stepHuman, stepMover, topSpeed, type P3, type Skills3 } from "./player";
import { World, type Rules } from "./world";
import { levelDifficulty } from "../trainingLevels";
import { kmh } from "../three3d/gait";

export const PACE_START_Y = 42;
export const PACE_DISTANCE = 30;
export const PACE_FINISH_Y = PACE_START_Y - PACE_DISTANCE;
/** The countdown before GO, seconds. */
export const PACE_COUNTDOWN = 2.4;
/** He has you within this, metres: caught. */
export const CATCH_R = 0.9;
/** Where he starts against you: across, and behind (metres). */
export const CHASER_START = { across: 1.8, behind: 3.0 };
/** He reacts to GO this late, seconds. */
export const CHASER_REACT = 0.3;
/** His pace against the level's. */
export const CHASER_PACE_OVER_LEVEL = 0;
/**
 * Seconds over the level's time for 3, 2 and 1 stars. Ten points of pace is
 * about 0.18 s over 30 m, so 2 stars is about 10 pace short of the level, 1 star about 20.
 */
export const STAR_SLACK = [0.08, 0.22, 0.42];
/** The clock starts when you first move, or this long after GO (whichever is first): your reaction isn't timed, but a slow one lets him close. */
export const CLOCK_GRACE = 0.6;
/** Give up after this long (you stopped). */
export const PACE_GIVE_UP = 12;

export interface PaceState {
  level: number;
  /** The level's time: a player of the level's pace, flat out, straight. */
  target: number;
  /** Seconds since GO (frozen at the finish). */
  time: number;
  finished: boolean;
  caught: boolean;
  over: boolean;
  /** Your fastest speed on this run, m/s. */
  topSpeed: number;
  stars: number;
  last: string;
  chaserName: string;
}

/**
 * The time a man of this pace runs the 30 m from standing, full push, straight
 * (new feel: stepHuman; old feel: stepMover's sprint). Seconds.
 */
export function idealPaceTime(pace: number, newFeel: boolean): number {
  const p = makePlayer({ id: "t", x: CX, y: PACE_START_Y, skills: skillsOf(50, { pace }), human: true });
  p.newFeel = newFeel;
  const dt = 1 / 120;
  let t = 0;
  while (p.y > PACE_FINISH_Y && t < 30) {
    const y0 = p.y;
    if (newFeel) stepHuman(p, { x: 0, y: -1 }, true, dt); else stepMover(p, { x: 0, y: -1 }, true, dt);
    t += dt;
    if (p.y <= PACE_FINISH_Y) return t - dt * ((PACE_FINISH_Y - p.y) / Math.max(1e-6, y0 - p.y));
  }
  return t;
}

export function starsForTime(time: number, target: number): number {
  return time <= target + STAR_SLACK[0] ? 3 : time <= target + STAR_SLACK[1] ? 2 : time <= target + STAR_SLACK[2] ? 1 : 0;
}

export function makePaceDrill(o: { seed: number; you: { id: string; name: string; skills: Skills3; photo?: string }; level?: number; chaser?: { id: string; name: string; photo?: string } }): { world: World; state: PaceState } {
  const level = Math.max(1, Math.round(o.level ?? 1));
  const lvPace = levelDifficulty(level);
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: true, x: CX, y: PACE_START_Y, facing: -Math.PI / 2, skills: o.you.skills, photo: o.you.photo });
  const side = o.seed % 2 ? 1 : -1;
  const chPace = Math.min(99, lvPace + CHASER_PACE_OVER_LEVEL);
  const chaser = makePlayer({
    id: o.chaser?.id ?? "chaser", name: o.chaser?.name ?? "Defender", team: 1, photo: o.chaser?.photo,
    x: CX + side * CHASER_START.across, y: PACE_START_Y + CHASER_START.behind, facing: -Math.PI / 2,
    skills: skillsOf(Math.round(chPace), { pace: chPace, defending: chPace }),
  });
  const state: PaceState = { level, target: 0, time: 0, finished: false, caught: false, over: false, topSpeed: 0, stars: 0, last: "", chaserName: chaser.name };

  let clockFrom = -1;
  const end = (w: World, line: string) => {
    state.last = line;
    // a beat to see it, then stop the clock
    w.after(1.1, () => { state.over = true; w.frozen = 1e9; });
  };

  const rules: Rules = {
    id: "pace",
    step(w) {
      if (!state.target) state.target = idealPaceTime(lvPace, w.newFeel);
      if (state.finished || state.caught || w.t < PACE_COUNTDOWN) return;
      if (clockFrom < 0 && (speedOf(you) > 0.2 || w.t >= PACE_COUNTDOWN + CLOCK_GRACE)) clockFrom = w.t - (speedOf(you) > 0.2 ? 1 / 120 : 0);
      const t = clockFrom < 0 ? 0 : w.t - clockFrom;
      state.time = t;
      state.topSpeed = Math.max(state.topSpeed, speedOf(you));
      if (you.y <= PACE_FINISH_Y) {
        state.finished = true;
        state.stars = starsForTime(t, state.target);
        end(w, "FINISHED");
        return;
      }
      if (Math.hypot(chaser.x - you.x, chaser.y - you.y) < CATCH_R) {
        state.caught = true;
        chaser.act = "tackle"; chaser.actT = 0;
        end(w, "CAUGHT");
        return;
      }
      if (t > PACE_GIVE_UP) { state.caught = true; end(w, "Too slow"); }
    },
    brain(w, p, dt) {
      if (p !== chaser) return false;
      const t = w.t - PACE_COUNTDOWN;
      if (t < CHASER_REACT || state.finished) {
        stepMover(p, { x: 0, y: 0 }, false, dt, -Math.PI / 2);
        return true;
      }
      if (state.caught) { stepMover(p, { x: 0, y: 0 }, false, dt); return true; }
      // run at where you will be when he gets there (a short look ahead)
      const d = Math.hypot(you.x - p.x, you.y - p.y);
      const lead = Math.min(0.6, d / Math.max(1, topSpeed(p)));
      const tx = you.x + you.vx * lead, ty = you.y + you.vy * lead;
      const dx = tx - p.x, dy = ty - p.y, n = Math.hypot(dx, dy) || 1;
      stepMover(p, { x: dx / n, y: dy / n }, true, dt);
      return true;
    },
    finished: () => state.over,
  };
  const world = new World({ seed: o.seed, players: [you, chaser], rules, goal: undefined });
  world.placeBall(CX + 26, 3);
  world.frozen = PACE_COUNTDOWN;
  // the start and finish lines: a row of rings across
  for (let i = -3; i <= 3; i++) {
    world.markers.push({ x: CX + i * 2, y: PACE_FINISH_Y, r: 0.45, color: "#facc15" });
    world.markers.push({ x: CX + i * 2, y: PACE_START_Y, r: 0.3, color: "#ffffff" });
  }
  return { world, state };
}

/** The countdown word, or "" once it's running. */
export function paceCountdown(w: World): string {
  if (w.t >= PACE_COUNTDOWN + 0.6) return "";
  if (w.t >= PACE_COUNTDOWN) return "GO!";
  return `${Math.ceil((PACE_COUNTDOWN - w.t) / (PACE_COUNTDOWN / 3))}`;
}

export const kmhText = (ms: number) => `${kmh(ms).toFixed(1)} km/h`;
