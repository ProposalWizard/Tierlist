import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, mediaOf } from "../../lib/star/media/feed";
import { buildRoster } from "../../lib/star/media/accounts";
import { buildGraphic } from "../../lib/star/media/graphics";
import { leagueNameFor, type CareerDivision } from "../../lib/star/calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, Fixture, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { StoredPost } from "../../lib/star/media/types";

/**
 * EVERY LEAGUE LABEL FOLLOWS YOUR DIVISION (22 Oct 2026, Leo's plan part 12).
 *
 * "The League" account posted lower-league goals as the Premier League. The
 * account itself was fixed on 11 Oct (tests/star/leagueAccount.mts); this
 * checks every label a lower-league career can see, over a whole season:
 *  - the league account's name, handle and follower count are the division's;
 *  - no post anywhere (text, author, graphic data) says "Premier League"
 *    outside a Premier League career;
 *  - no "into/out of Europe" story outside the top flight (a League One
 *    career's week 1 had @FACup posting its slide "out of Europe");
 *  - a cup/competition account only posts about its own competition;
 *  - the trophy and Player-of-the-Month cards carry the division's name.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function careerIn(division: CareerDivision, clubs: readonly string[], seed: number): CareerState {
  const player = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: clubs[(seed * 5) % clubs.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  } as StarPlayer;
  return makeInitialCareer(player, [...clubs], division);
}

/** A whole season (or `weeks` matches), one goal of yours a match. Every post
 *  ever made is kept, not only the newest 150 the feed holds. */
function season(c0: CareerState, weeks: number, seen: Map<string, StoredPost>): CareerState {
  let c = c0;
  for (let w = 0; w < weeks; w++) {
    const fx: Fixture | undefined = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fx) break;
    const ev: GoalEvent[] = [{ minute: 20 + (w % 60), scorer: "Michael Sancho", isUserGoal: true, how: "one_on_one", distance: 10 }];
    const win = w % 3 !== 2;
    const stats = {
      chances: 5, goals: 1, assists: 0, passes: 30, rating: 7.6, starMan: false,
      bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: 1, sponsorPay: 0, totalCash: 3,
      homeScore: fx.home ? (win ? 2 : 1) : (win ? 1 : 2), awayScore: fx.home ? (win ? 1 : 2) : (win ? 2 : 1),
      goalEvents: ev, minutes: 90,
    } as unknown as MatchStats;
    const { career: after } = creditMatchResult(c, fx, stats);
    after.media = generateForMatch(c, after, fx, stats);
    const rest = (after.results ?? []).filter(r => r.week === fx.week && r.home !== after.player.club && r.away !== after.player.club);
    if (rest.length) after.media = generateForLeagueWeek(after, rest);
    c = after;
    for (const p of mediaOf(c).posts) seen.set(p.id, p);
  }
  return c;
}

