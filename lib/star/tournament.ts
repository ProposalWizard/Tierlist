/**
 * THE SUMMER TOURNAMENT — international career, slice 2.
 *
 * Every other summer (tournamentFor: a European Championship in even seasons
 * not divisible by four, a World Cup in the others) there is a real
 * tournament once the club season is over:
 *
 *   World Cup — 32 nations, 8 groups of 4: 16 from Europe, 16 from the rest.
 *   Euros     — 24 nations, 6 groups of 4: all European.
 *
 * Each group plays three matchdays (everyone plays everyone once; 3 points a
 * win, 1 a draw; ties broken on goal difference, then goals scored, then
 * team strength). The top two go through — and at the Euros the four best
 * third-placed sides too — to a Round of 16, then Quarter-Finals, Semis and
 * a Final. A knockout level after ninety goes to extra time, then penalties.
 *
 * Who qualifies: every nation in the pool is ranked on its strength plus a
 * little seeded luck, and the top ones are in. San Marino never are; Scotland
 * sometimes are.
 *
 * Whether YOU go: the manager names his squad when the club season ends. The
 * odds are the international breaks' own (international.ts's callUpChance),
 * plus a bonus for every international you played this season — the men in
 * the last squads are the men he takes:
 *
 *   logit(chance) = logit(callUpChance) + 0.45 × internationals this season (max 4)
 *
 * clamped to 2%–98%, and 0 while injured.
 *
 * Every match you play is the real engine (the same stand-in career the
 * international breaks use). Every match without you is simulated with the
 * same scorelines the cups use (shootout.ts). Once you are out — or never
 * in — the rest is played to a winner at once, so the season's tournament
 * always has one (resolveSeasonWinners reads it).
 *
 * Pure: no React, no storage.
 */
import type { CareerState, Fixture } from "./types";
import type { CupRound, CupTie } from "./cups";
import { tieWinner, shuffle } from "./cups";
import { mulberry32 } from "./season";
import { clubNameSeed } from "./squadData";
import { ninetyMinuteScore, extraTimeScore, simulateShootout } from "./shootout";
import { NATION_STRENGTH, EUROPEAN, callUpChance } from "./international";
import { tournamentFor, nationOf } from "./competitions";
import { divisionOf, postSeasonFor, type CareerDivision } from "./calendar";

export type TournamentCompetition = "World Cup" | "European Championship";

export const KO_ROUNDS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"] as const;

export interface TournamentGroupMatch {
  /** 1, 2 or 3. */
  md: number;
  home: string;
  away: string;
  hs?: number;
  as?: number;
}

export interface TournamentGroup {
  /** "A", "B"… */
  name: string;
  teams: string[];
  matches: TournamentGroupMatch[];
}

export interface TournamentRow {
  name: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
}

export interface TournamentState {
  season: number;
  competition: TournamentCompetition;
  /** Your nation, spelled the way your player's nationality is. */
  nation: string;
  /** Your nation qualified. */
  entered: boolean;
  /** You are in the squad. */
  selected: boolean;
  /** The chance you had, 0-1 (0 when your nation is not there). */
  chance: number;
  /** Every nation's strength, so a simulated match never has to look it up. */
  strengths: Record<string, number>;
  groups: TournamentGroup[];
  /** Group matchdays finished, 0-3. */
  matchday: number;
  /** Knockout rounds drawn so far; the last one is being played. */
  ko: CupRound[];
  winner?: string;
  /** Where your nation went out ("Group Stage", "Quarter-Final"…), or "Winners". */
  yourExit?: string;
}

// ── The field ───────────────────────────────────────────────────────────────

/** The same nation under another spelling. */
const ALIASES: Record<string, string> = {
  Turkey: "Türkiye", Ireland: "Republic of Ireland", "Czech Republic": "Czechia",
  "United States": "USA", "Ivory Coast": "Cote d'Ivoire",
};
const canon = (n: string) => ALIASES[n] ?? n;

const EURO_POOL = [
  "England", "France", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia",
  "Denmark", "Switzerland", "Norway", "Austria", "Türkiye", "Sweden", "Poland", "Serbia", "Ukraine",
  "Scotland", "Wales", "Republic of Ireland", "Northern Ireland", "Czechia", "Hungary", "Greece",
  "Slovakia", "Slovenia", "Romania", "Iceland", "Finland", "Albania", "Georgia",
  "Bosnia and Herzegovina", "Israel",
];
const REST_POOL = [
  "Brazil", "Argentina", "Uruguay", "Colombia", "Ecuador", "Mexico", "USA", "Canada", "Japan",
  "Korea Republic", "Australia", "Morocco", "Senegal", "Nigeria", "Cote d'Ivoire", "Ghana", "Cameroon",
  "Egypt", "Algeria", "Chile", "Peru", "Paraguay", "Saudi Arabia", "Iran", "Qatar", "Costa Rica",
  "Tunisia", "Jamaica", "New Zealand",
];
const EXTRA_STRENGTH: Record<string, number> = {
  Albania: 66, Georgia: 68, "Bosnia and Herzegovina": 66, Israel: 64, "Saudi Arabia": 66,
  Iran: 70, Qatar: 62, "Costa Rica": 66, Tunisia: 68,
};

