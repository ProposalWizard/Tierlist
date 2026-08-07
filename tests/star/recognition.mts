import {
  goldenBootRace, leadingScorer, monthlyAward, seasonAwards, captaincyEarned,
  assignSquadNumber, MONTH_WEEKS,
} from "../../lib/star/recognition";
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { acceptOffer, generateOffers } from "../../lib/star/transfers";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * Awards, the armband and the number on your back.
 *
 * Three things absent in the same way. The Ballon d'Or was the only individual
 * honour in the game, so a season of twenty-five goals that did not win it left
 * no trace at all. Captaincy existed solely as a dilemma about the CURRENT
 * captain being annoyed with you. And you played fifteen seasons without a squad
 * number.
 *
 * None of it changes how you play, so what this file mostly guards is that none
 * of it can be had for free.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 22, position: "ST",
  club: "Arsenal", nationality: "England", startYear: 2026,
} as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const result = (goals: number, rating: number): MatchStats => ({
  minutes: 90, chances: 5, goals, assists: 0, passes: 12, rating, starMan: rating >= 8.5,
  bossChange: 3, teamChange: 3, fansChange: 3,
  wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1, homeScore: goals, awayScore: 0,
});

/** Play n matches with a fixed performance. */
function playN(c: CareerState, n: number, goals: number, rating: number): CareerState {
  for (let i = 0; i < n; i++) {
    const f = nextFixtureFor(c);
    if (!f) break;
    c = creditMatchResult(c, f, result(goals, rating)).career;
  }
  return c;
}

// ── The scoring charts ──────────────────────────────────────────────────────
{
  const c = base();
  const race = goldenBootRace(c);
  check(race.length === CLUBS.length, "every club has a leading scorer, including yours");
  check(race.filter(s => s.isYou).length === 1, "and you appear exactly once");
  check(race.every((s, i) => i === 0 || race[i - 1].goals >= s.goals), "the chart is sorted");

  // Stable within a season, different between them — a chart that reshuffled on
  // every render would be unreadable.
  const again = goldenBootRace(c);
  check(JSON.stringify(race.map(r => r.goals)) === JSON.stringify(again.map(r => r.goals)),
    "the chart does not change under a re-render");
  const nextYear = goldenBootRace({ ...c, season: c.season + 1 });
  check(JSON.stringify(nextYear.map(r => r.name)) !== JSON.stringify(race.map(r => r.name)),
    "and a new season is a new set of rivals");

  // It grows with the season rather than appearing at the end.
  const early = goldenBootRace({ ...c, league: c.league.map(t => ({ ...t, played: 2 })) });
  const late = goldenBootRace({ ...c, league: c.league.map(t => ({ ...t, played: 18 })) });
  const total = (r: typeof race) => r.filter(s => !s.isYou).reduce((n, s) => n + s.goals, 0);
  check(total(late) > total(early), `the race is live all season (${total(early)} → ${total(late)} rival goals)`);

  // Leading it takes actually leading it.
  check(!leadingScorer(playN(c, 3, 0, 6.5)), "you do not top the charts without scoring");
  const prolific = { ...c, seasonStats: { ...c.seasonStats, goals: 60, appearances: 18 } };
  check(leadingScorer(prolific), "sixty goals does");
}

// ── Awards are earned ───────────────────────────────────────────────────────
{
  const c = base();
  check(seasonAwards(c).length === 0, "a career that has played nothing wins nothing");

  // Golden Boot needs the goals.
  const topScorer: CareerState = {
    ...c, seasonStats: { ...c.seasonStats, goals: 60, appearances: 18, ratingCount: 18, totalRating: 18 * 7.0 },
  };
  check(seasonAwards(topScorer).some(a => a.kind === "Golden Boot"), "leading the charts wins the Golden Boot");

  // Player of the Season needs more than goals: ratings AND a team that did
  // something. An individual award for a season nobody watched is not what it
  // is for.
  const bottom = topScorer.league.map((t, i) => t.name === "Arsenal" ? { ...t, points: 0 } : { ...t, points: 50 - i });
  const relegated: CareerState = {
    ...topScorer,
    league: bottom,
    seasonStats: { ...topScorer.seasonStats, ratingCount: 18, totalRating: 18 * 8.2 },
  };
  check(!seasonAwards(relegated).some(a => a.kind === "Player of the Season"),
    "sixty goals for the worst team in the league is not Player of the Season");

  const champions: CareerState = {
    ...topScorer,
    league: topScorer.league.map((t, i) => t.name === "Arsenal" ? { ...t, points: 99 } : { ...t, points: 40 - i }),
    seasonStats: { ...topScorer.seasonStats, ratingCount: 18, totalRating: 18 * 8.2 },
  };
  check(champions && seasonAwards(champions).some(a => a.kind === "Player of the Season"),
    "the same season at the top of the table is");

  // Player of the Month lands on the boundary and only for a real run.
  const good: CareerState = { ...c, week: MONTH_WEEKS, form: [8.4, 8.1, 8.6, 8.2] };
  check(monthlyAward(good)?.kind === "Player of the Month", "a month of eights wins it");
  check(monthlyAward({ ...good, form: [6.8, 6.5, 7.0, 6.6] }) === null, "a month of sixes does not");
  check(monthlyAward({ ...good, week: MONTH_WEEKS + 1 }) === null, "and it is only judged on the boundary");
}

