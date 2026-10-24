/**
 * WHO SCORED IN THE CUPS (Mikey, 23 Oct 2026: "why don't any of those have
 * goals and assists?"). A cup tie keeps only its score, so its scorers are
 * named here, when the League page asks: each tie from its own seed (season,
 * competition, round, the two clubs), so the same tie always names the same
 * men. Clubs with no squad in the save name nobody. Your own goals are not
 * kept per match, so they are not counted here. Pure.
 */
import type { CareerState, LeagueSquad } from "../types";
import { mulberry32 } from "../season";
import { pickGoalIds } from "../leagueSquads";
import type { ScorerRow } from "./summary";

export interface CupGame { round: string; home: string; away: string; hs?: number; as?: number }

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function squadLookup(career: CareerState): (club: string) => LeagueSquad | undefined {
  const m = new Map<string, LeagueSquad>();
  for (const s of career.externalSquads ?? []) m.set(s.club, s);
  for (const s of career.leagueSquads ?? []) m.set(s.club, s);
  return (club) => m.get(club);
}

/** The top scorers and assisters of a cup's played games, best first. */
export function cupScorers(career: CareerState, competition: string, games: CupGame[], n = 10): { goals: ScorerRow[]; assists: ScorerRow[] } {
  const squadOf = squadLookup(career);
  const g = new Map<string, ScorerRow>(), a = new Map<string, ScorerRow>();
  const add = (m: Map<string, ScorerRow>, id: string, player: string, club: string) => {
    const r = m.get(id) ?? { id, player, club, n: 0 };
    r.n += 1; m.set(id, r);
  };
  for (const t of games) {
    if (t.hs === undefined || t.as === undefined) continue;
    const rng = mulberry32(seedOf(`${career.season}|${competition}|${t.round}|${t.home}|${t.away}`));
    for (const [club, count] of [[t.home, t.hs], [t.away, t.as]] as const) {
      for (const goal of pickGoalIds(squadOf(club), count, rng)) {
        add(g, goal.id, goal.name, club);
        if (goal.assistId && goal.assist) add(a, goal.assistId, goal.assist, club);
      }
    }
  }
  const top = (m: Map<string, ScorerRow>) => Array.from(m.values()).sort((x, y) => y.n - x.n || x.player.localeCompare(y.player)).slice(0, n);
  return { goals: top(g), assists: top(a) };
}
