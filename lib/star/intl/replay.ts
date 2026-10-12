/**
 * REPLAY — build the international world from the save's small record and
 * play it forward to a date. Every competition of every confederation is
 * registered for the years the career can reach; only what happens before
 * `until` is played.
 *
 * Cached by the record: asking again with the same record and a later date
 * carries on from where the last replay stopped.
 */
import { World, type WorldInputs } from "./world";
import { nationsLeague, euroCycle } from "./uefa";
import { copaAmerica } from "./conmebol";
import { concacafNationsLeague, goldCup } from "./concacaf";
import { afcon, afconYears } from "./caf";
import { asianCup2027 } from "./afc";
import { ofcNationsCup } from "./ofc";
import { worldCupCycle } from "./worldCup";
import { scheduleFriendlies } from "./friendlies";

/** How far ahead competitions are registered (the career's 20 seasons and a margin). */
export const LAST_YEAR = 2050;

export function newWorld(inputs: WorldInputs): World {
  const w = new World(inputs);
  for (let y = 2026; y <= LAST_YEAR; y += 2) {
    nationsLeague(w, y);
    concacafNationsLeague(w, y);
  }
  for (let y = 2028; y <= LAST_YEAR; y += 4) {
    euroCycle(w, y);
    copaAmerica(w, y);
    ofcNationsCup(w, y);
  }
  for (let y = 2030; y <= LAST_YEAR + 2; y += 4) worldCupCycle(w, y);
  for (let y = 2027; y <= LAST_YEAR; y += 2) goldCup(w, y);
  for (const y of afconYears(LAST_YEAR)) afcon(w, y);
  asianCup2027(w);
  scheduleFriendlies(w, 2026, LAST_YEAR);
  return w;
}

let cache: { key: string; world: World } | null = null;

function keyOf(inputs: WorldInputs): string {
  return JSON.stringify([inputs.firstYear, inputs.xi, inputs.played]);
}

/** The world as it stands at `until` (cached; a later `until` continues). */
export function worldAt(inputs: WorldInputs, until: number): World {
  const key = keyOf(inputs);
  if (!cache || cache.key !== key || cache.world.now > until) {
    cache = { key, world: newWorld(inputs) };
  }
  cache.world.run(until);
  return cache.world;
}
