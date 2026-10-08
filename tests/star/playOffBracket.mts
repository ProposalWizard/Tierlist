import { seedPlayOffs, settlePlayOffFixture } from "../../lib/star/playoffs";
import { buildBracket, stageOfRound } from "../../lib/star/playOffBracket";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { sortLeague } from "../../lib/star/season";
import { CHAMPIONSHIP_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, LEAGUE_TWO_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, Fixture } from "../../lib/star/types";

/**
 * THE PLAY-OFF ROUND-UP BRACKET (lib/star/playOffBracket.ts).
 *
 * The screen shown before each of your play-off matches. The rule that
 * matters: a round's results show only once your own match in that round is
 * behind you — the other ties are played at the same time, even though the
 * save already knows them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return { firstName: "Test", lastName: "Player", age: 16, skinTone: "light", club, clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
}

function endingAt(clubs: string[], division: string, place: number, you = clubs[10]): CareerState {
  const order = clubs.filter(c => c !== you);
  order.splice(place - 1, 0, you);
  const c = makeInitialCareer(playerAt(you), clubs, division as never);
  return {
    ...c,
    league: c.league.map((t) => {
      const points = (order.length - order.indexOf(t.name)) * 3;
      return { ...t, played: 46, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
    }),
  };
}

function seeded(c: CareerState): CareerState {
  const s = seedPlayOffs(c)!;
  return { ...c, playOffState: s.state, fixtures: [...c.fixtures.map(f => ({ ...f, played: true })), ...s.fixtures] };
}

function next(c: CareerState): Fixture | undefined {
  return c.fixtures.filter(f => !f.played && f.kind === "playoff").sort((a, b) => a.week - b.week)[0];
}

function play(c: CareerState, us: number, them: number): CareerState {
  const f = next(c)!;
  const out = settlePlayOffFixture(c, f, us, them)!;
  return {
    ...c, playOffState: out.state,
    fixtures: [...c.fixtures.map(x => (x === f ? { ...x, played: true } : x)), ...out.fixtures],
  };
}

function view(c: CareerState) {
  const table = sortLeague(c.league).map(t => t.name);
  return buildBracket(c.playOffState!, c.player.club, (x) => table.indexOf(x) + 1, next(c)?.round);
}

const tie = (b: ReturnType<typeof view>, id: string) => b.ties.find(t => t.id === id)!;
const shown = (b: ReturnType<typeof view>, id: string) => tie(b, id).topScore !== undefined;

// Round names map to rounds.
check(stageOfRound("Play-Off Qualifier") === 0 && stageOfRound("Semi-Final, First Leg") === 1
  && stageOfRound("Semi-Final, Second Leg") === 1 && stageOfRound("Play-Off Semi-Final") === 1
  && stageOfRound("Play-Off Final") === 2, "round names map to rounds");

// ── Four clubs, two-legged semis (Championship, 3rd) ─────────────────────────
{
  let c = seeded(endingAt([...CHAMPIONSHIP_CLUBS], "championship", 3));
  let b = view(c);
  check(b.format === "four" && b.current === 1, "Championship: four-club bracket, semis next");
  check(!shown(b, "sA") && !shown(b, "sB"), "before your semi: no semi score shows (the other is played alongside yours)");
  check(tie(b, "sA").next && tie(b, "sA").top?.pos === 3 && tie(b, "sA").bottom?.pos === 6, "you are 3rd v 6th, and it is your next match");
  check(tie(b, "sB").top?.pos === 4 && tie(b, "sB").bottom?.pos === 5, "the other semi is 4th v 5th");
  check(!tie(b, "f").top && !tie(b, "f").bottom, "the final is empty");
  check(b.revealTo < b.revealFrom, "nothing to animate before the first match");

  c = play(c, 2, 1);
  b = view(c);
  check(tie(b, "sA").note === "1st leg 1–2" || tie(b, "sA").note === "1st leg 2–1", `after leg one your tie shows the first-leg score (${tie(b, "sA").note})`);
  check(!shown(b, "sB"), "after leg one: the other semi still hidden");

  c = play(c, 2, 0);
  b = view(c);
  check(b.current === 2 && shown(b, "sA") && shown(b, "sB"), "before the final: both semis show");
  check(tie(b, "sA").winner === c.player.club && tie(b, "sA").note === "agg.", "your semi: won on aggregate");
  check(tie(b, "f").top?.club === c.player.club && tie(b, "f").top?.from === "sA", "you move into the final from your semi");
  check(tie(b, "f").bottom?.club === tie(b, "sB").winner, "the other semi's winner is in the final");
  check(b.revealFrom === 1 && b.revealTo === 1, "the semis are the round that animates");
  check(tie(b, "f").next && !shown(b, "f"), "the final is next, no score yet");

  c = play(c, 1, 0);
  b = view(c);
  check(b.current === 3 && b.promoted === c.player.club && shown(b, "f"), "after the final: promoted, final score shows");
  check(b.revealFrom === 2 && b.revealTo === 2, "the final is what animates");
}

// ── League Two plays off 4th to 7th ─────────────────────────────────────────
{
  const c = seeded(endingAt([...LEAGUE_TWO_CLUBS], "league_two", 7));
  const b = view(c);
  check(tie(b, "sA").top?.pos === 4 && tie(b, "sA").bottom?.pos === 7 && tie(b, "sA").yours, "League Two: 4th v 7th, yours as 7th");
  check(tie(b, "sB").top?.pos === 5 && tie(b, "sB").bottom?.pos === 6, "League Two: 5th v 6th");
}

// ── Six clubs, North/South ──────────────────────────────────────────────────
const north = [...NATIONAL_LEAGUE_NORTH_CLUBS];
{
  // 2nd: the qualifiers were played without you; they show and move on.
  let c = seeded(endingAt(north, "national_league_north", 2));
  let b = view(c);
  check(b.format === "six" && b.current === 1, "North 2nd: semi next");
  check(shown(b, "qA") && shown(b, "qB"), "North 2nd: both qualifiers show");
  check(b.revealFrom === 0 && b.revealTo === 0, "North 2nd: the qualifiers animate");
  check(tie(b, "sB").top?.club === c.player.club && tie(b, "sB").bye === "top" && tie(b, "sB").next, "2nd waits in semi B, and it is next");
  check(tie(b, "sB").bottom?.club === tie(b, "qB").winner && tie(b, "sB").bottom?.from === "qB", "the 5th/6th winner moves into your semi");
  check(tie(b, "sA").bottom?.club === tie(b, "qA").winner, "the 4th/7th winner moves into 3rd's semi");
  check(!shown(b, "sA") && !shown(b, "sB"), "no semi scores before your semi");

  // 4th: your qualifier first, nothing shows.
  c = seeded(endingAt(north, "national_league_north", 4));
  b = view(c);
  check(b.current === 0 && tie(b, "qA").next && !shown(b, "qA") && !shown(b, "qB"), "North 4th: qualifier next, no scores");
  check(!tie(b, "sA").bottom && !tie(b, "sB").bottom, "North 4th: semi slots wait");

  // Win the qualifier, then the semi.
  c = play(c, 3, 1);
  b = view(c);
  check(b.current === 1 && shown(b, "qA") && shown(b, "qB"), "after your qualifier both show");
  check(tie(b, "sA").bottom?.club === c.player.club && tie(b, "sA").next, "you move into 3rd's semi and it is next");
  c = play(c, 2, 0);
  b = view(c);
  check(b.current === 2 && shown(b, "sA") && shown(b, "sB") && tie(b, "f").next, "after your semi: semis show, final next");

  // Knocked out in a qualifier: the whole thing plays out and shows.
  c = play(seeded(endingAt(north, "national_league_north", 7)), 0, 2);
  b = view(c);
  check(b.current === 3 && b.revealFrom === 0 && b.revealTo === 2, "out in the qualifier: everything animates");
  check(shown(b, "f") && !!b.promoted && b.promoted === tie(b, "f").winner, "the final and who went up show");
}

if (problems.length) {
  console.error(`playOffBracket: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("playOffBracket: all good");
