import {
  buildScenario, offsideSnapshot, setOffsideRuleEnabled, type Scenario, type Vec2,
} from "../../lib/star/canvasEngine";
import { HALF_LEN } from "../../lib/star/pitch";
import { qualificationFor, seasonQualifiers } from "../../lib/star/competitions";
import { resolveLadder, membershipOf } from "../../lib/star/promotion";
import { forceClubIntoPremierLeague, canForceClubMovement } from "../../lib/star/forcedMovement";
import { createCompetition, playCompetitionRound, playCompetitionToWinner } from "../../lib/star/newCompetition";
import { investInfluence } from "../../lib/star/governingBodies";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueTeam, StarPlayer } from "../../lib/star/types";

/**
 * PHASE 6 OF STAR_POWER_POLITICS.MD — THE HARDER RULES.
 *
 * The rollout plan's own warning: each of these ("closer to a full feature
 * in its own right") gets a real, but deliberately bounded, implementation
 * here — the offside toggle actually wired into the real match engine, real
 * extra European slots read by the real qualification math, forced league
 * movement with a genuine limbo tier that returns to next season's real
 * promotion pool, and new-competition creation as a real, standalone
 * knockout bracket. Squad size and the Champions League format ship as
 * real, votable Rule Book data with an HONESTLY STATED gap (no gameplay
 * hook yet) — checked in ruleBook.mts, not here, since there's nothing
 * behavioural in either to test yet.
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

function player(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player("Arsenal"), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, money: 10_000_000, ...overrides };
}

// ── Offside toggle: a real, wired switch on the real judgement ────────────
{
  function rigged(attackerY: number): Scenario {
    const sc = buildScenario("long_range", mulberry32(7), 62, 60);
    sc.ball = { x: 34, y: 30 };
    sc.player = { x: 35.3, y: 30 };
    sc.defenders = [{ x: 30, y: 20 }];
    sc.keeper = { ...sc.keeper, x: 34, y: 0.5 };
    sc.runner = { pos: { x: 36, y: attackerY }, to: { x: 36, y: attackerY }, speed: 7, moving: false, role: "target" };
    sc.secondaryRunners = [];
    sc.follower = { ...sc.follower, x: 2, y: HALF_LEN - 1 };
    return sc;
  }

  const withLaw = rigged(18); // clearly beyond the second-last opponent
  offsideSnapshot(withLaw, withLaw.ball);
  check(withLaw.runner!.offside === true, "fixture assumption: with the law on, this exact position is flagged");

  setOffsideRuleEnabled(false);
  const lawAbolished = rigged(18);
  offsideSnapshot(lawAbolished, lawAbolished.ball);
  check(lawAbolished.runner!.offside !== true, "with offside abolished, the SAME position is never flagged");
  setOffsideRuleEnabled(true); // restore the default for anything else in this process

  const restored = rigged(18);
  offsideSnapshot(restored, restored.ball);
  check(restored.runner!.offside === true, "re-enabling the law restores the real judgement");
}

// ── Extra European slots: real qualification math, not a display-only number ──
{
  const withoutExtra = qualificationFor(6, 20, false, false, false);
  check(withoutExtra === "Europa League", "fixture assumption: 6th normally qualifies for the Europa League, not the Champions League");

  const withExtraCL = qualificationFor(6, 20, false, false, false, 2, 0);
  check(withExtraCL === "Champions League", "two extra Champions League slots genuinely pull 6th place up into it");

  const league: LeagueTeam[] = PREMIER_LEAGUE_CLUBS.map((name, i) => ({
    name, strength: 90 - i, played: 38, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: (20 - i) * 3,
  }));
  const classic = seasonQualifiers(league, null, null);
  const boosted = seasonQualifiers(league, null, null, 2, 1);
  check(boosted.champions.length === classic.champions.length + 2, "two extra Champions League slots genuinely add two real clubs to the real list");
  check(boosted.europa.length >= classic.europa.length, "an extra Europa League slot never shrinks the real list");
}

// ── Forced league movement: gated, real, and creates a real limbo tier ────
{
  let career = freshCareer();
  check(!canForceClubMovement(career, "FA"), "no influence at all means no standing to force anybody's league position");

  const blocked = forceClubIntoPremierLeague(career, "Real Madrid");
  check(!blocked.ok, "blocked without enough influence");

  career = investInfluence(career, "FA", 100_000) as CareerState;
  check(canForceClubMovement(career, "FA"), "fixture assumption: enough influence now to force a move");

  const already = forceClubIntoPremierLeague(career, career.player.club === "Arsenal" ? "Arsenal" : "Chelsea");
  check(!already.ok, "can't force a club that's already in the Premier League");

  const cantTargetSelf = forceClubIntoPremierLeague(career, career.player.club);
  check(!cantTargetSelf.ok, "the player's own club can never be the one displaced by this action");

  const membersBefore = membershipOf(career);
  const moved = forceClubIntoPremierLeague(career, "Real Madrid");
  check(moved.ok, `a real, external club is genuinely forced into the Premier League (${moved.reason ?? ""})`);
  if (moved.ok) {
    const members = membershipOf(moved.career);
    check(members.premier.includes("Real Madrid"), "Real Madrid is genuinely now in the Premier League");
    check(members.premier.length === membersBefore.premier.length, "the Premier League stays at its own fixed size — someone real was displaced, not just added");
    check(!!moved.displacedFromPremier && members.championship.includes(moved.displacedFromPremier),
      "the displaced Premier League club genuinely lands in the Championship");
    check(members.championship.length === membersBefore.championship.length, "the Championship also stays at its own fixed size");
    check(!!moved.displacedToLimbo && (moved.career.limboClubs ?? []).includes(moved.displacedToLimbo),
      "the club bumped out of the Championship genuinely lands in limbo, not just vanishing");
    check(!members.championship.includes(moved.displacedToLimbo!) && !members.pool.includes(moved.displacedToLimbo!),
      "…and is genuinely gone from both the Championship and the ordinary pool while in limbo");

    // A limbo club is eligible for real promotion back the FOLLOWING season —
    // resolveLadder should fold it back into the pool draw, not lose it or
    // leave the pool oversized.
    const order = [...CHAMPIONSHIP_CLUBS];
    let nextCareer: CareerState = {
      ...moved.career,
      division: "championship" as any,
      league: order.map((name, i) => ({ name, strength: 75, played: 46, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: (order.length - i) * 3 })),
    };
    const ladder = resolveLadder(nextCareer, mulberry32(5));
    const allAfter = [...ladder.divisions.premier, ...ladder.divisions.championship, ...ladder.divisions.pool, ...ladder.limbo];
    check(new Set(allAfter).size === allAfter.length, "after the very next ladder resolution, nobody is in two places at once, including anyone still in limbo");
    check(ladder.divisions.pool.length === membersBefore.pool.length, "the pool is still exactly its own fixed size after folding a limbo return back in");
    check(allAfter.includes(moved.displacedToLimbo!), "the limbo club is still somewhere real in the world — never silently dropped");
  }
}

// ── New competition creation: a real, standalone knockout bracket ─────────
{
  const created = createCompetition("test-comp", "Test Cup", [...PREMIER_LEAGUE_CLUBS]);
  if ("ok" in created) { check(false, "fixture assumption failed: could not even create the competition"); }
  else {
    check(created.clubs.length === 16, `20 real entrants trim to the largest clean bracket, 16, not a padded or truncated-wrong number (saw ${created.clubs.length})`);
    check(created.winner === null, "a fresh bracket has no winner yet");

    const strengthOf = (c: string) => 70 + PREMIER_LEAGUE_CLUBS.indexOf(c);
    const afterOneRound = playCompetitionRound(created, strengthOf, mulberry32(1));
    check(afterOneRound.clubs.length === 8, "one real round halves the real bracket");
    check(afterOneRound.history.length === 1 && afterOneRound.history[0].results.length === 8, "every match in the round is a real, recorded result");

    const finished = playCompetitionToWinner(created, strengthOf, mulberry32(2));
    check(!!finished.winner && created.clubs.includes(finished.winner), "playing it all the way through produces a real winner, from the real entrants");
    check(finished.history.reduce((n, r) => n + r.results.length, 0) === 15, "a 16-club knockout plays exactly 15 real matches, no more, no fewer");
  }

  const tooFew = createCompetition("test-comp-2", "Tiny Cup", ["Arsenal"]);
  check("ok" in tooFew && tooFew.ok === false, "a competition needs at least two real clubs to exist at all");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — offside can be genuinely abolished, extra European slots genuinely change real qualification, forced league movement creates and heals a real limbo tier, and a new competition is a real, honest knockout bracket");
