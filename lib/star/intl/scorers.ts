/**
 * WHO SCORED IN THE INTERNATIONAL WORLD (Mikey, 12 Oct 2026: "would it be
 * able to track goal scorers and assists for these matches? … apply them to
 * the total goals or assists for players in the Ballon d'Or").
 *
 * The world (world.ts) plays every national-team match as a score. This
 * names the goals: each nation's squad (squadFor, from the real players the
 * save knows, made-up names in the gaps) goes through the same picker the
 * league uses for matches nobody played (`nameGoals`, leagueSquads.ts):
 * forwards most, centre-halves the odd one, the keeper never, the starting
 * eleven far more than the bench, three goals in four with an assist.
 *
 * Nothing is saved. Every match is seeded off its own id, so the same save
 * always names the same scorers; the totals are worked out again when they
 * are read (about 850 matches a season, ~60 ms, cached).
 *
 * WHICH MATCHES COUNT FOR WHICH NIGHT. The Ballon d'Or night comes when your
 * last fixture is played (usually late May); a summer World Cup or Euro you
 * are not at has not been played yet. So a night counts everything played
 * since the night before (`IntlState.nights`): a tournament you are at counts
 * that night, one you watch from home counts at the next. The same window
 * decides whose nation won a World Cup or Euro.
 *
 * Your own matches: the goals you scored in the real match are yours (kept
 * on the result, `PlayedResult.mine`); the rest of your side's goals are
 * named from the squad, which never includes you.
 */
import type { CareerState, LeaguePlayer, LeagueSquad, SquadPlayer } from "../types";
import { nameGoals, type SimGoal } from "../leagueSquads";
import { mulberry32 } from "../season";
import { intlOf, worldOf, squadFor, realPlayers, ballonDorYearStart, TOURNAMENT_COMPS, type PoolPlayer } from "./career";
import { type WorldMatch, type CompKind } from "./world";
import { nationFor } from "./nations";

/** One player's international season. */
export interface IntlTally { name: string; nation: string; goals: number; assists: number; real: boolean; position: string; image?: string }

export interface IntlSeason {
  season: number;
  /** `${nation}|${name}` → tally (made-up players included, `real: false`). */
  players: Map<string, IntlTally>;
  /** Match id → named goals, home side then away side. */
  goals: Map<string, { home: SimGoal[]; away: SimGoal[] }>;
  /** Your own goals and assists for your country this season. */
  you: { goals: number; assists: number };
  /** World Cup / Euro won this season: nation → competition. */
  champions: Map<string, CompKind>;
  /** The winners' tournament squads (26), by `${nation}|${name}`. */
  championSquads: Set<string>;
}

/** The trophies a nation's players take into the Ballon d'Or. */
export const BALLON_DOR_NATION_TROPHIES: CompKind[] = ["World Cup", "European Championship"];

export const tallyKey = (nation: string, name: string) => `${nation}|${name}`;

/** A nation's squad, starting eleven first (4-3-3), so the picker's bench
 *  discount (index 11 on) falls on the right men. */
const XI: SquadPlayer["position"][] = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"];

