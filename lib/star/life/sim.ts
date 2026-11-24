/**
 * A week of the living world without the football (the test page and the
 * soak's shape): the week turns, a result is rolled, and the director looks at
 * each moment in a week's order. `choose` picks a choice for each event that
 * fires (the test page's "lived-in" sample picks at random).
 */
import type { CareerState } from "../types";
import type { LifeMoment } from "./types";
import { dropStale, pickEvent, startEvent } from "./director";
import { chooseOption } from "./resolve";
import { chat } from "./social";
import type { FactOverride } from "./facts";
import { weekOfMoney } from "./facts";
import { carTier } from "./facts";

export const SEASON_WEEKS = 46;

/** The moments of one week, in order. */
export function weekMoments(c: CareerState): LifeMoment[] {
  const m: LifeMoment[] = ["walkout", "after-match", "arrive:training", "home:evening"];
  if (carTier(c) > 0) m.push("driving");
  if (c.week >= SEASON_WEEKS) m.push("season-end");
  return m;
}

/** Turn the week: a new week, the days back, a week's wage (most of it spent on living). */
export function turnWeek(c: CareerState, rng: () => number): CareerState {
  const end = c.week >= SEASON_WEEKS;
  const next: CareerState = {
    ...c,
    week: end ? 1 : c.week + 1,
    season: end ? c.season + 1 : c.season,
    player: end ? { ...c.player, age: c.player.age + 1 } : c.player,
    weekActions: 3,
    money: c.money + Math.round(weekOfMoney(c) * 0.3),
    energy: Math.max(10, Math.min(100, Math.round(c.energy + (rng() - 0.5) * 30))),
    clubAppearances: (c.clubAppearances ?? 0) + 1,
  };
  return dropStale(next).career;
}

export function rollMatch(rng: () => number): FactOverride {
  const won = rng() < 0.45;
  const lost = !won && rng() < 0.6;
  return { lastWon: won, lastLost: lost, lastRating: Math.round((5 + rng() * 4) * 10) / 10, lastGoals: rng() < 0.3 ? 1 : 0 };
}

/** Play `weeks` weeks with random choices and the odd chat (a lived-in career). */
export function autoPlay(c0: CareerState, weeks: number, rng: () => number): CareerState {
  let c = c0;
  for (let w = 0; w < weeks; w++) {
    c = turnWeek(c, rng);
    const facts = rollMatch(rng);
    for (const m of weekMoments(c)) {
      const live = pickEvent(c, m, { rng, facts });
      if (!live) continue;
      c = startEvent(c, live);
      const open = live.choices.filter((x) => !x.locked);
      if (!open.length) continue;
      const r = chooseOption(c, live, open[Math.floor(rng() * open.length)].id, { rng, facts });
      if (r) c = r.career;
    }
    const mate = c.squad[Math.floor(rng() * c.squad.length)];
    if (mate && rng() < 0.6) { const r = chat(c, mate.id, rng, facts); if (r) c = r.career; }
  }
  return c;
}
