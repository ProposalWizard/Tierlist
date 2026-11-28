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
import { isDerby } from "../rivalries";
import { clubSlug, TOP26 } from "./unlocks";
import { compSlugs } from "./milestones";

/** The next match on your calendar (not played yet, not a watch-only international). */
export function nextMatch(c: CareerState): Fixture | null {
  let best: Fixture | null = null;
  for (const f of c.fixtures ?? []) if (!f.played && !f.watch && f.week >= c.week && (!best || f.week < best.week)) best = f;
  return best;
}

/** This season is your Nth in a row at the club (1 in your first). */
export function seasonsAtClub(c: CareerState): number {
  const rows = c.seasonHistory ?? [];
  let n = 1;
  for (let i = rows.length - 1; i >= 0 && rows[i].club === c.player.club; i--) if (rows[i].season < c.season) n++;
  return n;
}

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
  const nm = nextMatch(c);
  const club = clubSlug(c.player.club);
  const opps = [lm, nm].filter((f): f is Fixture => !!f);
  return {
    num: {
      age: c.player.age, season: c.season, week: c.week, clubApps: c.clubAppearances ?? c.careerStats?.appearances ?? 0,
      fame: c.fame, reputation: c.reputation, energy: c.energy, boss: c.relationships.boss, team: c.relationships.team, fans: c.relationships.fans,
      starLevel: starLevel(c), moneyWeeks: c.money / weekOfMoney(c), carTier: carTier(c), divisionLevel: DIV_LEVEL[divisionOf(c)] ?? 5,
      lastRating: o.lastRating ?? lm?.userRating ?? 6.5, lastGoals: o.lastGoals ?? lm?.userGoals ?? 0,
      seasonGoals: c.seasonStats?.goals ?? 0, matchFitness: c.matchFitness ?? 100,
      overall: Math.round(((c.skills?.pace ?? 50) + (c.skills?.power ?? 50) + (c.skills?.technique ?? 50) + (c.skills?.vision ?? 50)) / 4),
      caps: c.caps ?? 0,
      // The story world (job B, 28 Nov 2026).
      seasonsAtClub: seasonsAtClub(c), callUps: c.international?.callUps ?? 0, intlGoals: c.internationalGoals ?? 0, ballonDor: c.ballonDorWins ?? 0,
    },
    flag: {
      lastLost: o.lastLost ?? (!!lm && us < them), lastWon: o.lastWon ?? (!!lm && us > them),
      injured: !!c.injury, hasPartner: !!c.girlfriend, captain: !!c.captain,
      // In Europe this season (the place last season's finish earned).
      europe: !!c.europeanQualification,
      // The story world (job B): the last or next match is a derby; in this summer's tournament squad;
      // at one of the 26 clubs with their own hooks (unlocks.ts TOP26).
      derby: opps.some((f) => !!f.derby || isDerby(c.player.club, f.opponent)),
      inTournament: !!c.tournament?.selected && c.tournament.season === c.season,
      clubTop26: TOP26.includes(club),
    },
    owns: {
      car: carTier(c) > 0, horse: !!c.horse,
      house: (c.ownedItems ?? []).some((i) => i.category === "property"),
    },
    position: c.player.position,
    club,
    clubsEver: Array.from(new Set([club, ...(c.seasonHistory ?? []).map((r) => clubSlug(r.club))])),
    opponents: opps.map((f) => clubSlug(f.opponent)),
    trophies: (c.trophies ?? []).map((t) => [compSlugs(t.competition), clubSlug(t.club)] as [string[], string]),
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