// ── The armband is earned, and lost on a move ──────────────────────────────
{
  const c = base();
  check(!captaincyEarned(c), "a new signing is not the captain");
  check(!c.captain, "and does not start with it");

  const leader: CareerState = {
    ...c,
    relationships: { ...c.relationships, team: 85, boss: 80 },
    starRating: 3.8,
    clubAppearances: 40,
  };
  check(captaincyEarned(leader), "a senior player the dressing room backs is");

  // Every condition is necessary — none of them can be skipped.
  check(!captaincyEarned({ ...leader, relationships: { ...leader.relationships, team: 40 } }),
    "…but not one the dressing room does not");
  check(!captaincyEarned({ ...leader, relationships: { ...leader.relationships, boss: 30 } }),
    "nor one the manager does not");
  check(!captaincyEarned({ ...leader, clubAppearances: 3 }),
    "nor one who signed three weeks ago, however good he is");

  // It is given in play, and a transfer takes it away.
  let played = base();
  played = { ...played, relationships: { ...played.relationships, team: 85, boss: 80 }, starRating: 3.8, clubAppearances: 40 };
  played = playN(played, 1, 1, 7.5);
  check(played.captain === true, "the armband is handed over after a match, not in a menu");
  check((played.clubAppearances ?? 0) > 40, "and club appearances are counted");

  // Interest is probabilistic, so take the first seed that produces an offer
  // rather than assuming one does.
  const wanted = { ...played, starRating: 4.2, fame: 60 };
  let offer = null;
  for (let seed = 1; seed <= 40 && !offer; seed++) {
    offer = generateOffers(wanted, mulberry32(seed))[0] ?? null;
  }
  check(!!offer, "a well-known player attracts an offer within forty draws");
  if (offer) {
    const moved = acceptOffer(played, offer);
    check(moved.captain === false, "you are not the captain of a club you signed for yesterday");
    check((moved.clubAppearances ?? 0) === 0, "and your appearances there start at zero");
    check(moved.squadNumber !== undefined, "and you are given a shirt at the new club");
  }
}

// ── The number on your back ────────────────────────────────────────────────
{
  const c = base();
  check(typeof c.squadNumber === "number" && c.squadNumber! > 0, `a new career has a number (#${c.squadNumber})`);
  check(c.squadNumber! <= 40, "and it is a plausible one");

  // Deterministic: the same player at the same club at the same point gets the
  // same shirt, so it cannot flicker under a re-render.
  check(assignSquadNumber(c, "Arsenal") === assignSquadNumber(c, "Arsenal"), "the number is stable");

  // Position-appropriate, and a star gets the shirt.
  const striker: CareerState = { ...c, player: { ...PLAYER, position: "ST" }, starRating: 4.5 };
  check(assignSquadNumber(striker, "Arsenal") === 9, "a star striker gets the nine");
  const keeper: CareerState = { ...c, player: { ...PLAYER, position: "GK" }, starRating: 4.5 };
  check(assignSquadNumber(keeper, "Arsenal") === 1, "a keeper gets the one");
  const winger: CareerState = { ...c, player: { ...PLAYER, position: "LW" }, starRating: 4.5 };
  check(assignSquadNumber(winger, "Arsenal") === 11, "a winger gets the eleven");

  // Different clubs, different squads, different numbers available.
  const numbers = new Set(CLUBS.map(club => assignSquadNumber({ ...c, starRating: 2.0 }, club)));
  check(numbers.size > 1, "a squad player does not get the same number everywhere");
}

// ── End-of-season honours are banked before the stats reset ────────────────
{
  let c = base();
  c = { ...c, seasonStats: { ...c.seasonStats, goals: 60, appearances: 18, ratingCount: 18, totalRating: 18 * 8.3 } };
  c = { ...c, league: c.league.map((t, i) => t.name === "Arsenal" ? { ...t, points: 99 } : { ...t, points: 40 - i }) };

  const next = advanceSeason(c, false).career;
  check((next.awards ?? []).length > 0, "the season's honours survive the rollover");
  check((next.awards ?? []).some(a => a.kind === "Golden Boot"),
    "…including one judged on stats that the rollover then wipes");
  check(next.seasonStats.goals === 0, "and the stats really are wiped");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — awards are won, the armband is earned, and everyone has a number");
