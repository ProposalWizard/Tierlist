import {
  makeManager, sackCheck, bossOnArrival, STYLE_SELECTION, styleBlurb, reputationTier,
} from "../../lib/star/manager";
import { clubExpectation } from "../../lib/star/expectations";
import { primaryRivalOf, isDerby, strongestTier, rivalryMultiplier } from "../../lib/star/rivalries";
import { pressQuestionFor } from "../../lib/star/media";
import { selectionFor } from "../../lib/star/selection";
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * The club around you: a manager who can be sacked, a derby, and a press pack.
 *
 * Your standing with "the boss" was a relationship with nobody — no name, never
 * changing hands, and a number five seasons in the building that nothing could
 * take away except your own form. Every fixture was the same fixture. And the
 * dilemma system, which fires on a timer and asks about your life, was the only
 * thing in the game that ever asked you a question — nothing ever asked about
 * the match you had just played.
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
  firstName: "Test", lastName: "Player", age: 24, position: "ST",
  club: "Arsenal", nationality: "England", startYear: 2026,
} as StarPlayer;
// Real spellings, not shorthand — lib/star/rivalries.ts is keyed off the
// exact names lib/star/clubs.ts uses, and the whole point of this block is
// to exercise the real rivalry data rather than an invented pairing.
const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const result = (mine: number, theirs: number, over: Partial<MatchStats> = {}): MatchStats => ({
  minutes: 90, chances: 5, goals: mine, assists: 0, passes: 12, rating: 7.0, starMan: false,
  bossChange: 4, teamChange: 4, fansChange: 4,
  wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1,
  homeScore: mine, awayScore: theirs, ...over,
});

/** Finish the club in a given place, with real points. */
function finishNth(c: CareerState, place: number): CareerState {
  let rank = 0;
  const league = c.league.map(t => {
    if (t.name === c.player.club) return { ...t, points: 100 - place * 5 };
    rank += 1;
    const spot = rank < place ? rank : rank + 1;
    return { ...t, points: 100 - spot * 5 };
  });
  return { ...c, league };
}

// ── There is a man in the job ───────────────────────────────────────────────
{
  const c = base();
  check(!!c.manager, "a career starts with a manager");
  check((c.manager?.name ?? "").includes(" "), `and he has a name (${c.manager?.name})`);
  check(styleBlurb(c.manager!.style).length > 0, "and a way of doing things you are told about");

  // Deterministic, so he does not change identity under a re-render.
  check(makeManager(c, "Arsenal", 1).name === makeManager(c, "Arsenal", 1).name, "the same manager is the same manager");
  const names = new Set(CLUBS.map(club => makeManager(c, club, 1).name));
  check(names.size > 3, "different clubs have different managers");
}

// ── His style bends selection, and no style is simply better ───────────────
{
  const c = { ...base(), relationships: { ...base().relationships, boss: 48 }, form: [6.4, 6.2, 6.6, 6.1, 6.3] };
  const styles = ["trusting", "demanding", "rotational"] as const;
  const status = styles.map(style => selectionFor({ ...c, manager: { ...c.manager!, style } }).status);
  check(new Set(status).size > 1, `who is in the dugout changes whether you play (${status.join(", ")})`);

  // Symmetric by construction: a trusting manager is harder to lose your place
  // with AND harder to win it back from.
  check(STYLE_SELECTION.trusting.start < 0 && STYLE_SELECTION.trusting.bench < 0,
    "a trusting manager lowers both bars");
  check(STYLE_SELECTION.demanding.start > 0, "a demanding one raises the bar to start");
  check(STYLE_SELECTION.rotational.bench < STYLE_SELECTION.trusting.bench,
    "and a rotator is the easiest to get on the bench for");
}

