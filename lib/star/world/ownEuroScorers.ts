import type { CareerState, LeagueSquad } from "../types";
import type { EuroState } from "../euro";
import { mulberry32 } from "../season";
import { pickGoalIds } from "../leagueSquads";
import { shortNameOf } from "../realSquad";
import type { ScorerRow } from "./summary";

/**
 * THE TOP SCORERS OF THE EUROPEAN COMPETITION YOU ARE IN (Mikey, 2 Nov 2026:
 * "fix the scorers for your own competition too"). Pure, worked out when read.
 *
 *  · League phase: every match's named goals are already kept on
 *    `euroState.results` (simulateEuroMatchday), your own matches with the
 *    real scorers, you included. Counted straight off them.
 *  · Knockout: the bracket keeps only scores, so each leg's goals are named
 *    here, seeded per tie (the same names every time it is opened). In your
 *    own ties, your goals and assists come from your fixtures; the rest of
 *    your side's goals are named from your team-mates.
 *
 * Names are the short names the results already use ("Haaland").
 */
export function ownEuroScorers(career: CareerState, state: EuroState, n = 10): { goals: ScorerRow[]; assists: ScorerRow[] } {
  const goals = new Map<string, ScorerRow>();
  const assists = new Map<string, ScorerRow>();
  const add = (m: Map<string, ScorerRow>, club: string, player: string, k = 1) => {
    if (k <= 0 || !player) return;
    const id = `${club}|${player}`;
    const r = m.get(id) ?? { id, player, club, n: 0 };
    r.n += k;
    m.set(id, r);
  };

  const you = career.player.club;
  const yourName = career.player.lastName;
  const squads = new Map<string, LeagueSquad>();
  for (const s of career.externalSquads ?? []) squads.set(s.club, s);
  for (const s of career.leagueSquads ?? []) squads.set(s.club, s);
  const named = (club: string, count: number, rng: () => number) => {
    for (const g of pickGoalIds(squads.get(club), count, rng)) {
      add(goals, club, shortNameOf(g.name));
      if (g.assist) add(assists, club, shortNameOf(g.assist));
    }
  };
  const yourFixtures = (career.fixtures ?? []).filter(f => f.played && f.kind === "europe" && f.competition === state.competition);

  for (const r of state.results ?? []) {
    for (const [club, list, score] of [[r.home, r.hg, r.hs], [r.away, r.ag, r.as]] as const) {
      for (const g of list ?? []) {
        add(goals, club, g.s);
        if (g.a) add(assists, club, g.a);
      }
      // A match whose goals were not all named (yours, when the match kept no
      // goal list): your own from the fixture first, then your team-mates.
      const missing = score - (list?.length ?? 0);
      if (missing > 0) {
        const rng = mulberry32(seedOf(`${career.season}|${state.competition}|MD${r.week}|${club}`));
        if (club === you) {
          const f = yourFixtures.find(x => x.round === `League Phase · MD${r.week}`);
          const namedYou = (list ?? []).filter(g => g.s === yourName).length;
          const yoursHere = Math.max(0, Math.min(missing, (f?.userGoals ?? 0) - namedYou));
          add(goals, club, yourName, yoursHere);
          const namedYourAssists = (list ?? []).filter(g => g.a === yourName).length;
          add(assists, club, yourName, Math.max(0, (f?.userAssists ?? 0) - namedYourAssists));
          named(club, missing - yoursHere, rng);
        } else named(club, missing, rng);
      }
    }
  }

  for (const round of state.bracket?.rounds ?? []) {
    for (const t of round.ties) {
      if (!t.a || !t.b || !t.legs.length) continue;
      const rng = mulberry32(seedOf(`${career.season}|${state.competition}|${round.name}|${t.a}|${t.b}`));
      const yours = t.a === you || t.b === you;
      // Your own goals and assists in this round, from your fixtures.
      const mine = yours
        ? yourFixtures.filter(f => f.round?.startsWith(round.name))
            .reduce((s, f) => ({ g: s.g + (f.userGoals ?? 0), a: s.a + (f.userAssists ?? 0) }), { g: 0, a: 0 })
        : { g: 0, a: 0 };
      let yourSideLeft = mine.g;
      for (const leg of t.legs) {
        for (const [club, count] of [[t.a, leg.a], [t.b, leg.b]] as const) {
          if (club === you) {
            const yoursHere = Math.min(count, yourSideLeft);
            yourSideLeft -= yoursHere;
            add(goals, club, yourName, yoursHere);
            named(club, count - yoursHere, rng);
          } else named(club, count, rng);
        }
      }
      if (mine.a) add(assists, you, yourName, mine.a);
    }
  }

  const top = (m: Map<string, ScorerRow>) => Array.from(m.values()).sort((a, b) => b.n - a.n || a.player.localeCompare(b.player)).slice(0, n);
  return { goals: top(goals), assists: top(assists) };
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