const CASES: [CareerDivision, readonly string[], string][] = [
  ["premier", PREMIER_LEAGUE_CLUBS, "@PremierLeague"],
  ["championship", CHAMPIONSHIP_CLUBS, "@Championship"],
  ["league_one", LEAGUE_ONE_CLUBS, "@LeagueOne"],
  ["national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS, "@NationalLeagueNorth"],
];
const PL = /Premier League|PremierLeague/;
const EUROPE_EVENTS = new Set(["into-europe", "out-of-europe", "qualified"]);
const COMPETITIONS = ["FA Cup", "Champions League", "Europa League", "Lower League Trophy"];

for (const [division, clubs, handle] of CASES) {
  const want = leagueNameFor(division);
  const pl = division === "premier";
  const c0 = careerIn(division, clubs, 1);

  // The account.
  const league = buildRoster(c0).filter(a => a.archetype === "league");
  check(league.length === 1 && league[0].name === want && league[0].handle === handle,
    `${division}: league account is ${want} ${handle} (got ${league.map(a => `${a.name} ${a.handle}`).join(", ")})`);

  // A season of posts.
  const seen = new Map<string, StoredPost>();
  const end = season(c0, 46, seen);
  const posts = [...seen.values()];
  let leaguePosts = 0;
  for (const p of posts) {
    const json = JSON.stringify(p);
    if (p.author.archetype === "league") {
      leaguePosts++;
      check(p.author.name === want && p.author.handle === handle, `${division}: league post by ${p.author.name} ${p.author.handle}`);
    }
    if (!pl && PL.test(json)) problems.push(`${division}: post says Premier League: ${p.author.handle} "${p.text.slice(0, 80)}"`);
    if (!pl && p.eventId && EUROPE_EVENTS.has(p.eventId)) problems.push(`${division}: Europe story "${p.eventId}": ${p.author.handle} "${p.text.slice(0, 80)}"`);
    if (p.author.archetype === "competition" && COMPETITIONS.includes(p.author.name)) {
      const g = p.graphic as { competition?: string } | undefined;
      if (g?.competition && !g.competition.startsWith(p.author.name)) {
        problems.push(`${division}: ${p.author.handle} posted a ${g.competition} card: "${p.text.slice(0, 80)}"`);
      }
    }
  }
  check(leaguePosts > 20, `${division}: the league account posts (${leaguePosts})`);

  // The cards that name a division.
  const fakeEvent = { id: "champions", subject: { kind: "club", name: end.player.club }, facts: {}, tags: [], baseImportance: 50, window: "instant" } as never;
  const trophy = buildGraphic("trophy", fakeEvent, null, end, mediaOf(end).memory, () => 0.5) as { competition?: string } | undefined;
  check(trophy?.competition === want, `${division}: a trophy card with no competition says ${want} (got ${trophy?.competition})`);
  const potm = posts.map(p => p.graphic).filter(g => g?.type === "potmNominees") as { league?: string }[];
  for (const g of potm) check(g.league === want, `${division}: Player of the Month nominees card says ${g.league}`);

  console.log(`${division.padEnd(22)} ${want} ${handle}: ${posts.length} posts, ${leaguePosts} by the league account, ${potm.length} nominee cards`);
}

// An OLD save: a League One career whose feed still holds a post the old
// roster made as "Premier League @PremierLeague" (before 11 Oct 2026). The
// roster is never stored (buildRoster runs on every pass), so the next match
// posts as League One. The old post is left as it was: it is history, the
// feed keeps only the newest 150, and nothing on it says which division its
// season was played in.
{
  const c0 = careerIn("league_one", LEAGUE_ONE_CLUBS, 2);
  const seen = new Map<string, StoredPost>();
  const first = season(c0, 1, seen);
  const posts = mediaOf(first).posts;
  const victim = posts.find(p => p.author.archetype === "league");
  check(!!victim, "old save: a league post to rewrite as the old @PremierLeague");
  if (victim) {
    first.media = {
      ...mediaOf(first),
      posts: posts.map(p => p === victim ? { ...p, author: { ...p.author, name: "Premier League", handle: "@PremierLeague" } } : p),
    };
    const later = new Map<string, StoredPost>();
    season(first, 3, later);
    const fresh = [...later.values()].filter(p => p.author.archetype === "league" && p.id !== victim.id);
    check(fresh.length > 0 && fresh.every(p => p.author.handle === "@LeagueOne"),
      `old save: new league posts are @LeagueOne (${fresh.map(p => p.author.handle).filter(h => h !== "@LeagueOne").join(", ")})`);
    console.log(`old save: ${fresh.length} new league posts after the old @PremierLeague one, all @LeagueOne: ${fresh.every(p => p.author.handle === "@LeagueOne")}`);
  }
}

if (problems.length) {
  console.error("leagueAccountLabel FAILED:\n  - " + [...new Set(problems)].slice(0, 20).join("\n  - "));
  process.exit(1);
}
console.log("leagueAccountLabel: all checks passed");
