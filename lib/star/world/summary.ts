import type { CareerState, LeagueTeam } from "../types";
import { sortLeague } from "../season";
import { ALL_DIVISIONS, divisionOf, leagueNameFor, type CareerDivision } from "../calendar";
import { sortEuro, type EuroStanding } from "../euro";
import type { LadderOutcome } from "../promotion";
import type { CompLeaders, ScorerCounts, WorldState, WorldSummary } from "./types";
import { cupScorers, type CupGame } from "./cupScorers";
import type { CupState } from "../cups";
import { koAggregate, type EuroBracket } from "../euroBracket";
import { ownEuroScorers } from "./ownEuroScorers";

/**
 * Names for the world's scorer counts, and last season kept whole after the
 * rollover (`career.lastWorld`). Pure.
 */

export interface ScorerRow { id: string; player: string; club: string; n: number }

const indexCache = new WeakMap<object, Map<string, { name: string; club: string }>>();
/** Every player the career holds, by id: who he is and where he is now. */
export function playerIndex(career: CareerState): Map<string, { name: string; club: string }> {
  const hit = indexCache.get(career as object);
  if (hit) return hit;
  const m = new Map<string, { name: string; club: string }>();
  for (const sq of [...(career.externalSquads ?? []), ...(career.leagueSquads ?? [])]) {
    for (const p of sq.players) m.set(p.id, { name: p.name, club: sq.club });
  }
  indexCache.set(career as object, m);
  return m;
}

/** The top `n` by goals (which = 0) or assists (which = 1). */
export function topOf(career: CareerState, counts: ScorerCounts, which: 0 | 1, n = 10): ScorerRow[] {
  const idx = playerIndex(career);
  return Object.entries(counts)
    .filter(([, c]) => c[which] > 0)
    .map(([id, c]) => ({ id, player: idx.get(id)?.name ?? "Unknown", club: idx.get(id)?.club ?? "", n: c[which] }))
    .sort((a, b) => b.n - a.n || a.player.localeCompare(b.player))
    .slice(0, n);
}

/** Your own league's scorers: the squads' league tallies (playLeagueWeek). */
export function ownLeagueTop(career: CareerState, which: 0 | 1, n = 10): ScorerRow[] {
  const rows: ScorerRow[] = [];
  for (const sq of career.leagueSquads ?? []) {
    for (const p of sq.players) {
      const v = which === 0 ? p.goals : p.assists;
      if (v > 0) rows.push({ id: p.id, player: p.name, club: sq.club, n: v });
    }
  }
  return rows.sort((a, b) => b.n - a.n || a.player.localeCompare(b.player)).slice(0, n);
}


// ── History leaders (Mikey, 2 Nov 2026) ─────────────────────────────────────

type Named = { player: string; club: string; n: number };

/** The leader and anyone level with him (at most three), or none. */
export function levelTop(rows: Named[]): Named[] {
  const top = rows[0]?.n ?? 0;
  if (top <= 0) return [];
  return rows.filter(r => r.n === top).slice(0, 3).map(r => ({ player: r.player, club: r.club, n: r.n }));
}

/** Most goals + assists (then goals, then name) from a competition's counts. */
export function bestOfCounts(career: CareerState, counts: ScorerCounts): { player: string; club: string } | undefined {
  const idx = playerIndex(career);
  let best: { id: string; ga: number; g: number; name: string } | null = null;
  for (const [id, [g, a]] of Object.entries(counts)) {
    const name = idx.get(id)?.name;
    if (!name || g + a <= 0) continue;
    if (!best || g + a > best.ga || (g + a === best.ga && (g > best.g || (g === best.g && name < best.name)))) best = { id, ga: g + a, g, name };
  }
  return best ? { player: best.name, club: idx.get(best.id)?.club ?? "" } : undefined;
}

/** The best player in a cup's final: most goals + assists in it, the winners first. */
function bestInFinal(career: CareerState, competition: string, final: CupGame | undefined, winner?: string): { player: string; club: string } | undefined {
  if (!final) return undefined;
  const sc = cupScorers(career, competition, [final], 30);
  const m = new Map<string, { player: string; club: string; g: number; a: number }>();
  const at = (r: ScorerRow) => { const k = `${r.club}|${r.player}`; return m.get(k) ?? m.set(k, { player: r.player, club: r.club, g: 0, a: 0 }).get(k)!; };
  for (const r of sc.goals) at(r).g += r.n;
  for (const r of sc.assists) at(r).a += r.n;
  const rows = Array.from(m.values()).sort((x, y) =>
    (y.g + y.a) - (x.g + x.a) || Number(y.club === winner) - Number(x.club === winner) || y.g - x.g || x.player.localeCompare(y.player));
  return rows[0] ? { player: rows[0].player, club: rows[0].club } : undefined;
}