function asLeagueSquad(nation: string, squad: SquadPlayer[]): LeagueSquad {
  const left = [...squad];
  const xi: SquadPlayer[] = [];
  for (const pos of XI) {
    const i = left.findIndex((p) => p.position === pos);
    if (i >= 0) xi.push(left.splice(i, 1)[0]);
  }
  const players: LeaguePlayer[] = [...xi, ...left].map((p) => ({
    id: p.id, name: p.name, position: p.position, overall: p.overall ?? 65, goals: 0, assists: 0,
    image: p.imageUrl, nation, age: p.age, positions: p.positions,
  }));
  return { club: nation, players } as LeagueSquad;
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

let cache: { key: unknown[]; value: IntlSeason } | null = null;

/**
 * The international season `season` (default: the current one) as far as
 * the world has been played: every goal named, every player's total.
 */
export function intlSeason(career: CareerState, season = career.season): IntlSeason {
  const s = intlOf(career);
  const w = worldOf(career);
  const key = [career.leagueSquads, career.externalSquads, career.squad, s.played, s.xi, s.nights, season, w.now, s.nation];
  if (cache && cache.key.length === key.length && cache.key.every((k, i) => k === key[i])) return cache.value;

  const everyone: PoolPlayer[] = realPlayers(career);
  const realByNation = new Map<string, Set<string>>();
  for (const p of everyone) {
    const set = realByNation.get(p.nation) ?? new Set<string>();
    set.add(p.name); realByNation.set(p.nation, set);
  }
  const squads = new Map<string, LeagueSquad>();
  const squad = (nation: string, size: 23 | 26) => {
    const k = `${nation}|${size}`;
    let sq = squads.get(k);
    if (!sq) {
      sq = asLeagueSquad(nation, squadFor(career, nation, size, everyone));
      squads.set(k, sq);
    }
    return sq;
  };

  const players = new Map<string, IntlTally>();
  const goals = new Map<string, { home: SimGoal[]; away: SimGoal[] }>();
  const you = { goals: 0, assists: 0 };
  const credit = (nation: string, sq: LeagueSquad, before: Map<string, [number, number]>) => {
    for (const p of sq.players) {
      const [g0, a0] = before.get(p.id) ?? [0, 0];
      const dg = p.goals - g0, da = p.assists - a0;
      if (!dg && !da) continue;
      const k = tallyKey(nation, p.name);
      const t = players.get(k) ?? { name: p.name, nation, goals: 0, assists: 0, real: !!realByNation.get(nation)?.has(p.name), position: p.position, image: p.image };
      t.goals += dg; t.assists += da;
      players.set(k, t);
    }
  };

  const from = ballonDorYearStart(career, season);
  const to = season === career.season ? w.now : (s.nights?.[season] ?? w.now);
  const ofSeason = (m: WorldMatch) => m.hs != null && m.date >= from && m.date <= to;
  for (const m of w.matches) {
    if (!ofSeason(m)) continue;
    const size = TOURNAMENT_COMPS.includes(m.comp) ? 26 : 23;
    const rng = mulberry32(seedOf(m.id));
    const mine = s.played[m.id]?.mine;
    const side = (nation: string, count: number) => {
      const sq = squad(nation, size);
      let n = count;
      if (mine && nation === s.nation) {
        // The goals you scored in the real match are yours; the rest are
        // named from the squad (which never includes you).
        you.goals += mine.g; you.assists += mine.a;
        n = Math.max(0, count - mine.g);
      }
      const before = new Map(sq.players.map((p) => [p.id, [p.goals, p.assists] as [number, number]]));
      const named = nameGoals(sq, n, rng);
      credit(nation, sq, before);
      return named;
    };
    goals.set(m.id, { home: side(m.home, m.hs!), away: side(m.away, m.as!) });
  }

  // World Cup / Euro winners this season: the 26 who won it.
  const champions = new Map<string, CompKind>();
  const championSquads = new Set<string>();
  for (const f of w.finals) {
    if (!BALLON_DOR_NATION_TROPHIES.includes(f.comp)) continue;
    const last = w.matches.filter((m) => m.edition === f.edition && m.hs != null).reduce((t, m) => Math.max(t, m.date), -Infinity);
    if (!(last >= from && last <= to)) continue;
    champions.set(f.winner, f.comp);
    for (const p of squad(f.winner, 26).players) championSquads.add(tallyKey(f.winner, p.name));
  }

  const value: IntlSeason = { season, players, goals, you, champions, championSquads };
  cache = { key, value };
  return value;
}

/** A player's international goals and assists this season, by his club-squad
 *  record (nation spelling as the save has it). */
export function intlTallyOf(season: IntlSeason, nation: string | undefined, name: string): { goals: number; assists: number } {
  const n = nation ? nationFor(nation)?.name : undefined;
  if (!n) return { goals: 0, assists: 0 };
  const t = season.players.get(tallyKey(n, name));
  return t ? { goals: t.goals, assists: t.assists } : { goals: 0, assists: 0 };
}

/** The top international scorers this season (real players first in ties). */
export function topIntlScorers(season: IntlSeason, n = 10): IntlTally[] {
  return Array.from(season.players.values())
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || Number(b.real) - Number(a.real))
    .slice(0, n);
}

/** Who scored in one match, for a results row: "Kane 23'", and your own
 *  goals as "You" (the real match keeps no minutes for them here). */
export function scorerLines(career: CareerState, season: IntlSeason, matchId: string, home: string): { home: string[]; away: string[] } | null {
  const g = season.goals.get(matchId);
  if (!g) return null;
  const s = intlOf(career);
  const mine = s.played[matchId]?.mine;
  const line = (xs: SimGoal[]) => [...xs].sort((a, b) => a.m - b.m).map((x) => `${x.s} ${x.m}'`);
  const you = mine && mine.g > 0 ? [mine.g > 1 ? `You ×${mine.g}` : "You"] : [];
  const homeIsYou = home === s.nation;
  return {
    home: [...(homeIsYou ? you : []), ...line(g.home)],
    away: [...(!homeIsYou && mine ? you : []), ...line(g.away)],
  };
}