// ── He can be sacked, and the next one has never picked you ────────────────
{
  const c = base();
  check(!sackCheck(c, 0.4).sacked, "a good season is not a sacking");
  check(!sackCheck(c, -0.5).sacked, "and a manager in his first season gets rope");

  const settled: CareerState = { ...c, season: 4, manager: { ...c.manager!, since: 1 } };
  check(sackCheck(settled, -0.5).sacked, "a bad season for a manager who has had time is");
  check(sackCheck(settled, -0.5).reason.length > 0, "and the player is told why");
  check(!sackCheck(settled, -0.2).sacked, "a middling one is not");

  // A new man walks in and everything you built goes with the old one.
  let bad = finishNth({ ...c, season: 4, manager: { ...c.manager!, since: 1 } }, CLUBS.length);
  bad = { ...bad, relationships: { ...bad.relationships, boss: 96 }, captain: true, starRating: 3.0 };
  const after = advanceSeason(bad, false).career;
  check(after.manager?.name !== bad.manager?.name, "a bad enough season costs him his job");
  check(after.relationships.boss < 80, `and your standing goes with him (96 → ${after.relationships.boss})`);
  check(after.relationships.boss >= 35, "…but not to nothing — he has watched the tapes");
  check(after.captain === false, "the armband is the new manager's to give");
  check((after.managerNews ?? "").length > 0, "and the dashboard says what happened");

  // A reputation is worth something to a man who has never met you.
  check(bossOnArrival({ ...c, starRating: 5 }) > bossOnArrival({ ...c, starRating: 1 }),
    "a bigger name walks in with more credit");

  // A good season keeps him, and clears the notice.
  const good = advanceSeason(finishNth({ ...c, season: 4, manager: { ...c.manager!, since: 1 } }, 1), false).career;
  check(good.manager?.name === c.manager?.name, "a good season keeps him in the job");
  check(!good.managerNews, "and there is no news to report");
}

// ── A free agent's own name is worth something ──────────────────────────────
{
  const c = base();

  // Deterministic, same as his name and style.
  check(makeManager(c, "Arsenal", 1).reputation === makeManager(c, "Arsenal", 1).reputation,
    "the same appointment has the same reputation every time");

  // Bucket every club in this league by the job's own prestige, then compare
  // the AVERAGE reputation the job attracts over many independent hires
  // (varying the season, which is part of the RNG seed) — a single hire can
  // land anywhere in the range, on purpose, but the tiers should separate on
  // average or the "weighted by prestige" design isn't actually doing anything.
  const byAmbition = new Map<string, string[]>();
  for (const club of CLUBS) {
    const amb = clubExpectation({ ...c, player: { ...c.player, club } }).ambition;
    byAmbition.set(amb, [...(byAmbition.get(amb) ?? []), club]);
  }
  const meanReputationFor = (club: string) => {
    let total = 0, n = 0;
    for (let season = 1; season <= 40; season++) { total += makeManager(c, club, season).reputation; n++; }
    return total / n;
  };
  const meanFor = (amb: string) => {
    const clubs = byAmbition.get(amb) ?? [];
    if (clubs.length === 0) return null;
    return clubs.reduce((s, club) => s + meanReputationFor(club), 0) / clubs.length;
  };
  const title = meanFor("Title"), survival = meanFor("Survival");
  if (title !== null && survival !== null) {
    check(title > survival,
      `a title-chasing job attracts a bigger name on average than a relegation fight (${survival.toFixed(0)} vs ${title.toFixed(0)})`);
  }

  // Tiers read off the same 0-100 scale everything else in the game uses.
  check(reputationTier(90) === "Elite" && reputationTier(60) === "Proven"
    && reputationTier(40) === "Rising" && reputationTier(10) === "Journeyman",
    "reputation reads back as the tier it was rolled into");

  // A big name is under more pressure in year one, not less; a project
  // appointment gets more patience, not the same amount. Small and bounded —
  // never harder on a big name than a settled manager's own ordinary bar.
  const firstSeasonManager = (reputation: number) => ({ ...c, manager: { ...c.manager!, since: 1, reputation } });
  check(sackCheck(firstSeasonManager(100), -0.6).sacked,
    "an elite name brought in gets sacked on a season that would have been forgiven from an unknown");
  check(!sackCheck(firstSeasonManager(0), -0.6).sacked,
    "…while a journeyman project appointment survives that exact same season");
  check(!sackCheck(firstSeasonManager(100), -0.5).sacked,
    "…but even the biggest name is never judged harder than a settled manager's own ordinary bar");
  check(sackCheck(firstSeasonManager(50), -0.72).sacked && !sackCheck(firstSeasonManager(50), -0.71).sacked,
    "a neutral, average reputation reproduces the original first-season bar exactly");
}

