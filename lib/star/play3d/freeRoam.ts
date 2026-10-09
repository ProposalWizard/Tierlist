/**
 * FREE ROAM — half a pitch, a goal and a keeper, you and two team-mates.
 * Move with the ball, pass, get it back, shoot. Two minutes.
 * Score = goals + clean passes (a pass your team-mate, or you, controls
 * cleanly first time).
 */
import { CX } from "./constants";
import { makePlayer, skillsOf, type P3, type Skills3 } from "./player";
import { World, type Rules } from "./world";
import { gameReward } from "../relationships";

export const FREE_ROAM_SECONDS = 120;
/** A score of this or more is a good session (wins the Team bar). Reasoned, not measured on people yet. */
export const FREE_ROAM_TARGET = 10;

export interface Person3 { id: string; name: string; skills: Skills3; photo?: string; /** His squad position (LB, RB …) where known. */ position?: string }

export interface FreeRoamState {
  goals: number;
  cleanPasses: number;
  shots: number;
  timeLeft: number;
  over: boolean;
  last: string;
}

export function freeRoamScore(s: FreeRoamState) { return s.goals + s.cleanPasses; }

export function makeFreeRoam(o: { seed: number; you: Person3; mates: Person3[]; keeperOverall?: number }): { world: World; state: FreeRoamState } {
  const state: FreeRoamState = { goals: 0, cleanPasses: 0, shots: 0, timeLeft: FREE_ROAM_SECONDS, over: false, last: "" };
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: true, x: CX, y: 30, skills: o.you.skills, photo: o.you.photo });
  const mates = o.mates.slice(0, 2).map((m, i) =>
    makePlayer({ id: m.id, name: m.name, x: i ? 46 : 22, y: 25, skills: m.skills, photo: m.photo, mind: { brain: "support", lane: i ? 1 : -1 } }));
  const keeper = makePlayer({ id: "keeper", name: "Keeper", team: 1, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(o.keeperOverall ?? 66) });

  const kickOff = (w: World) => {
    const r = w.rng;
    you.x = CX + (r() - 0.5) * 16; you.y = 30 + r() * 4; you.facing = -Math.PI / 2; you.vx = you.vy = 0;
    mates.forEach((m, i) => { m.x = i ? 46 : 22; m.y = 24 + r() * 4; m.vx = m.vy = 0; m.facing = -Math.PI / 2; });
    keeper.x = CX; keeper.y = 1; keeper.mind = {}; keeper.dive = undefined;
    w.placeBall(you.x, you.y - 0.5, you.id);
  };

  const rules: Rules = {
    id: "free-roam",
    step(w, dt) {
      if (state.over) return;
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) { state.over = true; w.frozen = 1e9; state.last = "Time"; }
    },
    onEvent(w, e) {
      if (state.over) return;
      if (e.kind === "shot" || e.kind === "volley" || e.kind === "header") { if (e.who !== keeper.id) state.shots++; }
      if (e.kind === "clean-pass") { state.cleanPasses++; state.last = "Clean pass"; }
      if (e.kind === "goal") {
        state.goals++;
        state.last = e.who === you.id ? "GOAL!" : `GOAL — ${w.get(e.who)?.name ?? ""}`;
        w.frozen = 1.6;
        w.after(1.6, () => kickOff(w));
      }
      if (e.kind === "save") state.last = "Saved";
      if (e.kind === "out" || e.kind === "byline") {
        state.last = e.kind === "byline" ? "Wide" : "Out";
        w.frozen = 1;
        w.after(1, () => kickOff(w));
      }
    },
    throwTarget(w) {
      const pool = mates.filter((m) => m.active);
      return pool.length ? pool[Math.floor(w.rng() * pool.length)] : you;
    },
    finished: () => state.over,
    stamina: true,
  };
  const world = new World({ seed: o.seed, players: [you, ...mates, keeper], rules });
  kickOff(world);
  return { world, state };
}

export function freeRoamReward(s: FreeRoamState, team: number, roll: number) {
  const score = freeRoamScore(s);
  const won = score >= FREE_ROAM_TARGET;
  return { won, gain: gameReward(won, team, roll, "team"), score };
}
