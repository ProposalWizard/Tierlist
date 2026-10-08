/**
 * THE 3D TRAINING DRILLS — one list. The training gate's picker reads it,
 * "Random drill" picks from it, the dev page opens any of it.
 *
 * Adding a drill (Headers & Volleys, Wembley …):
 *   1. write its rules as a `Rules` on a `World` (./world.ts) in its own file,
 *      like ./twoTouch.ts or ./freeRoam.ts — scoring, restarts, any special
 *      touch (Rules.onReach / onAction) or brain (Rules.brain);
 *   2. give it a `start` here returning a DrillSession (HUD lines, result);
 *   3. flip its status to "ready".
 * The screen (components/star/Play3D.tsx) and the 3D picture
 * (./scene.ts) need nothing new unless the drill wants a new camera.
 */
import type { Rng } from "./rng";
import type { Action3, World } from "./world";
import { makeFreeRoam, freeRoamReward, freeRoamScore, FREE_ROAM_TARGET, type Person3 } from "./freeRoam";
import { makeTwoTouch, twoTouchReward, TWO_TOUCH_RALLIES, TWO_TOUCH_TARGET } from "./twoTouch";

export type DrillId = "crossbar" | "two-touch" | "free-roam" | "headers-volleys" | "wembley";

export interface DrillContext {
  seed: number;
  you: Person3;
  /** Real team-mates from the career squad (best first is fine). */
  mates: Person3[];
  keeperOverall?: number;
}

export interface DrillSession {
  world: World;
  /** "chase": behind you, turning with you. "pair": side-on, you and your partner both in shot. */
  camera: "chase" | "pair";
  /** One line, on screen while playing. */
  hint: string;
  /** Extra buttons beyond tap / drag (e.g. "Send it back"). */
  buttons?: { label: string; action: Action3 }[];
  /** The scoreboard: a big number, a line under it, seconds left if timed. */
  hud(): { big: string; small: string; timeLeft?: number; flash?: string };
  done(): boolean;
  /** The Team bar move, the crossbar's way (relationships.ts gameReward). */
  result(team: number, roll: number): { won: boolean; gain: number; line: string };
}

export interface DrillDef {
  id: DrillId;
  name: string;
  blurb: string;
  status: "ready" | "soon";
  /** "engine": your shots on the 2D match engine (the crossbar). "play3d": the 3D engine here. */
  kind: "engine" | "play3d";
  start?(ctx: DrillContext): DrillSession;
}

export const DRILLS: DrillDef[] = [
  { id: "crossbar", name: "Crossbar Challenge", blurb: "Five shots each at the bar. A post doesn't count.", status: "ready", kind: "engine" },
  {
    id: "two-touch", name: "Two Touch", blurb: "Keep it up between you. Two touches each, then send it back.", status: "ready", kind: "play3d",
    start(ctx) {
      const mate = ctx.mates[0] ?? { id: "mate", name: "Team-mate", skills: { overall: 65, pace: 65, power: 65, technique: 65 } };
      const { world, state } = makeTwoTouch({ seed: ctx.seed, you: ctx.you, mate });
      return {
        world, camera: "pair",
        hint: "Tap as the ball drops to your foot: 1st tap controls it up, 2nd sends it back.",
        buttons: [{ label: "Send it back first time", action: { kind: "pass" } }],
        hud: () => ({ big: `${state.rally}`, small: `Rally · best ${state.longest} · ${state.ralliesLeft} of ${TWO_TOUCH_RALLIES} left`, flash: state.last }),
        done: () => state.over,
        result(team, roll) {
          const r = twoTouchReward(state, team, roll);
          return { ...r, line: `Longest rally with ${mate.name}: ${state.longest} (${TWO_TOUCH_TARGET} wins it).` };
        },
      };
    },
  },
  {
    id: "free-roam", name: "Free Roam", blurb: "Half a pitch, a keeper and two team-mates. Pass, get it back, score.", status: "ready", kind: "play3d",
    start(ctx) {
      const { world, state } = makeFreeRoam({ seed: ctx.seed, you: ctx.you, mates: ctx.mates.slice(0, 2), keeperOverall: ctx.keeperOverall });
      return {
        world, camera: "chase",
        hint: "Left thumb: move. Tap: pass (or call for it). Drag back and let go: shoot.",
        hud: () => ({ big: `${freeRoamScore(state)}`, small: `${state.goals} goals · ${state.cleanPasses} clean passes`, timeLeft: state.timeLeft, flash: state.last }),
        done: () => state.over,
        result(team, roll) {
          const r = freeRoamReward(state, team, roll);
          return { won: r.won, gain: r.gain, line: `${state.goals} goals and ${state.cleanPasses} clean passes: ${r.score} (${FREE_ROAM_TARGET} wins it).` };
        },
      };
    },
  },
  { id: "headers-volleys", name: "Headers & Volleys", blurb: "Live balls in from the full-backs. Coming next.", status: "soon", kind: "play3d" },
  { id: "wembley", name: "Wembley", blurb: "Score and go through. Coming next.", status: "soon", kind: "play3d" },
];

export function drillById(id: string): DrillDef | undefined { return DRILLS.find((d) => d.id === id); }

/** "Random drill": any ready one, evenly. */
export function pickRandomDrill(rng: Rng): DrillDef {
  const ready = DRILLS.filter((d) => d.status === "ready");
  return ready[Math.floor(rng() * ready.length) % ready.length];
}