// ── Rivalries, for real ──────────────────────────────────────────────────────
{
  // Arsenal's own list rates Spurs the North London Derby, R1 — checked
  // against real data now, not an invented alphabetical pairing.
  const rival = primaryRivalOf("Arsenal");
  check(rival === "Tottenham Hotspur", `Arsenal's own primary rival is Spurs (${rival})`);
  check(isDerby("Arsenal", "Tottenham Hotspur"), "a real derby");
  check(!isDerby("Arsenal", "Newcastle United"), "and only against the right club");
  check(strongestTier("Arsenal", "Tottenham Hotspur") === "R1", "rated Arsenal's primary rivalry");

  const c = base();
  check(c.fixtures.some(f => f.derby), "the calendar knows which one is the derby");
  check(c.fixtures.filter(f => f.derby).every(f => f.opponent === rival), "and it is against the right club");

  // Same football, louder consequences.
  const derbyFixture: Fixture = { week: 1, opponent: "Tottenham Hotspur", home: true, played: false, derby: true };
  const normal: Fixture = { week: 1, opponent: "Newcastle United", home: true, played: false };
  const win = result(2, 0);
  const afterDerby = creditMatchResult(c, derbyFixture, win).career;
  const afterNormal = creditMatchResult(c, normal, win).career;
  check(afterDerby.relationships.fans > afterNormal.relationships.fans,
    `beating your rivals is worth more to the supporters (${afterNormal.relationships.fans} vs ${afterDerby.relationships.fans})`);
  check(afterDerby.relationships.team > afterNormal.relationships.team, "and to the dressing room");

  const mult = rivalryMultiplier("Arsenal", "Tottenham Hotspur");
  check(mult.fans > mult.boss,
    "the manager is the least moved of the three — three points are three points to him");

  // Losing one costs the same way.
  const loss = result(0, 2, { bossChange: -5, teamChange: -3, fansChange: -4 });
  const lostDerby = creditMatchResult(c, derbyFixture, loss).career;
  const lostNormal = creditMatchResult(c, normal, loss).career;
  check(lostDerby.relationships.fans < lostNormal.relationships.fans, "and losing one costs more");

  // A primary rivalry moves the needle further than a lesser one — Man City
  // is Arsenal's own R3, no derby.
  const lesser = rivalryMultiplier("Arsenal", "Manchester City");
  check(mult.fans > lesser.fans,
    `the primary rivalry moves fans further than a lesser one (${mult.fans} vs ${lesser.fans})`);
  check(rivalryMultiplier("Arsenal", "Everton").fans === 1,
    "and a club with no rivalry at all moves nobody");
}

// ── The press ───────────────────────────────────────────────────────────────
{
  const c = base();
  const rng = () => 0.99;   // never fires the "occasionally" branch
  const f: Fixture = { week: 4, opponent: "Chelsea", home: true, played: true };

  check(pressQuestionFor(c, f, result(0, 0), false, rng) === null,
    "a nothing-happened draw is not a press conference");

  const hatTrick = pressQuestionFor(c, f, result(3, 1), false, rng);
  check(hatTrick?.id === "hat-trick", "three goals is");
  const thrashed = pressQuestionFor(c, f, result(0, 4), false, rng);
  check(thrashed?.id === "thrashing", "and so is being taken apart");

  // A derby leads the bulletin over everything else.
  const derbyWin = pressQuestionFor(c, f, result(3, 0), true, rng);
  check(derbyWin?.id === "derby-win", `a derby beats a hat-trick and a rout (${derbyWin?.id})`);
  const derbyLoss = pressQuestionFor(c, f, result(0, 4), true, rng);
  check(derbyLoss?.id === "derby-loss", "in both directions");

  const cupExit: Fixture = { ...f, kind: "cup", competition: "FA Cup", round: "Semi-Final" };
  check(pressQuestionFor(c, cupExit, result(0, 1), false, rng)?.id === "cup-out", "going out of a cup is a question");
  check(pressQuestionFor(c, cupExit, result(1, 0), false, rng) === null, "winning a cup tie by one is not");

  // Every question is the same decision underneath: back yourself, back the
  // team, or give them nothing.
  for (const q of [hatTrick, thrashed, derbyWin, derbyLoss]) {
    if (!q) continue;
    check(q.options.length === 3, `${q.id}: three answers`);
    const bold = q.options[0], teamFirst = q.options[1], guarded = q.options[2];
    check(bold.fans > teamFirst.fans, `${q.id}: backing yourself plays better with the supporters`);
    check(teamFirst.team > bold.team, `${q.id}: backing the lads plays better in the dressing room`);
    check(Math.abs(guarded.fans) <= Math.abs(bold.fans), `${q.id}: saying nothing moves nobody far`);
    check(q.options.every(o => o.outcome.length > 0), `${q.id}: every answer has a consequence in print`);
  }
}

// ── It all still runs a season ──────────────────────────────────────────────
{
  let c = base();
  let guard = 0;
  while (nextFixtureFor(c) && guard++ < 120) {
    c = creditMatchResult(c, nextFixtureFor(c)!, result(1, 1)).career;
  }
  check(guard < 120, "a full season plays out with all of it wired in");
  check(!!c.manager, "and there is still a manager at the end of it");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the manager can be sacked, the derby counts double, and the press want a word");
