import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, mediaOf } from "../../lib/star/media/feed";
import { detectLeagueWeek } from "../../lib/star/media/detect/league";
import { buildRoster } from "../../lib/star/media/accounts";
import { allegiance } from "../../lib/star/media/select";
import type { CareerState, GoalEvent, LeagueResult, MatchStats, StarPlayer } from "../../lib/star/types";
import type { FootballEvent } from "../../lib/star/media/types";

/**
 * THE REST OF THE DIVISION, ON YOUR PHONE.
 *
 * Everything in media/feed.ts before this suite only ever generated events
 * about YOUR club — your match, your career. This is the pass that reads
 * everyone else's fixtures for the same week (already simulated by
 * `playLeagueWeek`, just never fed anywhere) and turns them into the same
 * shape of event the existing "club"/"league" templates already know how
 * to write about, for the new England tab.
 *
 * Two things that had to be true before a single post could safely exist:
 * `select.ts`'s `allegiance()` had never once been asked about a club that
 * WASN'T `yourClub`, because no such event had ever existed — checked
 * directly below, since a silent regression there would have your own
 * supporters' account tweeting about a Newcastle-Fulham scoreline.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];

function newCareer(seed = 1): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: CLUBS[seed % CLUBS.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  };
  return makeInitialCareer(player, CLUBS);
}

/** Plays one fixture and returns the after-state plus the week it was
 *  actually played in — captured BEFORE crediting, the same way
 *  app/star-dev/page.tsx already has `nextFixture.week` in hand, rather
 *  than guessing it back out of `career.week` afterward. */
function playOne(career: CareerState, seed: number): { career: CareerState; week: number } | null {
  const fixture = career.fixtures.find(f => !f.played && f.week === career.week)
    ?? career.fixtures.find(f => !f.played);
  if (!fixture) return null;
  const events: GoalEvent[] = [{
    minute: 40, scorer: `${career.player.firstName} ${career.player.lastName}`, isUserGoal: true,
    how: "one_on_one", distance: 10,
  }];
  const stats: MatchStats = {
    chances: 4, goals: 1, assists: 0, passes: 30, rating: 7.2, starMan: false,
    bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: 1, sponsorPay: 0,
    totalCash: 3, homeScore: 1, awayScore: 0, goalEvents: events, minutes: 90,
  };
  const { career: after } = creditMatchResult(career, fixture, stats);
  after.media = generateForMatch(career, after, fixture, stats);
  return { career: after, week: fixture.week };
}

/** This week's OTHER fixtures — exactly what app/star-dev/page.tsx now
 *  hands to `generateForLeagueWeek`. */
function restOfWeek(c: CareerState, week: number): LeagueResult[] {
  return (c.results ?? []).filter(
    r => r.week === week && r.home !== c.player.club && r.away !== c.player.club,
  );
}

// ── detectLeagueWeek: the shape ─────────────────────────────────────────────
{
  const results: LeagueResult[] = [
    { week: 5, home: "Arsenal", away: "Chelsea", hs: 3, as: 0 },
    {
      week: 5, home: "Everton", away: "Fulham", hs: 1, as: 1,
      hg: [{ m: 30, s: "Calvert-Lewin", full: "Dominic Calvert-Lewin", role: "ST" }],
    },
    // A different week — must not leak into week 5's events.
    { week: 6, home: "Arsenal", away: "Wolves", hs: 2, as: 2 },
    // Your own club's fixture — must be excluded entirely.
    { week: 5, home: "Liverpool", away: "Man City", hs: 1, as: 1 },
  ];
  const events = detectLeagueWeek(results, "Liverpool", 5, "Premier League", 2026);

  check(events.every(e => e.facts.week === 5), "only this week's fixtures produce events");
  check(!events.some(e => e.facts.club === "Liverpool" || e.facts.club === "Man City"),
    "the user's own fixture (Liverpool v Man City) is entirely excluded, either side");

  const arsenalWin = events.find(e => e.subject.name === "Arsenal" && e.id === "rout");
  check(!!arsenalWin, "a 3-0 away win produces a 'rout' event for the winning club");
  const chelseaLoss = events.find(e => e.subject.name === "Chelsea" && e.id === "hammered");
  check(!!chelseaLoss, "…and a 'hammered' event for the losing side of the same margin");

  // Only Everton-Fulham is an eligible draw this week — Liverpool-Man City
  // is also 1-1 but excluded as the user's own fixture, and Arsenal-Wolves
  // belongs to week 6.
  const draws = events.filter(e => e.id === "draw");
  check(draws.length === 2, `a drawn fixture produces a draw event for BOTH sides (${draws.length}, expected 2)`);
  check(draws.every(e => e.subject.name === "Everton" || e.subject.name === "Fulham"),
    "…and only for the eligible draw, not the excluded or off-week ones");

  check(events.every(e => e.id !== "hat-trick" && e.id !== "four-goals" && e.id !== "five-goals"),
    "a single named goal never reads as a hat-trick");
}

