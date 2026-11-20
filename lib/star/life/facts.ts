/**
 * What the book's conditions can see (living world, phase 1): the career as
 * plain facts, every team-mate as a PersonView, and the condition context.
 */
import type { CareerState, Fixture } from "../types";
import type { LifeState } from "./types";
import type { CondCtx, LifeFacts, PersonView } from "./cond";
import { isNewSigning, lifeWeek, peek, roleOf } from "./people";
import { starLevel } from "../starPoints";
import { divisionOf } from "../calendar";
import { typicalWeeklyWage } from "../economy";

const DIV_LEVEL: Record<string, number> = {
  premier: 1, championship: 2, league_one: 3, league_two: 4, national_league: 5, national_league_north: 6, national_league_south: 6,
};

/** One week of your own money: your wage, never less than half a typical
 *  wage in your division (a trialist on 0 still has a price for things). */
export function weekOfMoney(c: CareerState): number {
  const typical = typicalWeeklyWage(divisionOf(c));
  return Math.max(1, Math.round(Math.max(c.contract?.wage ?? 0, typical * 0.5)));
}

export function carTier(c: CareerState): number {
  let best = 0;
  for (const it of c.ownedItems ?? []) if (it.category === "vehicle") best = Math.max(best, it.level ?? 1);
  return best;
}

/** The last match you played, from the fixtures. */
export function lastMatch(c: CareerState): Fixture | null {
  let best: Fixture | null = null;
  for (const f of c.fixtures ?? []) if (f.played && !f.watch && (!best || f.week >= best.week)) best = f;
  return best;
}

/** A test page or the soak can say what the last match was without playing it. */
export interface FactOverride { lastRating?: number; lastLost?: boolean; lastWon?: boolean; lastGoals?: number }

export function factsOf(c: CareerState, o: FactOverride = {}): LifeFacts {
  const lm = lastMatch(c);
  const us = lm ? (lm.home ? lm.homeScore : lm.awayScore) ?? 0 : 0;
  const them = lm ? (lm.home ? lm.awayScore : lm.homeScore) ?? 0 : 0;
  return {
    num: {
      age: c.player.age, season: c.season, week: c.week, clubApps: c.clubAppearances ?? c.careerStats?.appearances ?? 0,
      fame: c.fame, reputation: c.reputation, energy: c.energy, boss: c.relationships.boss, team: c.relationships.team, fans: c.relationships.fans,
      starLevel: starLevel(c), moneyWeeks: c.money / weekOfMoney(c), carTier: carTier(c), divisionLevel: DIV_LEVEL[divisionOf(c)] ?? 5,
      lastRating: o.lastRating ?? lm?.userRating ?? 6.5, lastGoals: o.lastGoals ?? lm?.userGoals ?? 0,
      seasonGoals: c.seasonStats?.goals ?? 0, matchFitness: c.matchFitness ?? 100,
      overall: Math.round(((c.skills?.pace ?? 50) + (c.skills?.power ?? 50) + (c.skills?.technique ?? 50) + (c.skills?.vision ?? 50)) / 4),
    },
    flag: {
      lastLost: o.lastLost ?? (!!lm && us < them), lastWon: o.lastWon ?? (!!lm && us > them),
      injured: !!c.injury, hasPartner: !!c.girlfriend, captain: !!c.captain,
    },
    owns: {
      car: carTier(c) > 0, horse: !!c.horse,
      house: (c.ownedItems ?? []).some((i) => i.category === "property"),
    },
    position: c.player.position,
  };
}

export function personView(c: CareerState, life: LifeState, id: string, now: number): PersonView | null {
  const rec = peek(life, id);
  if (roleOf(id) === "teammate") {
    const p = (c.squad ?? []).find((s) => s.id === id);
    if (!p) return life.people[id] ? { id, rec, isNew: false, veteran: false } : null;
    return {
      id, rec, age: p.age, overall: p.overall, goals: p.seasonGoals, position: p.position,
      isNew: isNewSigning(life, id, now), veteran: (p.age ?? 0) >= 31,
    };
  }
  return { id, rec, isNew: false, veteran: false };
}

export function squadViews(c: CareerState, life: LifeState, now: number): PersonView[] {
  const out: PersonView[] = [];
  for (const p of c.squad ?? []) {
    const v = personView(c, life, p.id, now);
    if (v) out.push(v);
  }
  return out;
}

export function ctxFor(c: CareerState, life: LifeState, cast: Record<string, string>, facts: LifeFacts, extra: Partial<CondCtx> = {}): CondCtx {
  const now = lifeWeek(c);
  let sq: PersonView[] | null = null;
  return {
    facts, life, cast,
    person: (id) => personView(c, life, id, now),
    squad: () => (sq ??= squadViews(c, life, now)),
    ...extra,
  };
}