/** Your own league's leaders: the Season Awards' winners when they are this season's. */
function ownLeagueLeaders(career: CareerState, name: string): CompLeaders {
  const aw = career.lastSeasonAwardStats;
  const fresh = aw && aw.season === career.season && aw.leagueName === name ? aw : null;
  const one = (w: { name: string; club: string; value: number } | null | undefined) => (w && w.value > 0 ? [{ player: w.name, club: w.club, n: w.value }] : []);
  const strip = (r: ScorerRow) => ({ player: r.player, club: r.club, n: r.n });
  const scorers = fresh?.goldenBoot ? one(fresh.goldenBoot) : levelTop(ownLeagueTop(career, 0).map(strip));
  const assisters = fresh?.assistKing ? one(fresh.assistKing) : levelTop(ownLeagueTop(career, 1).map(strip));
  let best: CompLeaders["best"];
  if (fresh?.playerOfSeason) best = { player: fresh.playerOfSeason.name, club: fresh.playerOfSeason.club };
  else {
    const rows: { player: string; club: string; ga: number; g: number }[] = [];
    for (const sq of career.leagueSquads ?? []) for (const p of sq.players) if (p.goals + p.assists > 0) rows.push({ player: p.name, club: sq.club, ga: p.goals + p.assists, g: p.goals });
    rows.sort((x, y) => y.ga - x.ga || y.g - x.g || x.player.localeCompare(y.player));
    if (rows[0]) best = { player: rows[0].player, club: rows[0].club };
  }
  return { competition: name, scorers, assisters, ...(best ? { best } : {}) };
}

const euroRows = (rows: EuroStanding[]): LeagueTeam[] => sortEuro(rows).map(r => ({
  name: r.name, strength: 0, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
  goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points,
}));

