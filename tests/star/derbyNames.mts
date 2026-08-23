import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch } from "../../lib/star/media/feed";
import { buildMatchRecord } from "../../lib/star/media/record";
import type { CareerState, MatchStats, StarPlayer, Fixture } from "../../lib/star/types";

/**
 * THE DERBY'S OWN NAME, IN THE ACTUAL POST.
 *
 * The structural half of this — MatchRecord carrying `derby`/`rivalryTier`,
 * detectors scoring a rivalry fixture higher — was built and tested
 * elsewhere (tests/star/rivalries.mts, tests/star/media.mts). This is the
 * last mile: does "North London Derby" actually turn up in generated text,
 * or does the fact just sit on the record unused.
 *
 * Two real bugs were caught writing this file, neither of them what a first
 * skim would suspect:
 *
 *  · `base()` set `derbyName: ""` rather than leaving it absent when there
 *    was none. `Template.requires` treats an empty string as missing (right),
 *    but `Template.excludes` only checks for `undefined` (also right, for
 *    what it is FOR) — so the empty string satisfied neither the named
 *    templates' `requires` nor the generic ones' `excludes`, and a derby
 *    with no rated name lost ALL of its coverage, event and all. A 0-in-300
 *    count caught it; the event was still detected the whole time.
 *
 *  · Everything here is seeded off the match itself (career, fixture,
 *    stats), so calling it again with unchanged inputs is the identical
 *    deterministic output, not a fresh sample — an early draft "tested" this
 *    by looping the same call 100 times and never noticed it was checking
 *    one outcome a hundred times over. Real variety here comes from varying
 *    the season each pass, which changes the seed everything downstream is
 *    derived from.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];

function careerAt(club: string, season: number, clubs: string[] = CLUBS): CareerState {
  const player: StarPlayer = {
    firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
  } as StarPlayer;
  const career = makeInitialCareer(player, clubs);
  return { ...career, season };
}

/** The real, scheduled derby fixture — not a fabricated one, so `derby: true`
 *  is exactly what buildFixtures actually put there. */
function realDerbyFixture(career: CareerState, opponent: string): Fixture {
  const f = career.fixtures.find(x => x.opponent === opponent);
  if (!f) throw new Error(`no fixture against ${opponent} in this career`);
  return f;
}

function play(career: CareerState, fixture: Fixture, us: number, them: number): CareerState {
  const stats: MatchStats = {
    chances: 6, goals: us, assists: 0, passes: 30, rating: 7.8, starMan: us > them,
    bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: us, sponsorPay: 0, totalCash: 3,
    homeScore: fixture.home ? us : them, awayScore: fixture.home ? them : us, minutes: 90,
  };
  const { career: after } = creditMatchResult(career, fixture, stats);
  after.media = generateForMatch(career, after, fixture, stats);
  return after;
}

// ── The real name actually turns up, across several archetypes ──────────────
{
  const found = new Set<string>();
  let totalPosts = 0;
  for (let season = 1; season <= 15; season++) {
    const career = careerAt("Arsenal", season);
    const fixture = realDerbyFixture(career, "Tottenham Hotspur");
    const after = play(career, fixture, 2, 0);
    const posts = after.media?.posts ?? [];
    totalPosts += posts.length;
    for (const p of posts) {
      if (p.text.toLowerCase().includes("north london derby")) found.add(p.author.archetype);
    }
  }
  check(totalPosts > 100, `fifteen derby wins produce a real volume of posts (${totalPosts})`);
  check(found.size >= 2,
    `"North London Derby" turns up from more than one voice across fifteen different seasons (${[...found].join(", ")})`);
}

// ── The losing side names it too ─────────────────────────────────────────────
{
  const found = new Set<string>();
  for (let season = 1; season <= 15; season++) {
    const career = careerAt("Arsenal", season);
    const fixture = realDerbyFixture(career, "Tottenham Hotspur");
    const after = play(career, fixture, 0, 2);
    for (const p of after.media?.posts ?? []) {
      if (p.text.toLowerCase().includes("north london derby")) found.add(p.author.archetype);
    }
  }
  check(found.size >= 1, `a derby loss names it too, from at least one voice (${[...found].join(", ")})`);
}

// ── A derby with no rated tier still gets its own line, unnamed ─────────────
//
// Chelsea-Fulham FC is exactly this shape in the real data (derby: true, no
// tier) — but Chelsea's OWN highest-heat rival is Tottenham Hotspur, and
// buildFixtures only has room to flag ONE derby per career (the same
// single-slot limit the old placeholder system already had), so a career
// built from a division that leaves Tottenham out never gets the Fulham
// fixture flagged this way at all. That is a real, separate, pre-existing
// limit of "one derby rival per career" and not what this block exists to
// check — so the fixture is built directly, isolating the one thing that
// actually matters here: does the media engine handle a tierless derby
// cleanly once it is told about one.
//
// Not a check for the literal word "derby" in every post, either — several
// genuinely eligible templates (fan-derby's "there is no better feeling than
// beating that lot", unchanged from before this work) never say the word at
// all, by original authorial choice. What actually matters: the event still
// fires, still gets covered, and never leaks a raw slot.
{
  const career = careerAt("Chelsea", 1, ["Chelsea", "Fulham FC", "Arsenal", "Liverpool", "Everton",
    "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion"]);
  const fixture: Fixture = { week: 1, opponent: "Fulham FC", home: true, played: false, derby: true };
  check(fixture.derby === true, "the fixture itself is flagged a derby");

  const after = play(career, fixture, 2, 0);
  const posts = after.media?.posts ?? [];
  check(posts.length > 5, `a normal volume of posts, nothing suppressed by the missing name (${posts.length})`);
  check(!posts.some(p => p.text.includes("{") || p.text.includes("}")),
    "never an unresolved {derbyName} literal when there is no name to put there");

  const record = buildMatchRecord(career, after, fixture, {
    chances: 6, goals: 2, assists: 0, passes: 30, rating: 7.8, starMan: true,
    bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: 2, sponsorPay: 0, totalCash: 3,
    homeScore: 2, awayScore: 0, minutes: 90,
  });
  check(record.derby === true, "the record itself carries the derby flag");
  check(record.derbyName === undefined,
    `and genuinely no derbyName fact — absent, not an empty string (${JSON.stringify(record.derbyName)})`);
}

// ── No rivalry at all: nothing invented ──────────────────────────────────────
{
  const career = careerAt("Arsenal", 1);
  const fixture = career.fixtures.find(f => f.opponent === "Everton")!;
  check(!fixture.derby, "Arsenal v Everton is not a derby — no rivalry given either way");
  const after = play(career, fixture, 3, 0);
  const anyDerbyTalk = (after.media?.posts ?? []).some(p => p.text.toLowerCase().includes("derby"));
  check(!anyDerbyTalk, "and nothing in the feed pretends otherwise");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the derby's own name really does reach the post, from more than one voice");
