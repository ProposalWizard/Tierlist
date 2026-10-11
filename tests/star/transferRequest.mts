import {
  askForMove, agreeMove, callOffMove, canAsk, clearAfterWindow, clubsIn, judgeClub, playerOverall,
  summerWindowOffers, bonusOfferCount, talksFailed, weeksUntilAskable, requestOf,
  ASK_LEAGUE_BOSS_COST, ASK_CLUB_BOSS_COST, REFUSAL_COOLDOWN_WEEKS,
} from "../../lib/star/transferRequest";
import { acceptOffer, generateOffers } from "../../lib/star/transfers";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { LEAGUE_TWO_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import { divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { weeklyWageFor } from "../../lib/star/economy";
import type { CareerState, StarPlayer, LeaguePlayer } from "../../lib/star/types";

/**
 * ASKING FOR A MOVE (lib/star/transferRequest.ts).
 *
 * The brief's own two numbers: a 60-rated League Two player asking the
 * Premier League gets nothing; an 85 gets several. Everything else here is
 * the cost and the timing of asking.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** The star rating that shows as this overall (displayOverall: 30 + 14 a star). */
const starsFor = (overall: number) => (overall - 30) / 14;

function careerAt(division: CareerDivision, clubs: readonly string[], overall: number, age = 24): CareerState {
  const player = {
    firstName: "Test", lastName: "Player", age, skinTone: "light",
    club: clubs[5], clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
  const c = makeInitialCareer(player, [...clubs], division);
  return {
    ...c,
    // What a player at this club is really paid, not the starter deal.
    contract: { ...c.contract, wage: weeklyWageFor(c.player.club, division) },
    starRating: starsFor(overall),
    form: [6.8, 6.8, 6.8, 6.8, 6.8],
    week: 12,
    relationships: { ...c.relationships, boss: 70 },
  };
}

const yesCount = (c: CareerState, d: CareerDivision, seed: number) =>
  requestOf(askForMove(c, d, undefined, mulberry32(seed))).replies.filter(r => r.yes).length;

// ── The brief's numbers, measured over 40 seeds ───────────────────────────
const table: string[] = [];
for (const overall of [55, 60, 65, 70, 75, 80, 85, 90]) {
  const c = careerAt("league_two", LEAGUE_TWO_CLUBS, overall);
  check(playerOverall(c) === overall, `overall ${overall} reads back (${playerOverall(c)})`);
  const counts = Array.from({ length: 40 }, (_, s) => yesCount(c, "premier", 1000 + s));
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const max = Math.max(...counts);
  table.push(`${overall}: avg ${avg.toFixed(1)} of ${clubsIn(c, "premier").length}, max ${max}`);
  if (overall === 60) check(max === 0, `a 60 asking the Premier League gets 0 offers (max ${max})`);
  if (overall === 85) check(avg >= 5, `an 85 asking the Premier League gets several (avg ${avg.toFixed(1)})`);
}
console.log("League Two player asking the Premier League, yes answers:\n  " + table.join("\n  "));

// ── A 60 still has somewhere to go: his own level ─────────────────────────
{
  const c = careerAt("league_two", LEAGUE_TWO_CLUBS, 60);
  const counts = Array.from({ length: 40 }, (_, s) => yesCount(c, "national_league", 2000 + s));
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  check(avg >= 3, `a 60 asking the National League gets offers (avg ${avg.toFixed(1)})`);
}

// ── Age: a 34-year-old is wanted less than a 24-year-old ──────────────────
{
  const young = careerAt("league_two", LEAGUE_TWO_CLUBS, 82, 24);
  const old = careerAt("league_two", LEAGUE_TWO_CLUBS, 82, 34);
  const sum = (c: CareerState) => Array.from({ length: 30 }, (_, s) => yesCount(c, "premier", 3000 + s)).reduce((a, b) => a + b, 0);
  check(sum(old) < sum(young), `age counts against you (${sum(old)} vs ${sum(young)})`);
}

// ── Squad need from the real squad: three strikers better = "we're full" ──
{
  const c = careerAt("championship", CHAMPIONSHIP_CLUBS, 74);
  const target = clubsIn(c, "championship").find(x => Math.abs(x.strength - 74) < 8) ?? clubsIn(c, "championship")[10];
  const strikers: LeaguePlayer[] = [0, 1, 2, 3].map(i => ({
    id: `s${i}`, name: `Striker ${i}`, position: "ST", overall: 88, goals: 0, assists: 0,
  } as LeaguePlayer));
  const full: CareerState = {
    ...c,
    starRating: starsFor(Math.round(target.strength + 1)),
    leagueSquads: [{ club: target.club, players: strikers }],
  };
  const replies = Array.from({ length: 40 }, (_, s) => judgeClub(full, target.club, "championship", mulberry32(4000 + s)));
  const crowded = replies.filter(r => r.reason === "crowded");
  check(crowded.length > 0, `a club with four better strikers says so (${crowded.length}/40)`);
  check(crowded.every(r => /four strikers better than you/.test(r.message)), `the reason names them: "${crowded[0]?.message}"`);
  const empty: CareerState = { ...full, leagueSquads: [{ club: target.club, players: strikers.map(p => ({ ...p, overall: 40 })) }] };
  const yesFull = replies.filter(r => r.yes).length;
  const yesEmpty = Array.from({ length: 40 }, (_, s) => judgeClub(empty, target.club, "championship", mulberry32(4000 + s))).filter(r => r.yes).length;
  check(yesEmpty > yesFull, `a club that needs a striker says yes more (${yesEmpty} vs ${yesFull})`);
}

// ── What asking costs, and how often you can ──────────────────────────────
{
  const c = careerAt("league_two", LEAGUE_TWO_CLUBS, 70);
  const asked = askForMove(c, "league_one", undefined, mulberry32(7));
  check(asked.relationships.boss === c.relationships.boss - ASK_LEAGUE_BOSS_COST, `a whole league costs the manager ${ASK_LEAGUE_BOSS_COST}`);
  check(!canAsk(asked).ok, "only one ask a week");
  check(askForMove(asked, "league_one", undefined, mulberry32(8)) === asked, "a second ask the same week does nothing");
  const nextWeek = { ...asked, week: asked.week + 1 };
  const one = clubsIn(c, "premier")[0].club;
  const askedOne = askForMove(nextWeek, "premier", one, mulberry32(9));
  check(askedOne.relationships.boss === asked.relationships.boss - ASK_CLUB_BOSS_COST, `one club costs ${ASK_CLUB_BOSS_COST}`);
  check(requestOf(askedOne).replies.length === 1 && requestOf(askedOne).replies[0].club === one, "asking one club asks only that club");
  check(requestOf(askedOne).replies.every(r => r.club !== c.player.club), "never your own club");
  // A no cools off, then can be asked again.
  const no = requestOf(askedOne).replies[0];
  check(!no.yes, `a 70 in League Two is turned down by ${one}`);
  check(weeksUntilAskable(askedOne, one) === REFUSAL_COOLDOWN_WEEKS, `a no waits ${REFUSAL_COOLDOWN_WEEKS} weeks`);
  const soon = askForMove({ ...askedOne, week: askedOne.week + 1 }, "premier", one, mulberry32(10));
  check(soon === askedOne || requestOf(soon).replies.length === 0 || soon.week === askedOne.week + 1 && requestOf(soon).asks === requestOf(askedOne).asks,
    "a club cooling off is not asked again");
  const later = { ...askedOne, week: askedOne.week + REFUSAL_COOLDOWN_WEEKS };
  check(weeksUntilAskable(later, one) === 0, "after the wait it can be asked again");
  check(weeksUntilAskable({ ...askedOne, season: askedOne.season + 1, week: 1 }, one) === 0, "a new season wipes the wait");
}

// ── Agree a deal, it waits for the summer window, then it is gone ─────────
{
  const c = careerAt("league_two", LEAGUE_TWO_CLUBS, 85);
  const asked = askForMove(c, "premier", undefined, mulberry32(11));
  const yes = requestOf(asked).replies.find(r => r.yes && r.offer);
  check(!!yes, "an 85 has a yes to agree");
  if (yes?.offer) {
    const agreed = agreeMove(asked, yes.offer, yes.offer.wage + 50);
    const deal = requestOf(agreed).agreed!;
    check(deal.wage === yes.offer.wage + 50, "the talked-up wage is kept");
    check(!canAsk({ ...agreed, week: agreed.week + 3 }).ok, "no more asking once a deal is agreed");
    const window = summerWindowOffers(agreed, generateOffers(agreed, mulberry32(12)), mulberry32(13));
    check(window[0]?.club === yes.club, "the agreed deal is first in the summer window");
    check(new Set(window.map(o => o.club)).size === window.length, "one card per club");
    check(!requestOf(clearAfterWindow(agreed)).agreed, "the window clears the deal");
    check(!requestOf(callOffMove(agreed)).agreed, "a deal can be called off");

    // Signing it at the end of the season really moves you up two divisions.
    const moved = acceptOffer(agreed, deal);
    const { career: next } = advanceSeason(moved, false, true);
    check(next.player.club === yes.club, "signed for the club asked");
    check(divisionOf(next) === "premier", `next season is in the Premier League (${divisionOf(next)})`);
    check(next.league.some(t => t.name === yes.club), "the new club is in next season's table");
  }
  // Talks breaking down withdraws the offer.
  if (yes) {
    const broke = talksFailed(asked, yes.club);
    const r = requestOf(broke).replies.find(x => x.club === yes.club)!;
    check(!r.yes && !r.offer && r.reason === "talks", "talks breaking down withdraws the offer");
  }
}

// ── A good season brings more clubs at the end of it ─────────────────────
{
  const poor = { ...careerAt("league_two", LEAGUE_TWO_CLUBS, 55), form: [5.5, 5.8, 6.0], seasonStats: { ...careerAt("league_two", LEAGUE_TWO_CLUBS, 55).seasonStats, goals: 2 } };
  const good = { ...careerAt("league_two", LEAGUE_TWO_CLUBS, 82), form: [8.2, 8.0, 8.4], seasonStats: { ...careerAt("league_two", LEAGUE_TWO_CLUBS, 82).seasonStats, goals: 25 } };
  check(bonusOfferCount(poor) === 0, `a poor season brings no extra clubs (${bonusOfferCount(poor)})`);
  check(bonusOfferCount(good) >= 1, `a good season brings extra clubs (${bonusOfferCount(good)})`);
  const n = (c: CareerState) => Array.from({ length: 20 }, (_, s) =>
    summerWindowOffers(c, generateOffers(c, mulberry32(500 + s)), mulberry32(600 + s)).length).reduce((a, b) => a + b, 0) / 20;
  const poorN = n(poor), goodN = n(good);
  console.log(`End-of-season offers: poor season ${poorN.toFixed(1)}, good season ${goodN.toFixed(1)}`);
  check(goodN > poorN, `more offers after a good season (${goodN.toFixed(1)} vs ${poorN.toFixed(1)})`);
  const extra = summerWindowOffers(good, [], mulberry32(77));
  check(extra.some(o => o.division === "league_one"), "an extra offer can come from the division above");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — asking for a move: 60 gets no Premier League club, 85 gets several; asking costs the manager and waits for summer");
