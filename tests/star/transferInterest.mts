import {
  windowInterest, seasonReport, clubAim, levelOf, markWalkedAway, walkedAway, MAX_REACH, JANUARY_MAX_REACH,
} from "../../lib/star/transferInterest";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { NATIONAL_LEAGUE_NORTH_CLUBS, LEAGUE_TWO_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { leagueNameFor, type CareerDivision } from "../../lib/star/calendar";
import { weeklyWageFor } from "../../lib/star/economy";
import type { CareerState, StarPlayer, SeasonStats } from "../../lib/star/types";

/**
 * THE CLUBS INTERESTED IN YOU (lib/star/transferInterest.ts).
 *
 * The brief (18 Oct 2026): a good season brings the division above, a crazy
 * one (about 2 goals a game) up to three above, never more; inside that,
 * smaller clubs and clubs that finished low come in first.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function careerAt(division: CareerDivision, clubs: readonly string[], position = "ST", season = 1): CareerState {
  const player = {
    firstName: "Test", lastName: "Player", age: 19, skinTone: "light",
    club: clubs[5], clubBadge: null, position, nationality: "England", startYear: 2027,
  } as StarPlayer;
  const c = makeInitialCareer(player, [...clubs], division);
  return { ...c, season, contract: { ...c.contract, wage: weeklyWageFor(c.player.club, division) } };
}

function withSeason(c: CareerState, apps: number, goals: number, assists: number, rating: number, starMan = 0): CareerState {
  const s: SeasonStats = { appearances: apps, goals, assists, hatTricks: 0, passes: 0, starMan, totalRating: rating * apps, ratingCount: apps };
  return { ...c, seasonStats: s };
}

const summary = (c: CareerState, w: "summer" | "january" = "summer") => {
  const i = windowInterest(c, w);
  return { i, line: `${i.report.grade} (reach ${i.report.reach.toFixed(2)}) → ` + i.leagues.map(l => `${leagueNameFor(l.division)} ${l.clubs.length}`).join(", ") };
};

const nln = careerAt("national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS);
const own = levelOf("national_league_north");
const seasons: [string, CareerState][] = [
  ["poor (4 in 40, 6.3)", withSeason(nln, 40, 4, 1, 6.3)],
  ["steady (12 in 40, 6.8)", withSeason(nln, 40, 12, 3, 6.8)],
  ["good (24 in 40, 7.3)", withSeason(nln, 40, 24, 6, 7.3, 8)],
  ["great (45 in 40, 7.9)", withSeason(nln, 40, 45, 10, 7.9, 18)],
  ["crazy (100 in 44, 8.9)", withSeason(nln, 44, 100, 15, 8.9, 35)],
];
const out: string[] = [];
let prevTop = -1;
for (const [name, c] of seasons) {
  const { i, line } = summary(c);
  out.push(`${name}: ${line}`);
  const top = Math.max(...i.leagues.map(l => levelOf(l.division)), -1);
  check(top <= own + MAX_REACH, `${name}: never more than ${MAX_REACH} up (top level ${top})`);
  check(top - own <= i.report.ceiling, `${name}: nothing above the ceiling ${i.report.ceiling}`);
  check(top >= prevTop, `${name}: a better season never reaches lower (${top} < ${prevTop})`);
  prevTop = top;
  check(!i.leagues.some(l => l.clubs.some(k => k.club === c.player.club)), `${name}: your own club is never on the list`);
}
console.log("National League North striker, age 19:\n  " + out.join("\n  "));

// The brief's anchors.
const good = windowInterest(seasons[2][1], "summer");
check(good.report.grade === "Good", `24 in 40 is a good season (${good.report.grade})`);
check(good.leagues.some(l => l.division === "national_league"), "a good season brings National League interest");
const ownList = good.leagues.find(l => l.division === "national_league_north");
check(!!ownList && ownList.clubs.length >= 15, `a good season: most of your own division wants you (${ownList?.clubs.length})`);
const crazy = windowInterest(seasons[4][1], "summer");
check(crazy.report.grade === "Crazy", `100 goals is a crazy season (${crazy.report.grade})`);
check(crazy.leagues.some(l => l.division === "league_one"), "a crazy season can bring League One");
check(!crazy.leagues.some(l => levelOf(l.division) > own + 3), "…but never the Championship or above");
const poor = windowInterest(seasons[0][1], "summer");
check(!poor.leagues.some(l => levelOf(l.division) > own), "a poor season: nobody from above");

// Inside a division: low finishers and smaller clubs aim lower.
const l2 = careerAt("league_two", LEAGUE_TWO_CLUBS);
const aims = l2.league.map(t => ({ club: t.name, aim: clubAim(l2, "league_two", t.name) }));
check(aims.every(a => Math.abs(a.aim - levelOf("league_two")) <= 0.61), "every aim within ±0.6 of its division");
const pl = careerAt("premier", PREMIER_LEAGUE_CLUBS);
const united = clubAim(pl, "premier", "Manchester United");
const bournemouth = clubAim(pl, "premier", "AFC Bournemouth");
console.log(`Premier League aims: Man United ${united.toFixed(2)}, Bournemouth ${bournemouth.toFixed(2)}`);

// January: one division up at most, and the same list each time.
const jan = withSeason(nln, 20, 30, 5, 8.4, 12);
const ji = windowInterest(jan, "january");
check(ji.report.ceiling <= JANUARY_MAX_REACH, `January ceiling ${ji.report.ceiling} ≤ ${JANUARY_MAX_REACH}`);
check(JSON.stringify(ji) === JSON.stringify(windowInterest(jan, "january")), "the January list is the same each time it opens");
check(seasonReport(withSeason(nln, 5, 10, 0, 9), "january").ceiling === 0, "five games say nothing yet");

// A club that walks away is gone for the window, and back the next.
const firstClub = good.leagues[0].clubs[0].club;
const after = markWalkedAway(seasons[2][1], "summer", firstClub);
check(walkedAway(after, "summer").includes(firstClub), "walked away is remembered");
check(!windowInterest(after, "summer").leagues.some(l => l.clubs.some(k => k.club === firstClub)), "a club that walked away is off the list");
check(windowInterest({ ...after, transferWindow: { key: "0-january", walkedAway: [firstClub] } }, "summer").leagues.some(l => l.clubs.some(k => k.club === firstClub)), "…and back next window");

// Every offer carries a fee for your club and sensible terms.
for (const l of good.leagues) for (const k of l.clubs) {
  check(k.fee > 0 && k.offer.transferFee === k.fee, `${k.club}: a fee for your club`);
  check(k.offer.wage > 0 && k.offer.seasons >= 2 && k.offer.seasons <= 4, `${k.club}: terms`);
  check(k.offer.division === l.division, `${k.club}: division on the offer`);
}

if (problems.length) { console.error("FAIL\n  - " + problems.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log("PASS — the clubs interested in you follow your season");