export function tournamentStrength(nation: string): number {
  return NATION_STRENGTH[nation] ?? NATION_STRENGTH[canon(nation)] ?? EXTRA_STRENGTH[canon(nation)] ?? 60;
}

/** Ranked on strength plus seeded luck (about ±4); the top `n` are in. */
function qualify(pool: string[], n: number, rng: () => number): string[] {
  return pool
    .map(name => ({ name, score: tournamentStrength(name) + (rng() + rng() + rng() - 1.5) * 5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.name);
}

/**
 * Who is at this summer's tournament. Your nation stands in under its own
 * spelling, so the fixture, the team sheet and the trophy all name it the
 * way your player's nationality does.
 */
export function tournamentField(competition: TournamentCompetition, season: number, yourNation: string): string[] {
  const rng = mulberry32(clubNameSeed(`field|${competition}|${season}`));
  const you = canon(yourNation);
  const euro = EURO_POOL.includes(you) || !EUROPEAN.has(yourNation) ? EURO_POOL : [...EURO_POOL, you];
  const rest = REST_POOL.includes(you) || EUROPEAN.has(yourNation) || EURO_POOL.includes(you) ? REST_POOL : [...REST_POOL, you];
  const field = competition === "World Cup"
    ? [...qualify(euro, 16, rng), ...qualify(rest, 16, rng)]
    : qualify(euro, 24, rng);
  return field.map(n => (n === you ? yourNation : n));
}

/** Pots by strength, one nation from each pot per group. */
/** Exported for the tournament test page (/star-tournament-dev). */
export function drawGroups(field: string[], rng: () => number): TournamentGroup[] {
  const groupCount = field.length / 4;
  const ranked = [...field].sort((a, b) => tournamentStrength(b) - tournamentStrength(a));
  const pots = [0, 1, 2, 3].map(i => shuffle(ranked.slice(i * groupCount, (i + 1) * groupCount), rng));
  return Array.from({ length: groupCount }, (_, g) => {
    const teams = pots.map(p => p[g]);
    const [a, b, c, d] = teams;
    return {
      name: String.fromCharCode(65 + g),
      teams,
      matches: [
        { md: 1, home: a, away: b }, { md: 1, home: c, away: d },
        { md: 2, home: a, away: c }, { md: 2, home: d, away: b },
        { md: 3, home: d, away: a }, { md: 3, home: b, away: c },
      ],
    };
  });
}

// ── Tables ──────────────────────────────────────────────────────────────────

export function groupTable(group: TournamentGroup): TournamentRow[] {
  const rows = new Map<string, TournamentRow>(group.teams.map(t => [t, { name: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const m of group.matches) {
    if (m.hs === undefined || m.as === undefined) continue;
    const h = rows.get(m.home)!, a = rows.get(m.away)!;
    h.p++; a.p++; h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.w++; a.l++; h.pts += 3; }
    else if (m.hs < m.as) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Array.from(rows.values()).sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf
    || tournamentStrength(y.name) - tournamentStrength(x.name) || x.name.localeCompare(y.name));
}

/** The group your nation is in, or null. */
export function yourGroup(state: TournamentState): TournamentGroup | null {
  return state.groups.find(g => g.teams.includes(state.nation)) ?? null;
}

// ── Simulating ──────────────────────────────────────────────────────────────

/** A neutral ground: the shared cup scoreline, minus its home bump. */
function score(state: TournamentState, home: string, away: string, rng: () => number) {
  return ninetyMinuteScore((state.strengths[home] ?? 60) - 3, state.strengths[away] ?? 60, rng);
}

function playTie(state: TournamentState, tie: CupTie, rng: () => number): CupTie {
  const hStr = state.strengths[tie.home] ?? 60, aStr = state.strengths[tie.away] ?? 60;
  const s = score(state, tie.home, tie.away, rng);
  const out: CupTie = { ...tie, hs: s.hs, as: s.as };
  if (s.hs === s.as) {
    const et = extraTimeScore(hStr - 3, aStr, rng);
    out.wentToExtraTime = true;
    out.hs! += et.hs; out.as! += et.as;
    if (out.hs === out.as) {
      const p = simulateShootout(hStr, aStr, rng);
      out.pens = { home: p.home, away: p.away };
    }
  }
  return out;
}

/** Play every unplayed match of group matchday `md` (yours too, unless handed in). */
/** Exported for the tournament test page (/star-tournament-dev). */
export function playMatchday(state: TournamentState, md: number, rng: () => number): TournamentState {
  const groups = state.groups.map(g => ({
    ...g,
    matches: g.matches.map(m => {
      if (m.md !== md || m.hs !== undefined) return m;
      const s = score(state, m.home, m.away, rng);
      return { ...m, hs: s.hs, as: s.as };
    }),
  }));
  return { ...state, groups, matchday: Math.max(state.matchday, md) };
}

/**
 * Who goes through, in seeding order: group winners first, then runners-up,
 * then (Euros) the best four thirds. Each with its group.
 */
export function qualifiers(state: TournamentState): { name: string; group: string; place: number }[] {
  const tables = state.groups.map(g => ({ g: g.name, t: groupTable(g) }));
  const firsts = tables.map(x => ({ name: x.t[0].name, group: x.g, place: 1 }));
  const seconds = tables.map(x => ({ name: x.t[1].name, group: x.g, place: 2 }));
  const out = [...firsts, ...seconds];
  if (out.length < 16) {
    const thirds = tables.map(x => ({ row: x.t[2], group: x.g }))
      .sort((a, b) => b.row.pts - a.row.pts || (b.row.gf - b.row.ga) - (a.row.gf - a.row.ga) || b.row.gf - a.row.gf
        || tournamentStrength(b.row.name) - tournamentStrength(a.row.name))
      .slice(0, 16 - out.length)
      .map(x => ({ name: x.row.name, group: x.group, place: 3 }));
    out.push(...thirds);
  }
  return out;
}

/**
 * The Round of 16: each group winner meets a side from another group (a
 * runner-up first), then whoever is left meet each other, still never two
 * from the same group where it can be helped.
 */
function drawRoundOf16(state: TournamentState, rng: () => number): CupRound {
  const q = qualifiers(state);
  const winners = q.filter(x => x.place === 1);
  const others = shuffle(q.filter(x => x.place !== 1), rng).sort((a, b) => a.place - b.place);
  const ties: CupTie[] = [];
  for (const w of winners) {
    const i = others.findIndex(o => o.group !== w.group);
    const o = others.splice(i >= 0 ? i : 0, 1)[0];
    ties.push({ home: w.name, away: o.name });
  }
  while (others.length >= 2) {
    const a = others.shift()!;
    const i = others.findIndex(o => o.group !== a.group);
    const b = others.splice(i >= 0 ? i : 0, 1)[0];
    ties.push({ home: a.name, away: b.name });
  }
  return { name: KO_ROUNDS[0], ties };
}

/** Pair the last round's winners in bracket order: tie 1 v tie 2, 3 v 4… */
function nextKoRound(state: TournamentState): TournamentState {
  const last = state.ko[state.ko.length - 1];
  const winners = last.ties.map(tieWinner).filter((w): w is string => !!w);
  if (winners.length === 1) return { ...state, winner: winners[0] };
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) ties.push({ home: winners[i], away: winners[i + 1] });
  return { ...state, ko: [...state.ko, { name: KO_ROUNDS[state.ko.length], ties }] };
}

/** Play the current knockout round's unplayed ties, then draw the next one. */
function playKoRound(state: TournamentState, rng: () => number): TournamentState {
  const ko = [...state.ko];
  const round = ko[ko.length - 1];
  ko[ko.length - 1] = { ...round, ties: round.ties.map(t => (t.hs !== undefined ? t : playTie(state, t, rng))) };
  return nextKoRound({ ...state, ko });
}

/** Play whatever is left — groups, then knockouts — to a winner. */
export function finishTournament(state: TournamentState, rng: () => number): TournamentState {
  let s = state;
  for (let md = s.matchday + 1; md <= 3; md++) s = playMatchday(s, md, rng);
  if (s.ko.length === 0 && !s.winner) s = { ...s, ko: [drawRoundOf16(s, rng)] };
  for (let guard = 0; guard < 6 && !s.winner; guard++) s = playKoRound(s, rng);
  return s;
}

// ── Opening it, and whether you go ──────────────────────────────────────────

/** Internationals you played this season before the summer (caps toward the squad). */
function capsThisSeason(career: CareerState): number {
  return (career.international?.matches ?? []).filter(m => m.season === career.season).length;
}

/** The chance you are in the tournament squad, 0-1. */
export function tournamentSquadChance(career: CareerState): number {
  const base = callUpChance(career);
  if (base <= 0) return 0;
  const p = Math.max(0.0001, Math.min(0.9999, base));
  const logit = Math.log(p / (1 - p)) + 0.45 * Math.min(4, capsThisSeason(career));
  return Math.max(0.02, Math.min(0.98, 1 / (1 + Math.exp(-logit))));
}

/**
 * The summer's tournament, drawn and decided: the field, the groups, and
 * whether you are in the squad. Seeded — the same save always gets the same
 * answer.
 */
export function openTournament(career: CareerState): TournamentState | null {
  const competition = tournamentFor(career.season) as TournamentCompetition | null;
  if (!competition) return null;
  const nation = nationOf(career);
  const field = tournamentField(competition, career.season, nation);
  const rng = mulberry32(clubNameSeed(`groups|${competition}|${career.season}`));
  const groups = drawGroups(field, rng);
  const entered = field.includes(nation);
  const chance = entered ? tournamentSquadChance(career) : 0;
  const pick = mulberry32(clubNameSeed(`squad|${career.player.firstName} ${career.player.lastName}|${career.season}`));
  const selected = entered && pick() < chance;
  const strengths: Record<string, number> = {};
  for (const n of field) strengths[n] = tournamentStrength(n);
  return { season: career.season, competition, nation, entered, selected, chance, strengths, groups, matchday: 0, ko: [] };
}

/** An old save already carrying this season's tournament as a counter-style run finishes it the old way. */
function hasOldRun(career: CareerState): boolean {
  return (career.cups ?? []).some(r => r.kind === "international");
}

/**
 * The summer tournament has come round and the squad is not yet named:
 * this is a tournament season, every club fixture is played, and nothing
 * has been decided yet.
 */
export function tournamentDue(career: CareerState): boolean {
  if (!career.player?.club || !career.fixtures?.length) return false;
  if (!tournamentFor(career.season) || hasOldRun(career)) return false;
  if (career.tournament?.season === career.season) return false;
  return career.fixtures.every(f => f.played);
}

/** The week of your `i`-th tournament match (0-2 groups, 3-6 knockouts), after any play-offs. */
export function tournamentWeek(division: CareerDivision, i: number): number {
  return postSeasonFor(division, (division === "premier" ? 3 : 6) + i);
}

function groupFixture(career: CareerState, state: TournamentState, md: number): Fixture | null {
  const g = yourGroup(state);
  const m = g?.matches.find(x => x.md === md && (x.home === state.nation || x.away === state.nation));
  if (!g || !m) return null;
  const opponent = m.home === state.nation ? m.away : m.home;
  return {
    week: tournamentWeek(divisionOf(career), md - 1), opponent, home: m.home === state.nation, played: false,
    competition: state.competition, kind: "international", round: `Group ${g.name} · Match ${md}`,
    opponentStrength: state.strengths[opponent],
  };
}

function koFixture(career: CareerState, state: TournamentState): Fixture | null {
  const round = state.ko[state.ko.length - 1];
  const tie = round?.ties.find(t => t.home === state.nation || t.away === state.nation);
  if (!round || !tie || tie.hs !== undefined) return null;
  const opponent = tie.home === state.nation ? tie.away : tie.home;
  return {
    week: tournamentWeek(divisionOf(career), 3 + state.ko.length - 1), opponent, home: tie.home === state.nation,
    played: false, competition: state.competition, kind: "international", round: round.name,
    opponentStrength: state.strengths[opponent],
  };
}

function rngFor(state: TournamentState, salt: number): () => number {
  return mulberry32(clubNameSeed(`play|${state.competition}|${state.season}|${salt}`));
}

/**
 * Write the summer's tournament into the career. In the squad: your first
 * group match goes on the calendar. Not in it (or your nation never
 * qualified): the whole thing is played out without you, at once.
 */
export function applyTournament(career: CareerState, state: TournamentState): CareerState {
  if (state.entered && state.selected) {
    const f = groupFixture(career, state, 1);
    if (f) return { ...career, tournament: state, fixtures: [...career.fixtures, f] };
  }
  const done = finishTournament(state, rngFor(state, 99));
  return { ...career, tournament: { ...done, yourExit: state.entered ? exitOf(done) : undefined } };
}

/** Where your nation went out, read off a finished tournament. */
function exitOf(state: TournamentState): string {
  if (state.winner === state.nation) return "Winners";
  for (let i = state.ko.length - 1; i >= 0; i--) {
    const tie = state.ko[i].ties.find(t => t.home === state.nation || t.away === state.nation);
    if (tie) return state.ko[i].name;
  }
  return "Group Stage";
}

/** Is this fixture one of your matches at this season's tournament? */
export function isTournamentFixture(career: CareerState, fixture: Fixture): boolean {
  const t = career.tournament;
  return fixture.kind === "international" && !!fixture.round && !!t && t.season === career.season
    && fixture.competition === t.competition && !t.winner;
}

export interface TournamentOutcome {
  state: TournamentState;
  nextFixture: Fixture | null;
  trophy: { season: number; competition: string; club: string } | null;
  message: string;
}

/**
 * Settle one of your tournament matches and move the tournament on.
 *
 * `result` is your score, theirs, and (for a knockout that went to one) the
 * live shootout in the fixture's home/away terms. Null when you missed the
 * match: it is simulated like everyone else's.
 */
export function settleTournamentMatch(
  career: CareerState, fixture: Fixture,
  result: { us: number; them: number; pens?: { home: number; away: number }; extraTime?: boolean } | null,
): TournamentOutcome | null {
  if (!isTournamentFixture(career, fixture)) return null;
  let s = career.tournament!;
  const nation = s.nation;
  const rng = rngFor(s, fixture.week);

  if (fixture.round!.startsWith("Group")) {
    const md = s.matchday + 1;
    const g = yourGroup(s)!;
    const groups = s.groups.map(gr => (gr !== g ? gr : {
      ...gr,
      matches: gr.matches.map(m => {
        if (m.md !== md || (m.home !== nation && m.away !== nation)) return m;
        if (!result) { const sc = score(s, m.home, m.away, rng); return { ...m, hs: sc.hs, as: sc.as }; }
        return { ...m, hs: m.home === nation ? result.us : result.them, as: m.home === nation ? result.them : result.us };
      }),
    }));
    s = playMatchday({ ...s, groups }, md, rng);
    const row = groupTable(yourGroup(s)!);
    const place = row.findIndex(r => r.name === nation) + 1;
    if (md < 3) {
      return { state: s, nextFixture: groupFixture(career, s, md + 1), trophy: null,
        message: `${nation} sit ${ordinal(place)} in Group ${g.name} after ${md} game${md > 1 ? "s" : ""}.` };
    }
    s = { ...s, ko: [drawRoundOf16(s, rng)] };
    if (qualifiers(s).some(q => q.name === nation)) {
      return { state: s, nextFixture: koFixture(career, s), trophy: null,
        message: `${nation} finish ${ordinal(place)} in Group ${g.name} — into the Round of 16.` };
    }
    const done = finishTournament(s, rng);
    return { state: { ...done, yourExit: "Group Stage" }, nextFixture: null, trophy: null,
      message: `${nation} finish ${ordinal(place)} in Group ${g.name} and go home. ${done.winner} win the ${s.competition}.` };
  }

  // A knockout tie.
  const ko = [...s.ko];
  const round = ko[ko.length - 1];
  const tie = round.ties.find(t => t.home === nation || t.away === nation)!;
  let played: CupTie;
  if (!result) {
    played = playTie(s, tie, rng);
  } else {
    const youHome = tie.home === nation;
    played = { ...tie, hs: youHome ? result.us : result.them, as: youHome ? result.them : result.us };
    if (result.extraTime) played.wentToExtraTime = true;
    if (played.hs === played.as) {
      played.pens = result.pens ?? (() => {
        const p = simulateShootout(s.strengths[tie.home] ?? 60, s.strengths[tie.away] ?? 60, rng);
        return { home: p.home, away: p.away };
      })();
    }
  }
  const others = round.ties.map(t => (t === tie ? played : t.hs !== undefined ? t : playTie(s, t, rng)));
  ko[ko.length - 1] = { ...round, ties: others };
  s = nextKoRound({ ...s, ko });
  const won = tieWinner(played) === nation;
  const pens = played.pens ? " on penalties" : "";
  if (!won) {
    const done = finishTournament(s, rng);
    return { state: { ...done, yourExit: round.name }, nextFixture: null, trophy: null,
      message: `${nation} are out of the ${s.competition} in the ${round.name}${pens}. ${done.winner} go on to win it.` };
  }
  if (s.winner === nation) {
    return { state: { ...s, yourExit: "Winners" }, nextFixture: null,
      trophy: { season: career.season, competition: s.competition, club: nation },
      message: `🏆 ${nation} win the ${s.competition}${pens}!` };
  }
  return { state: s, nextFixture: koFixture(career, s), trophy: null,
    message: `${nation} are through to the ${s.ko[s.ko.length - 1].name}${pens}.` };
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