// ── Hat-tricks, named exactly ────────────────────────────────────────────────
{
  const results: LeagueResult[] = [{
    week: 5, home: "Everton", away: "Fulham", hs: 4, as: 1,
    hg: [
      { m: 10, s: "Calvert-Lewin", full: "Dominic Calvert-Lewin", role: "ST" },
      { m: 40, s: "Calvert-Lewin", full: "Dominic Calvert-Lewin", role: "ST" },
      { m: 55, s: "Calvert-Lewin", full: "Dominic Calvert-Lewin", role: "ST" },
      { m: 70, s: "Doucoure", full: "Abdoulaye Doucoure", role: "CM" },
    ],
    ag: [{ m: 80, s: "Iwobi", full: "Alex Iwobi", role: "LW" }],
  }];
  const events = detectLeagueWeek(results, "Liverpool", 5, "Premier League", 2026);
  const hat = events.find(e => e.id === "hat-trick");
  check(!!hat, "three goals by the same named scorer produces a hat-trick event");
  check(hat?.facts.player === "Dominic Calvert-Lewin", "…named exactly, from the goal record's full name");
  check(hat?.facts.short === "Calvert-Lewin" && hat?.facts.role === "ST", "…carrying the short name and role too, for the templates that need them");
  check(hat?.subject.name === "Everton", "the hat-trick's subject is his own club, so their account can boast about it");
  check(!events.some(e => e.id === "four-goals" || e.id === "five-goals"), "nobody else this match reached four or five");
}

// ── allegiance(): the fix this whole feature depends on ─────────────────────
{
  const c = newCareer(11); // Man United
  const accounts = buildRoster(c);
  const own = accounts.find(a => a.archetype === "club" && a.allegiance?.club === c.player.club)!;
  const someoneElse = accounts.find(a => a.archetype === "club" && a.allegiance?.club !== c.player.club)!;
  const fan = accounts.find(a => a.archetype === "fan")!;
  const neutral = accounts.find(a => a.archetype === "league")!;
  check(!!own && !!someoneElse && !!fan && !!neutral, "the roster has the account shapes this check needs");

  const thirdPartyWin: FootballEvent = {
    id: "win", subject: { kind: "club", name: someoneElse.allegiance!.club },
    baseImportance: 34, tags: ["table"], window: "instant",
    facts: { club: someoneElse.allegiance!.club, opponent: "Nobody FC" },
  };

  check(allegiance(someoneElse, thirdPartyWin, c.player.club) === 1,
    "a club account still speaks for ITS OWN win, whoever's career this is");
  check(allegiance(own, thirdPartyWin, c.player.club) === 0,
    "your own club's account never comments on a match that isn't theirs");
  check(allegiance(fan, thirdPartyWin, c.player.club) < 0.5,
    "your own supporters are near-silent on a result that has nothing to do with them");
  check(allegiance(neutral, thirdPartyWin, c.player.club) === 1,
    "a neutral account (no allegiance at all) is unaffected — the league account always had a full voice");

  const yourOwnWin: FootballEvent = {
    ...thirdPartyWin, facts: { club: c.player.club, opponent: "Nobody FC" },
  };
  check(allegiance(own, yourOwnWin, c.player.club) === 1, "…and still speaks fully for a win that IS theirs");
  check(allegiance(fan, yourOwnWin, c.player.club) === 1, "…exactly as your own fans always have");
}

// ── End to end: a real week produces real, separately-scoped posts ─────────
{
  let c = newCareer(3);
  let crashed = 0;
  let lastPlayedWeek = 0;
  let lastOthers: LeagueResult[] = [];
  for (let w = 1; w <= 10; w++) {
    if (!c.fixtures.some(f => !f.played)) break;
    let result;
    try {
      result = playOne(c, 4000 + w);
    } catch { crashed++; continue; }
    if (!result) continue; // no fixture left this week
    c = result.career;

    const others = restOfWeek(c, result.week);
    if (others.length) {
      c.media = generateForLeagueWeek({ ...c, media: c.media }, others);
      lastPlayedWeek = result.week;
      lastOthers = others;
    }
  }
  check(crashed === 0, `the league-wide pass never takes a real season down (${crashed} threw)`);

  const posts = mediaOf(c).posts;
  check(posts.some(p => p.scope === "club"), "the career's own club/match posts still carry scope 'club'");
  check(posts.some(p => p.scope === "league"), `a ten-week career sees at least one real England-wide post (${posts.length} posts total)`);
  check(posts.filter(p => p.scope === "league").every(p => !!p.eventId), "every league post still carries a real event id");

  // The replay guard: generating the SAME week's league pass twice must not
  // double the posts, the same "a replayed cycle must not post twice" rule
  // every other generator in this file already keeps.
  check(lastPlayedWeek > 0, "at least one week in this run had other fixtures to report on");
  const beforeCount = mediaOf(c).posts.length;
  const again = generateForLeagueWeek(c, lastOthers);
  check(again.posts.length === beforeCount, "replaying the same league week never posts twice");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the rest of the league has its own voice now, and it stays in its lane");