/** The season just played, whole, for after the rollover. */
export function summariseWorld(
  career: CareerState, world: WorldState | null, ladder: LadderOutcome | null,
  winners: { competition: string; club: string }[],
  /** Your own cups, played to their finals (careerFlow finishedCupsOf). */
  cups: CupState[] = [],
): WorldSummary {
  const yours = divisionOf(career);
  const tables: WorldSummary["tables"] = [];
  const scorers: WorldSummary["scorers"] = [];
  const leaders: CompLeaders[] = [];
  const strip = (r: { player: string; club: string; n: number }) => ({ player: r.player, club: r.club, n: r.n });
  for (const d of ALL_DIVISIONS) {
    const name = leagueNameFor(d);
    if (d === yours) {
      tables.push({ name, division: d, rows: sortLeague(career.league) });
      scorers.push({ name, goals: ownLeagueTop(career, 0).map(strip), assists: ownLeagueTop(career, 1).map(strip) });
      leaders.push(ownLeagueLeaders(career, name));
      continue;
    }
    const lg = world?.leagues.find(l => l.division === d);
    if (!lg) continue;
    tables.push({ name, division: d, rows: sortLeague(lg.teams) });
    scorers.push({ name, goals: topOf(career, lg.scorers, 0).map(strip), assists: topOf(career, lg.scorers, 1).map(strip) });
    const b = bestOfCounts(career, lg.scorers);
    leaders.push({ competition: name, scorers: levelTop(topOf(career, lg.scorers, 0)), assisters: levelTop(topOf(career, lg.scorers, 1)), ...(b ? { best: b } : {}) });
  }
  if (career.euroState) {
    tables.push({ name: career.euroState.competition, rows: euroRows(career.euroState.table ?? career.euroState.liveTable) });
    try {
      const own = ownEuroScorers(career, career.euroState);
      scorers.push({ name: career.euroState.competition, goals: own.goals.map(strip), assists: own.assists.map(strip) });
    } catch { /* scorers are extra */ }
  }
  for (const e of world?.europe ?? []) {
    if (career.euroState?.competition === e.competition) continue; // yours is kept above
    tables.push({ name: e.competition, rows: euroRows(e.table) });
    scorers.push({ name: e.competition, goals: topOf(career, e.scorers, 0).map(strip), assists: topOf(career, e.scorers, 1).map(strip) });
    const b = bestOfCounts(career, e.scorers);
    leaders.push({ competition: e.competition, scorers: levelTop(topOf(career, e.scorers, 0)), assisters: levelTop(topOf(career, e.scorers, 1)), ...(b ? { best: b } : {}) });
  }
  const playOffs: WorldSummary["playOffs"] = [...(ladder?.worldPlayOffs ?? [])];
  if (ladder?.playOffs) playOffs.push({ division: yours as CareerDivision, result: ladder.playOffs });
  const playOffWinners: NonNullable<WorldSummary["playOffWinners"]> = {};
  for (const p of playOffs) playOffWinners[p.division] = p.result.promoted;
  // Your own play-off, played for real: its winner is on the career, not the ladder.
  if (career.playOffState?.promoted) playOffWinners[yours as CareerDivision] = career.playOffState.promoted;
  const finals: NonNullable<WorldSummary["finals"]> = [];
  const cupRounds: NonNullable<WorldSummary["cups"]> = [];
  for (const cup of [...cups, ...(world?.leagueCup ? [world.leagueCup] : [])]) {
    if (!cupRounds.some(c => c.competition === cup.competition)) {
      // Qualifying rounds left out: they are most of the FA Cup's ties and
      // would add ~60 KB to every save.
      cupRounds.push({ competition: cup.competition, winner: cup.winner, rounds: cup.rounds.filter(r => !/qualif/i.test(r.name)).map(r => ({ name: r.name, ties: r.ties.map(t => ({ home: t.home, away: t.away, hs: t.hs, as: t.as, ...(t.pens ? { pens: { home: t.pens.home, away: t.pens.away } } : {}) })), ...(r.byes?.length ? { byes: r.byes } : {}) })) });
      try {
        const sc = cupScorers(career, cup.competition, cup.rounds.flatMap(r => r.ties.map(t => ({ round: r.name, home: t.home, away: t.away, hs: t.hs, as: t.as }))));
        scorers.push({ name: cup.competition, goals: sc.goals.map(strip), assists: sc.assists.map(strip) });
      } catch { /* scorers are extra */ }
    }
    const last = cup.rounds[cup.rounds.length - 1];
    const t = last?.ties.length === 1 ? last.ties[0] : null;
    if (t) finals.push({ competition: cup.competition, home: t.home, away: t.away, hs: t.hs, as: t.as, ...(t.pens ? { pens: t.pens } : {}), winner: cup.winner });
    try {
      const games: CupGame[] = cup.rounds.flatMap(r => r.ties.map(x => ({ round: r.name, home: x.home, away: x.away, hs: x.hs, as: x.as })));
      const sc = cupScorers(career, cup.competition, games);
      const fin = t ? { round: last.name, home: t.home, away: t.away, hs: t.hs, as: t.as } : undefined;
      const b = bestInFinal(career, cup.competition, fin, cup.winner);
      leaders.push({ competition: cup.competition, scorers: levelTop(sc.goals), assisters: levelTop(sc.assists), ...(b ? { best: b } : {}) });
    } catch { /* a cup with no squads names nobody */ }
  }
  const euroFinal = (competition: string, br?: EuroBracket, winner?: string) => {
    const f = br?.rounds[br.rounds.length - 1]?.ties[0];
    const agg = f ? koAggregate(f) : null;
    if (f?.a && f.b) finals.push({ competition, home: f.a, away: f.b, hs: agg?.a, as: agg?.b, ...(f.pens ? { pens: { home: f.pens.a, away: f.pens.b } } : {}), winner: f.winner ?? winner });
  };
  const brackets: NonNullable<WorldSummary["brackets"]> = [];
  if (career.euroState) {
    euroFinal(career.euroState.competition, career.euroState.bracket, career.euroState.winner);
    if (career.euroState.bracket) brackets.push({ competition: career.euroState.competition, bracket: career.euroState.bracket });
  }
  for (const e of world?.europe ?? []) {
    if (career.euroState?.competition === e.competition) continue;
    euroFinal(e.competition, e.bracket, e.winner);
    if (e.bracket) brackets.push({ competition: e.competition, bracket: e.bracket });
  }
  for (const sh of world?.shields ?? []) finals.push({ competition: sh.competition, home: sh.home, away: sh.away, hs: sh.hs, as: sh.as, ...(sh.pens ? { pens: sh.pens } : {}), winner: sh.winner });
  for (const f of career.fixtures) {
    if ((f.competition === "Community Shield" || f.competition === "Super Cup") && f.played) {
      const home = f.home ? career.player.club : f.opponent, away = f.home ? f.opponent : career.player.club;
      const won = career.trophies.some(t => t.season === career.season && t.competition === f.competition);
      finals.push({ competition: f.competition, home, away, hs: f.homeScore, as: f.awayScore, winner: won ? career.player.club : f.opponent });
    }
  }
  return { season: career.season, tables, scorers, winners, playOffs, finals, leaders, cups: cupRounds, brackets, playOffWinners };
}
