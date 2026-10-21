import { makeInitialCareer, simulateMissedFixture, advanceSeason } from "../../lib/star/careerFlow";
import { nextFixtureFor, faCupEntrantsFor } from "../../lib/star/competitions";
import { openFaCup, playCupRound, finishCupToWinner, FA_CUP_ROUND_NAMES, tieWinner, type CupState } from "../../lib/star/cups";
import { faCupSlotsFor, fixtureTimestamp, type CareerDivision } from "../../lib/star/calendar";
import { mulberry32 } from "../../lib/star/season";
import { ratedTeams } from "../../lib/star/world";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE TEN-ROUND FA CUP (Mikey, 19 Oct 2026, option A): each league joins at
 * its real round, 24 byes in the 3rd Qualifying Round, and "a bye cannot go
 * to your club. Your club must play in every round that you get to."
 *
 *   3rd Q 56 (32 play, 24 byes) · 4th Q 64 · R1 80 · R2 40 · R3 64 · 32 · 16 · 8 · 4 · 2
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const SIZES = [56, 64, 80, 40, 64, 32, 16, 8, 4, 2];

function careerAt(club: string, division: CareerDivision, clubs: readonly string[]): CareerState {
  const p = { firstName: "Test", lastName: "Player", age: 16, skinTone: "light", club, clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  return makeInitialCareer(p, [...clubs], division);
}

function clubsIn(cup: CupState, i: number): number {
  const r = cup.rounds[i];
  return r.ties.length * 2 + (r.byes?.length ?? 0);
}

// ── 1. The shape, for every entry league ────────────────────────────────────
const CASES: [string, CareerDivision, readonly string[], string][] = [
  ["Premier League", "premier", PREMIER_LEAGUE_CLUBS, "Third Round"],
  ["Championship", "championship", CHAMPIONSHIP_CLUBS, "Third Round"],
  ["League One", "league_one", LEAGUE_ONE_CLUBS, "First Round"],
  ["League Two", "league_two", LEAGUE_TWO_CLUBS, "First Round"],
  ["National League", "national_league", NATIONAL_LEAGUE_CLUBS, "Fourth Qualifying Round"],
  ["National League North", "national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS, "Third Qualifying Round"],
  ["National League South", "national_league_south", NATIONAL_LEAGUE_SOUTH_CLUBS, "Third Qualifying Round"],
];
for (const [label, division, clubs, entry] of CASES) {
  for (const club of [clubs[0], clubs[clubs.length - 1]]) {
    let c = careerAt(club, division, clubs);
    const fa0 = c.cupState!.find(s => s.competition === "FA Cup")!;
    check(fa0.rounds[0].name === "Third Qualifying Round" && clubsIn(fa0, 0) === 56, `${label}: opens with the 3rd Qualifying Round of 56 (${clubsIn(fa0, 0)})`);
    check((fa0.rounds[0].byes ?? []).length === 24, `${label}: 24 byes (${fa0.rounds[0].byes?.length})`);
    check(!(fa0.rounds[0].byes ?? []).includes(club), `${label}: ${club} never gets a bye`);
    const hasFirst = c.fixtures.some(f => f.competition === "FA Cup");
    check(hasFirst === (entry === "Third Qualifying Round"), `${label}: a fixture on day one only if you play the 3rd Qualifying (${hasFirst})`);

    // Play the whole season.
    const yourRounds: string[] = [];
    for (let guard = 0; guard < 140; guard++) {
      const f = nextFixtureFor(c);
      if (!f) break;
      if (f.competition === "FA Cup") yourRounds.push(f.round ?? "?");
      c = simulateMissedFixture(c, f).career;
    }
    // The final is played after the last league match, at the season's end
    // (careerFlow resolveSeasonWinners), as it always was.
    const faLive = c.cupState!.find(s => s.competition === "FA Cup")!;
    const fa = faLive.winner ? faLive : finishCupToWinner(faLive, ratedTeams(c), club, mulberry32(9));
    check(!!fa.winner, `${label} (${club}): the FA Cup has a winner`);
    check(fa.rounds.length === 10, `${label} (${club}): ten rounds played (${fa.rounds.length})`);
    fa.rounds.forEach((r, i) => {
      check(r.name === FA_CUP_ROUND_NAMES[i], `${label}: round ${i + 1} is the ${FA_CUP_ROUND_NAMES[i]} (${r.name})`);
      check(clubsIn(fa, i) === SIZES[i], `${label}: ${r.name} has ${SIZES[i]} clubs (${clubsIn(fa, i)})`);
      check(r.ties.every(t => tieWinner(t) !== null), `${label}: every ${r.name} tie has a winner`);
      check(i === 0 || !(r.byes?.length), `${label}: no byes after the 3rd Qualifying (${r.name})`);
    });
    // Your club: first seen in its entry round, in a tie in every round it reached.
    const appearIn = fa.rounds.findIndex(r => r.ties.some(t => t.home === club || t.away === club));
    check(fa.rounds[appearIn]?.name === entry, `${label} (${club}): first tie in the ${entry} (${fa.rounds[appearIn]?.name})`);
    let still = true;
    for (let i = appearIn; i < fa.rounds.length && still; i++) {
      const t = fa.rounds[i].ties.find(x => x.home === club || x.away === club);
      check(!!t, `${label} (${club}): plays in the ${fa.rounds[i].name}`);
      check(!(fa.rounds[i].byes ?? []).includes(club), `${label} (${club}): no bye in the ${fa.rounds[i].name}`);
      if (t) {
        check(yourRounds.includes(fa.rounds[i].name), `${label} (${club}): ${fa.rounds[i].name} was on your calendar`);
        still = tieWinner(t) === club;
      }
    }
    // Nobody appears twice in a round.
    for (const r of fa.rounds) {
      const names = [...r.ties.flatMap(t => [t.home, t.away]), ...(r.byes ?? [])];
      check(new Set(names).size === names.length, `${label}: nobody twice in the ${r.name}`);
    }
  }
}

// ── 2. The byes: the best of last season, never yours ───────────────────────
{
  // Your club is the best-rated in the North: the 13th best takes its bye.
  const c0 = careerAt(NATIONAL_LEAGUE_NORTH_CLUBS[0], "national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS);
  const e = faCupEntrantsFor(c0);
  const best = e.north[0];
  const c = careerAt(best, "national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS);
  const e2 = faCupEntrantsFor(c);
  const cup = openFaCup(e2, best, mulberry32(3));
  const byes = cup.rounds[0].byes ?? [];
  check(!byes.includes(best), `the North's best club (${best}) plays when it is yours`);
  check(byes.includes(e2.north[12]), `…and the North's 13th (${e2.north[12]}) gets its bye`);
  const other = openFaCup(e2, "Arsenal", mulberry32(3));
  check((other.rounds[0].byes ?? []).includes(best), `with another club, the North's best (${best}) has a bye`);
  check((other.rounds[0].byes ?? []).filter(x => NATIONAL_LEAGUE_NORTH_CLUBS.includes(x)).length === 12, "12 North byes");
  // Step 3 clubs never get a bye, and play in their own region's draw.
  const step3 = [...e2.north.slice(24), ...e2.south.slice(24)];
  check(step3.length === 8 && !step3.some(x => byes.includes(x)), `the 8 Step 3 clubs all play (${step3.length})`);
  const northPlay = new Set(e2.north);
  check(cup.rounds[0].ties.every(t => northPlay.has(t.home) === northPlay.has(t.away)), "the 3rd Qualifying is drawn North and South");
}

// ── 3. A season later the byes follow last season's table ───────────────────
{
  let c = careerAt(PREMIER_LEAGUE_CLUBS[0], "premier", PREMIER_LEAGUE_CLUBS);
  for (let g = 0; g < 140; g++) { const f = nextFixtureFor(c); if (!f) break; c = simulateMissedFixture(c, f).career; }
  const next = advanceSeason(c, false).career;
  const table = next.lastWorld!.tables.find(t => t.division === "national_league_north")!.rows.map(r => r.name);
  const e = faCupEntrantsFor(next);
  const stayed = table.filter(x => e.north.includes(x));
  const order = e.north.filter(x => stayed.includes(x));
  check(JSON.stringify(order) === JSON.stringify(stayed), "season 2: the North's byes go in last season's finishing order");
  const fa = next.cupState!.find(s => s.competition === "FA Cup")!;
  check(clubsIn(fa, 0) === 56 && fa.rounds[0].byes?.length === 24, "season 2 opens the same way");
}

// ── 4. Dates: the rounds in order, the final last ───────────────────────────
for (const d of ["premier", "championship", "league_one", "national_league_north"] as CareerDivision[]) {
  const ts = faCupSlotsFor(d).map(s => fixtureTimestamp(2027, 1, s.week, "cup", d));
  check(ts.every((t, i) => i === 0 || t > ts[i - 1]), `${d}: the ten rounds are in date order`);
  check(faCupSlotsFor(d).length === 10, `${d}: ten dates`);
}

// ── 5. An old save's six-round cup still plays to a winner ──────────────────
{
  const c = careerAt(PREMIER_LEAGUE_CLUBS[0], "premier", PREMIER_LEAGUE_CLUBS);
  const old: CupState = { competition: "FA Cup", rounds: [{ name: "Round of 64", ties: Array.from({ length: 32 }, (_, i) => ({ home: `A${i}`, away: `B${i}` })) }] };
  let s = old;
  for (let i = 0; i < 7 && !s.winner; i++) s = playCupRound(s, ratedTeams(c), "nobody", null, mulberry32(i));
  check(!!s.winner && s.rounds.map(r => r.name).join() === "Round of 64,Round of 32,Round of 16,Quarter-Final,Semi-Final,Final", `old cup keeps its six rounds (${s.rounds.map(r => r.name).join()})`);
}

if (problems.length) {
  console.log(`FAIL faCupRounds (${problems.length})`);
  for (const p of problems.slice(0, 30)) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS faCupRounds");
