// Twin test: whole careers through the real career code, the way the
// website's career soak (scripts/soak/careerSoak.mts) drives them. After every
// match and every season it prints a fingerprint; the website and Roblox must
// print the same lines, so every table, cup draw, transfer, award and pound
// must come out the same.
//   CAREER_SEASONS=2 CAREER_DIVS=premier,league_two npx tsx roblox/twin/career.twin.ts
import { makeInitialCareer, creditMatchResult, advanceSeason, simulateMissedFixture } from "../../lib/star/careerFlow";
import * as C from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, Fixture, MatchStats, StarPlayer, CareerDivision } from "../../lib/star/types";
import { show } from "./_out";

const SEASONS = Number(process.env.CAREER_SEASONS ?? 2);
const ONLY = process.env.CAREER_DIVS?.split(",");
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
const label = (f: Fixture) => `${f.competition ?? "League"}/${f.round ?? f.kind ?? ""}${f.leg ? " L" + f.leg : ""}@${f.week} v ${f.opponent}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

function fingerprint(c: CareerState): string {
  const table = c.league.map((t) => `${t.name}:${t.played}/${t.points}/${t.goalsFor}-${t.goalsAgainst}`).join(",");
  return show({
    season: c.season, club: c.player.club, money: r2(c.money), fame: r2(c.fame), star: r2(c.starRating),
    table, fixtures: c.fixtures.length, unplayed: c.fixtures.filter((f) => !f.played).length,
    trophies: (c.trophies ?? []).map((t) => `${t.name}@${t.season}`),
    winners: c.lastSeasonWinners, squad: c.squad.length,
  });
}

for (const [div, clubs] of DIVS) {
  for (const style of ["win", "lose", "mixed"] as const) {
    const club = clubs[(style === "win" ? 0 : style === "lose" ? 5 : 11) % clubs.length];
    const p = { firstName: "Soak", lastName: "Test", age: 17, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
    let c = makeInitialCareer(p, [...clubs], div);
    console.log(`== ${div}/${style} start ${fingerprint(c)}`);
    for (let s = 1; s <= SEASONS; s++) {
      let g = 0;
      while (g++ < 250) {
        const next = nextFixtureFor(c);
        if (!next) break;
        const us = style === "win" ? 3 : style === "lose" ? 0 : (g * 7) % 4;
        const them = style === "win" ? 0 : style === "lose" ? 2 : (g * 5) % 3;
        c = (g % 9 === 0 ? simulateMissedFixture(c, next) : creditMatchResult(c, next, stats(us, them, next.home, Math.min(us, 2)))).career;
        const me = c.league.find((t) => t.name === c.player.club);
        console.log(`${label(next)} | ${me ? `${me.played}/${me.points}` : "-"} | ${r2(c.money)} | ${r2(c.fame)}`);
      }
      c = advanceSeason(c, false).career;
      console.log(`== ${div}/${style} after season ${s} ${fingerprint(c)}`);
    }
  }
}
