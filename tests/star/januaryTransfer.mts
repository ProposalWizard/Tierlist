import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import { agreeMove, requestOf } from "../../lib/star/transferRequest";
import { canMoveNow, completeJanuaryMove, januaryWindowOpen, isCupTied } from "../../lib/star/januaryTransfer";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import { divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { membershipOf } from "../../lib/star/promotion";
import type { TransferOffer } from "../../lib/star/transfers";
import type { CareerState, LeagueSquad, LeaguePlayer, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE JANUARY MOVE (lib/star/januaryTransfer.ts).
 *
 * A real seeded career plays up to the January window, agrees a deal, moves
 * mid-season, plays the season out and rolls over. Checked at every step:
 * the table is whole (20 or 24 clubs, your club once), no league round is
 * missing or doubled, the season's goals are kept, and advanceSeason works.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok && !problems.includes(what)) problems.push(what); };

function squadsFor(clubs: readonly string[]): LeagueSquad[] {
  return clubs.map((c): LeagueSquad => ({
    club: c,
    players: generateSquad(clubNameSeed(c)).map((p, i): LeaguePlayer => ({
      id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position,
      positions: p.positions ?? [p.position], overall: 60 + (clubNameSeed(p.name) % 22), goals: 0, assists: 0,
    })),
  }));
}

function stats(us: number, them: number, home: boolean, goals: number): MatchStats {
  return {
    chances: 5, goals, assists: 0, passes: 28, rating: 7.1, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: goals,
    sponsorPay: 0, totalCash: 2,
    homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90,
  };
}

function play(c: CareerState, until: (c: CareerState) => boolean, seed: number): CareerState {
  let guard = 0;
  while (!until(c) && guard++ < 200) {
    const f = nextFixtureFor(c);
    if (!f) break;
    const us = (seed + guard) % 4;
    const them = (guard * 3 + seed) % 3;
    c = creditMatchResult(c, f, stats(us, them, f.home, Math.min(us, 1))).career;
  }
  return c;
}

function offerFor(club: string, division?: CareerDivision): TransferOffer {
  return {
    club, strength: 75, wage: 9000, goalBonus: 500, assistBonus: 250, seasons: 3, signingFee: 20000,
    clauses: {}, position: 8, pitch: "test", ...(division ? { division } : {}),
  };
}

/** The table is whole, your club is in it once, and the league fixtures are one per round. */
function audit(c: CareerState, when: string, from = 1): void {
  const size = c.league.length;
  const want = divisionOf(c) === "premier" ? 20 : 24;
  check(size === want, `${when}: the table has ${want} clubs (has ${size})`);
  check(new Set(c.league.map(t => t.name)).size === size, `${when}: no club twice in the table`);
  check(c.league.filter(t => t.name === c.player.club).length === 1, `${when}: your club appears once in the table`);
  // After a move to another division the rounds you played for the old
  // club keep their old numbers; the current division's are checked from
  // the round you joined.
  const inTable = new Set(c.league.map(t => t.name));
  const leagueWeeks = c.fixtures
    .filter(f => (f.kind ?? "league") === "league" && inTable.has(f.opponent) && f.week >= from)
    .map(f => f.week);
  check(new Set(leagueWeeks).size === leagueWeeks.length, `${when}: no league round twice in your fixtures`);
  const rounds = (size - 1) * 2;
  const missing = Array.from({ length: rounds - from + 1 }, (_, i) => i + from).filter(w => !leagueWeeks.includes(w));
  check(missing.length === 0, `${when}: every league round ${from}-${rounds} is on your list (missing ${missing.join(",")})`);
  const keys = c.fixtures.map(f => `${f.week}|${f.kind ?? "league"}|${f.opponent}`);
  check(new Set(keys).size === keys.length, `${when}: no fixture twice (same round, kind and opponent)`);
  const unplayed = c.fixtures.filter(f => !f.played && (f.kind ?? "league") === "league");
  check(unplayed.every(f => c.league.some(t => t.name === f.opponent) && f.opponent !== c.player.club),
    `${when}: every league fixture left is against a club in your table, never yourself`);
  const played = c.league.map(t => t.played);
  check(Math.max(...played) - Math.min(...played) <= 1, `${when}: every club has played the same number (±1): ${Math.min(...played)}-${Math.max(...played)}`);
}

function run(label: string, from: CareerDivision, clubs: readonly string[], target: (c: CareerState) => { club: string; division?: CareerDivision }, seed: number): string {
  const p = {
    firstName: "Test", lastName: "Player", age: 22, skinTone: "light",
    club: clubs[6], clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
  let c = makeInitialCareer(p, [...clubs], from);
  c = { ...c, leagueSquads: squadsFor(clubs) };
  c = play(c, x => januaryWindowOpen(x), seed);
  check(januaryWindowOpen(c), `${label}: the January window opens during the season (week ${c.week})`);
  const t = target(c);
  check(!canMoveNow(c), `${label}: nothing to sign before a deal is agreed`);
  c = agreeMove(c, offerFor(t.club, t.division));
  check(canMoveNow(c), `${label}: an agreed deal can be signed in January`);
  const before = c;
  const round = Math.min(...c.fixtures.filter(f => !f.played && (f.kind ?? "league") === "league").map(f => f.week));
  c = completeJanuaryMove(c);
  check(c.player.club === t.club, `${label}: you play for ${t.club} now (${c.player.club})`);
  check(c.contract.club === t.club && c.contract.wage === 9000, `${label}: the new contract is signed`);
  check(c.season === before.season, `${label}: same season`);
  check(c.seasonStats.goals === before.seasonStats.goals && c.seasonStats.appearances === before.seasonStats.appearances,
    `${label}: the season's goals and apps are kept`);
  check(!requestOf(c).agreed, `${label}: the deal is done with`);
  check(c.fixtures.filter(f => f.played).length === before.fixtures.filter(f => f.played).length,
    `${label}: every match already played stays on the record`);
  check(!c.fixtures.some(f => !f.played && f.kind === "cup" && isCupTied(c, f.competition)), `${label}: no cup tie in a cup you are tied in`);
  check(!c.fixtures.some(f => !f.played && f.kind === "europe"), `${label}: the old club's European games are gone`);
  check(c.transfers?.at(-1)?.window === "january", `${label}: the move is recorded as a January move`);
  const joinedAt = Math.min(...c.fixtures.filter(f => !f.played && (f.kind ?? "league") === "league").map(f => f.week));
  const fromRound = t.division && t.division !== from ? joinedAt : 1;
  audit(c, `${label}, just after the move`, fromRound);
  const table = c.league.find(t2 => t2.name === t.club)!;
  check(table.played > 10, `${label}: the new club's table row is not empty (${table.played} played)`);

  c = play(c, () => false, seed + 1);
  check(!c.fixtures.some(f => !f.played), `${label}: the season finishes`);
  audit(c, `${label}, at the end of the season`, fromRound);
  const lastLeague = c.fixtures.filter(f => (f.kind ?? "league") === "league" && f.week >= round);
  check(lastLeague.every(f => f.played), `${label}: every league game after the move is played`);
  const rolled = advanceSeason(c, false).career;
  check(rolled.season === c.season + 1, `${label}: advanceSeason works`);
  audit(rolled, `${label}, after the rollover`);
  const n = membershipOf(rolled);
  const all = [...n.premier, ...n.championship, ...n.leagueOne, ...n.leagueTwo, ...n.nationalLeague];
  check(all.filter(x => x === rolled.player.club).length === 1, `${label}: your club is in exactly one division after the rollover`);
  return `${label}: round ${round} at week ${before.week} (joins round ${joinedAt}), ${before.player.club} → ${t.club}; `
    + `${table.played} played on joining; season ended ${c.seasonStats.goals} goals in ${c.seasonStats.appearances} apps; `
    + `cup-tied in ${c.cupTied?.competitions.join(", ") || "nothing"}`;
}

const lines: string[] = [];
// Same division: Premier League to Premier League.
for (const seed of [1, 2, 3]) {
  lines.push(run(`PL→PL seed ${seed}`, "premier", PREMIER_LEAGUE_CLUBS,
    c => ({ club: c.league.map(t => t.name).find(n => n !== c.player.club && n !== PREMIER_LEAGUE_CLUBS[6])! }), seed));
}
// Another division: Championship up to the Premier League, and down.
lines.push(run("Champ→PL", "championship", CHAMPIONSHIP_CLUBS,
  c => ({ club: membershipOf(c).premier[3], division: "premier" }), 4));
lines.push(run("PL→Champ", "premier", PREMIER_LEAGUE_CLUBS,
  c => ({ club: membershipOf(c).championship[2], division: "championship" }), 5));

console.log(lines.join("\n"));
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✓ januaryTransfer: all checks pass");
