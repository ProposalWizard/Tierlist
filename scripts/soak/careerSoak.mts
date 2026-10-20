/**
 * CAREER SOAK (Mikey, 20 Oct 2026): careers in every division (win, lose, mixed),
 * N seasons each (default 4), checking the things that must always hold. Run:
 *   npx tsx scripts/soak/careerSoak.mts 20            (every division, 20 seasons)
 *   npx tsx scripts/soak/careerSoak.mts 6 premier     (one division)
 * 20 seasons x 21 careers = 20,029 matches in about 85 s. Prints "all held" or each broken rule.
 */
import { makeInitialCareer, creditMatchResult, advanceSeason, simulateMissedFixture } from "../../lib/star/careerFlow";
import * as C from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import { fixtureTimestamp, divisionOf } from "../../lib/star/calendar";
import type { CareerState, Fixture, MatchStats, StarPlayer, CareerDivision } from "../../lib/star/types";

const problems = new Map<string, number>();
const check = (ok: boolean, what: string) => { if (!ok) problems.set(what, (problems.get(what) ?? 0) + 1); };
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const SEASONS = Number(process.argv[2] ?? 4);

const ONLY = process.argv[3]?.split(",");
const DIVS0: [CareerDivision, readonly string[]][] = [
  ["premier", C.PREMIER_LEAGUE_CLUBS], ["championship", C.CHAMPIONSHIP_CLUBS], ["league_one", C.LEAGUE_ONE_CLUBS],
  ["league_two", C.LEAGUE_TWO_CLUBS], ["national_league", C.NATIONAL_LEAGUE_CLUBS],
  ["national_league_north", C.NATIONAL_LEAGUE_NORTH_CLUBS], ["national_league_south", C.NATIONAL_LEAGUE_SOUTH_CLUBS],
];
const DIVS = ONLY ? DIVS0.filter(([d]) => ONLY.includes(d)) : DIVS0;

function stats(us: number, them: number, home: boolean, goals: number): MatchStats {
  return { chances: 5, goals, assists: 1, passes: 28, rating: 7.2, starMan: goals >= 2, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
}
const label = (f: Fixture) => `${f.competition ?? "League"}/${f.round ?? f.kind ?? ""}${f.leg ? " L" + f.leg : ""}@${f.week}`;

function audit(c: CareerState, when: string) {
  for (const t of c.league) check(finite(t.points) && t.played === t.won + t.drawn + t.lost, `${when}: table sums`);
  check(c.league.some(t => t.name === c.player.club), `${when}: own club in own table`);
  check(finite(c.money) && finite(c.fame) && finite(c.starRating), `${when}: headline numbers finite`);
  check(Math.abs(c.money) < 1e13, `${when}: money stays sane`);
  check(c.squad.length >= 11 && c.squad.length <= 60, `${when}: own squad 11-60 (${c.squad.length >= 11 ? "big" : "small"})`);
  for (const sq of c.leagueSquads ?? []) check(sq.players.length <= 70, `${when}: no club squad over 70`);
  const sizes: Record<string, number> = { premier: 20, championship: 24, league_one: 24, league_two: 24, national_league: 24, national_league_north: 24, national_league_south: 24 };
  const want = sizes[divisionOf(c)];
  if (want) check(c.league.length === want, `${when}: ${divisionOf(c)} has ${want} clubs (has ${c.league.length})`);
  check(new Set(c.league.map(t => t.name)).size === c.league.length, `${when}: no club twice in the table`);
  const keys = new Set<string>();
  for (const f of c.fixtures) {
    check(f.opponent !== c.player.club, `${when}: never plays itself (${f.competition})`);
    check(!!f.opponent, `${when}: fixture has an opponent (${f.competition})`);
    const k = `${f.competition}|${f.round ?? ""}|${f.leg ?? ""}|${f.opponent}|${f.week}`;
    check(!keys.has(k), `${when}: no duplicate fixture (${f.competition} ${f.round ?? ""})`);
    keys.add(k);
  }
  const fa = c.fixtures.filter(f => f.competition === "FA Cup" && !f.leg);
  const rounds = fa.map(f => f.round ?? "?");
  check(new Set(rounds).size === rounds.length, `${when}: one FA Cup tie per round`);
  const st = (c.cupState ?? []).find(s => s.competition === "FA Cup") as unknown as { byes?: unknown } | undefined;
  if (st?.byes) {
    const all = JSON.stringify(st.byes);
    check(!all.includes(`"${c.player.club}"`), `${when}: your club never gets an FA Cup bye`);
  }
}

let shown = 0, careers = 0, seasons = 0, matches = 0;
const t0 = Date.now();
for (const [div, clubs] of DIVS) {
  for (const style of ["win", "lose", "mixed"] as const) {
    const club = clubs[(style === "win" ? 0 : style === "lose" ? 5 : 11) % clubs.length];
    const p = { firstName: "Soak", lastName: "Test", age: 17, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
    let c: CareerState;
    try { c = makeInitialCareer(p, [...clubs], div); } catch (e) { check(false, `${div}: makeInitialCareer throws ${(e as Error).message}`); continue; }
    careers++;
    audit(c, `${div}/${style} start`);
    for (let s = 1; s <= SEASONS; s++) {
      let g = 0;
      const seasonAt = c.season;
      while (g++ < 250) {
        const next = nextFixtureFor(c);
        if (!next) break;
        const ts = (f: Fixture) => fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, divisionOf(c));
        const nowT = ts(next);
        const us = style === "win" ? 3 : style === "lose" ? 0 : (g * 7) % 4;
        const them = style === "win" ? 0 : style === "lose" ? 2 : (g * 5) % 3;
        try {
          c = (g % 9 === 0 ? simulateMissedFixture(c, next) : creditMatchResult(c, next, stats(us, them, next.home, Math.min(us, 2)))).career;
        } catch (e) { check(false, `${div}/${style}: match throws ${(e as Error).message.slice(0, 120)}`); break; }
        matches++;
        audit(c, `${div}/${style} in season`);
        if (c.season === seasonAt) {
          const earlier = c.fixtures.filter(f => !f.played && ts(f) < nowT);
          check(earlier.length === 0, `${div}/${style}: a fixture left dated before a match already played`);
          if (earlier.length && shown++ < 10) console.log(`  e.g. ${div}/${style} s${c.season}: played ${label(next)}; left behind ${earlier.map(label).join(", ")}`);
        }
      }
      check(g < 250, `${div}/${style}: season ends`);
      try { c = advanceSeason(c, false).career; seasons++; } catch (e) { check(false, `${div}/${style}: rollover throws ${(e as Error).stack?.slice(0, 300)}`); break; }
      audit(c, `${div}/${style} after rollover`);
      check(c.fixtures.some(f => !f.played), `${div}/${style}: new season has fixtures`);
    }
  }
}
console.log(`${careers} careers, ${seasons} seasons, ${matches} matches, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const [k, n] of problems) console.log(`  ✗ ${k} ×${n}`);
if (!problems.size) console.log("all held");
