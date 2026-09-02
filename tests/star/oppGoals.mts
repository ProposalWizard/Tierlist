// A tiny localStorage so lineupStore.ts (and opponentStartingXI's read of
// it) can run headless — same pattern tests/star/career.mts uses.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { mulberry32, playLeagueWeek } from "../../lib/star/season";
import { creditNamedGoals, nameGoals, buildLeagueSquad, type RosterRow, type NamedOppGoal } from "../../lib/star/leagueSquads";
import { pickSquadScorer, pickSquadAssist } from "../../lib/star/squadData";
import { opponentStartingXI } from "../../lib/star/teamsheet";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, LeagueSquad, LeagueTeam, Fixture } from "../../lib/star/types";

/**
 * THE OPPONENT'S GOALS, NAMED LIVE.
 *
 * "They score!" used to be the whole of it — no name, because the live
 * match engine had never been handed the opponent's squad to pick one from.
 * The name that eventually showed up on the results page came from a
 * completely separate, later roll (nameGoals, playLeagueWeek) against the
 * same squad — so even once naming existed, the live commentary and the
 * result could (and did) disagree about who actually scored.
 *
 * Requested directly, twice: build it for real, and make it read the same
 * way your own team's goals already do — a scorer AND an assist, live.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

function roster(club: string, n = 20): RosterRow[] {
  const rng = mulberry32(club.length * 31 + club.charCodeAt(0));
  const POS = ["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${club}-${i}`,
    name: `${club.slice(0, 3)} Player${i}`,
    positions: POS[i % POS.length],
    overall: 60 + Math.floor(rng() * 32),
    nation: "England",
  }));
}

// ── creditNamedGoals: the same real player, credited, not re-rolled ────────
{
  const squad: LeagueSquad = {
    club: "Arsenal",
    players: [
      { id: "a1", name: "Alex Scorer", position: "ST", overall: 75, goals: 3, assists: 1 },
      { id: "a2", name: "Cam Creator", position: "CAM", overall: 70, goals: 0, assists: 4 },
      { id: "a3", name: "Sam Spare", position: "CM", overall: 65, goals: 0, assists: 0 },
    ],
  };
  const goals: NamedOppGoal[] = [
    { id: "a1", assistId: "a2", m: 23, s: "Scorer", a: "Creator" },
    { id: "a1", m: 71, s: "Scorer" }, // a brace, unassisted the second time
  ];
  const out = creditNamedGoals(squad, goals);
  check(out.length === 2, `both goals come back (${out.length})`);
  check(out[0].m === 23 && out[1].m === 71, "…in minute order");
  check(out[0].s === "Scorer" && out[0].a === "Creator", "the first carries scorer and assist");
  check(out[1].a === undefined, "…the second, unassisted, carries no 'a' at all");
  check(squad.players[0].goals === 5, `the real scorer's tally moved by exactly two (${squad.players[0].goals})`);
  check(squad.players[1].assists === 5, `the real assister's tally moved by exactly one (${squad.players[1].assists})`);
  check(squad.players[2].goals === 0 && squad.players[2].assists === 0,
    "nobody else on the books is touched");

  // An id with nothing behind it — the "Team-mate" fallback CanvasMatch
  // uses when nobody could be named — still shows on the scoresheet, just
  // credits nobody's real tally.
  const withUnnamed = creditNamedGoals(squad, [{ id: "unnamed", m: 5, s: "Team-mate" }]);
  check(withUnnamed[0].s === "Team-mate", "an unnamed scorer still reads out by name");
  check(squad.players.every(p => p.goals <= 5), "…and credits no real player for it");

  // No squad at all (an opponent this career never fetched real data for) —
  // still returns the goals, honestly, crediting nothing.
  const noSquad = creditNamedGoals(undefined, [{ id: "a1", m: 10, s: "Scorer" }]);
  check(noSquad.length === 1 && noSquad[0].s === "Scorer", "no squad to credit still reports the goal itself");
}

// ── playLeagueWeek: a complete live list is used instead of a fresh roll ───
{
  const league: LeagueTeam[] = CLUBS.map(name => ({
    name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, strength: 70,
  }));
  const squads = CLUBS.map(c => buildLeagueSquad(c, roster(c)));
  const arsenal = squads.find(s => s.club === "Arsenal")!;
  const scorerId = arsenal.players[0].id;
  const scorerName = arsenal.players[0].name;

  const rng = mulberry32(99);
  const round = playLeagueWeek(league, 4, {
    club: "Liverpool", opponent: "Arsenal", home: true, scored: 1, conceded: 1,
    oppGoals: [{ id: scorerId, m: 60, s: scorerName.split(" ").pop()! }],
  }, rng, squads.map(s => ({ ...s, players: s.players.map(p => ({ ...p })) })));

  const yours = round.results.find(r => r.home === "Liverpool" && r.away === "Arsenal");
  check(!!yours, "the fixture itself is in the round's results");
  check(yours?.ag?.[0]?.s === scorerName.split(" ").pop(),
    `the live-decided scorer is the one on the scoresheet (${yours?.ag?.[0]?.s})`);

  // A short list (fewer named goals than actually conceded) is treated the
  // same as none at all — the honest fallback, not a partial credit that
  // silently under-reports who scored.
  const rng2 = mulberry32(99);
  const shortList = playLeagueWeek(league, 4, {
    club: "Liverpool", opponent: "Arsenal", home: true, scored: 1, conceded: 2,
    oppGoals: [{ id: scorerId, m: 60, s: "Scorer" }],
  }, rng2, squads.map(s => ({ ...s, players: s.players.map(p => ({ ...p })) })));
  const shortResult = shortList.results.find(r => r.away === "Arsenal" && r.home === "Liverpool");
  check(shortResult?.ag?.length === 2, `a short live list falls back to naming all of them anyway (${shortResult?.ag?.length})`);
}

// ── opponentStartingXI: their actual eleven, not their whole scouted pool ──
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 19, position: "ST",
    club: "Liverpool", nationality: "England", startYear: 2027, skinTone: "light",
    clubBadge: null,
  } as never;
  const base = makeInitialCareer(player, CLUBS);
  const c: CareerState = {
    ...base,
    leagueSquads: CLUBS.map(club => buildLeagueSquad(club, roster(club))),
  };
  const fixture: Fixture = { week: 3, opponent: "Arsenal", home: true, played: false, kind: "league" };
  const xi = opponentStartingXI(c, fixture);
  check(xi !== null, "a normal club fixture has a real eleven to draw from");
  check(xi !== null && xi.length === 11, `exactly eleven, not their whole roster (${xi?.length})`);
  const arsenalRoster = c.leagueSquads!.find(s => s.club === "Arsenal")!.players;
  check(xi !== null && xi.every(p => arsenalRoster.some(rp => rp.id === p.id)),
    "…and every one of them is a real Arsenal player, not invented");

  const intl: Fixture = { week: 3, opponent: "Brazil", home: true, played: false, kind: "international" };
  check(opponentStartingXI(c, intl) === null, "an international fixture has no club sheet to draw from");
}

// ── pickSquadScorer/pickSquadAssist: still work on a non-SquadPlayer shape ─
//
// Generalised (see squadData.ts) so CanvasMatch's opponent-goal branch can
// reuse the exact same weighting off the opponent's TeamSheet.SheetPlayer
// entries — {id, name, shortName, position} — rather than a second,
// duplicated picker.
{
  type Candidate = { id: string; name: string; shortName: string; position: "ST" | "CM" | "CB" | "GK" };
  const pool: Candidate[] = [
    { id: "1", name: "Keeper", shortName: "Keeper", position: "GK" },
    { id: "2", name: "Striker", shortName: "Striker", position: "ST" },
    { id: "3", name: "Mid", shortName: "Mid", position: "CM" },
    { id: "4", name: "Back", shortName: "Back", position: "CB" },
  ];
  const rng = mulberry32(7);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(pickSquadScorer(pool, rng)?.id ?? "none");
  check(!seen.has("1"), "the keeper is never picked as a scorer");
  check(seen.has("2"), "a striker is reachable");

  const assist = pickSquadAssist(pool, "2", mulberry32(1));
  check(assist === null || assist.id !== "2", "an assist, when one lands, is never the scorer himself");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the opponent's goals are named live, and the result agrees with what you watched");
