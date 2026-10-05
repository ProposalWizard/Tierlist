import { POST_L, GOAL_W, GOAL_H } from "./pitch";

/**
 * THE MANAGER'S TARGET PENALTIES — the boss's relationship game (Mikey,
 * 5 Oct 2026). Replaces "Talk to your manager" (bossChat.ts): any
 * choose-the-right-reply game can be learnt; this one is a skill test.
 *
 * Three penalties at an empty goal. Before each one the manager, standing
 * beside you, names one of six spots. Put it anywhere inside that sixth of
 * the goal and it counts. +2 to the boss bar for each hit; no hits at all
 * costs 2.
 *
 * Pure: the screen is components/star/relgames/BossPenalties.tsx, played on
 * the real match engine (EngineFeature).
 */

export type Spot = "top-left" | "top-middle" | "top-right" | "bottom-left" | "bottom-middle" | "bottom-right";
export const SPOTS: Spot[] = ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"];
export const BOSS_KICKS = 3;
export const BOSS_GAIN_PER_HIT = 2;
export const BOSS_NO_HITS = -2;

export const SPOT_LABEL: Record<Spot, string> = {
  "top-left": "top left", "top-middle": "top middle", "top-right": "top right",
  "bottom-left": "bottom left", "bottom-middle": "bottom middle", "bottom-right": "bottom right",
};

/** Which spot a ball crossing the goal line at (x, z) is in — from the
 *  shooter's view, left is the left post. null when it isn't in the goal. */
export function spotOf(x: number, z: number): Spot | null {
  const f = (x - POST_L) / GOAL_W;
  if (f < 0 || f > 1 || z < 0 || z > GOAL_H) return null;
  const col = f < 1 / 3 ? "left" : f < 2 / 3 ? "middle" : "right";
  const row = z >= GOAL_H / 2 ? "top" : "bottom";
  return `${row}-${col}` as Spot;
}

/** The centre of a spot, in pitch metres (for drawing its target). */
export function spotCentre(s: Spot): { x: number; z: number } {
  const [row, col] = s.split("-");
  const ci = col === "left" ? 0 : col === "middle" ? 1 : 2;
  return { x: POST_L + GOAL_W * (ci + 0.5) / 3, z: row === "top" ? GOAL_H * 0.75 : GOAL_H * 0.25 };
}

/** The three spots he asks for: never the same spot twice in a row. */
export function pickSpots(rng: () => number): Spot[] {
  const out: Spot[] = [];
  while (out.length < BOSS_KICKS) {
    const s = SPOTS[Math.floor(rng() * SPOTS.length)];
    if (s !== out[out.length - 1]) out.push(s);
  }
  return out;
}

/** What the boss bar moves by. */
export function bossGain(hits: number): number {
  return hits > 0 ? hits * BOSS_GAIN_PER_HIT : BOSS_NO_HITS;
}

/** What he says before each kick. */
export function askLine(s: Spot, kick: number, rng: () => number): string {
  const where = SPOT_LABEL[s];
  const lines = kick === 0
    ? [`Show me. ${cap(where)} corner.`, `Let's see it. Put it ${where}.`, `First one: ${where}.`]
    : [`Now ${where}.`, `Next: ${where}. Don't think about it.`, `${cap(where)}. Go on.`];
  return lines[Math.floor(rng() * lines.length)].replace("middle corner", "middle");
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
