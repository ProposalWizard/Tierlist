import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { MIN_ENERGY_TO_START } from "../../lib/star/selection";
import {
  benchMomentFor, captainMomentDue, captainLine, pickAfterMatch, pickAfterMissed, fixtureMomentKey,
} from "../../lib/star/managerMoments";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * TWO MANAGER MOMENTS (MANAGER_PLAN.md, 7 Oct 2026).
 *
 *  1. Made captain: fires once, the match the armband is first earned; never
 *     again on later matches or on a replay of the same match.
 *  2. Dropped to the bench: fires on starter → sub; not sub → sub, not when
 *     injured or out of the squad, not for an international, not twice for
 *     one fixture. Back from injury says so.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 22, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function stats(extra: Partial<MatchStats> = {}): MatchStats {
  return {
    chances: 5, goals: 1, assists: 0, passes: 28, rating: 7.4, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 1,
    sponsorPay: 0, totalCash: 2, homeScore: 2, awayScore: 0, minutes: 90, ...extra,
  };
}

const clubFixture = (c: CareerState): Fixture => c.fixtures.find((f) => !f.played && f.kind !== "international")!;

// ── 1. Made captain ────────────────────────────────────────────────────────
{
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  // Everything captaincyEarned asks for, short of the armband itself.
  let c: CareerState = {
    ...base, captain: false, starRating: 4.5, clubAppearances: 30,
    relationships: { ...base.relationships, team: 95, boss: 95 },
  };
  check(!captainMomentDue(c), "no captain moment before the armband");

  const f1 = clubFixture(c);
  const after1 = creditMatchResult(c, f1, stats()).career;
  check(after1.captain === true, "the armband is given when earned");
  check(captainMomentDue(after1), "the captain moment fires the match the armband is earned");
  check(captainLine(after1).startsWith("You're my captain") || captainLine(after1).startsWith("The armband's yours"),
    `captain line reads as the manager telling you (${captainLine(after1)})`);

  // Seen on Home: the flag clears.
  c = { ...after1, captainMomentPending: false };
  check(!captainMomentDue(c), "seen once, the captain moment is gone");

  // A replay of the same match, and the next match: still captain, never again.
  const replay = creditMatchResult(c, f1, stats()).career;
  check(!captainMomentDue(replay), "a replayed match does not fire the captain moment again");
  const after2 = creditMatchResult(c, clubFixture(c), stats()).career;
  check(after2.captain === true && !captainMomentDue(after2), "the next match (still captain) does not fire it again");

  // Ten more matches: never again.
  let d = after2;
  let fired = 0;
  for (let i = 0; i < 10; i++) {
    const f = clubFixture(d);
    if (!f) break;
    d = creditMatchResult(d, f, stats()).career;
    if (captainMomentDue(d)) fired++;
  }
  check(fired === 0, `captain moment fired ${fired} more times over ten matches`);

  // A pending flag without the armband (lost it before Home) shows nothing.
  check(!captainMomentDue({ ...after1, captain: false }), "no moment if the armband was lost before it was seen");
}

// ── 2. Recording what you were picked as ───────────────────────────────────
{
  check(pickAfterMatch({ minutes: 90 }).status === "1st Team", "a full match counts as a start");
  check(pickAfterMatch({ minutes: 25, cameo: true }).status === "Substitute", "a cameo counts as off the bench");
  check(pickAfterMissed({ status: "1st Team" }, true)?.status === "1st Team", "injured: what you were is kept");
  check(pickAfterMissed({ status: "1st Team" }, true)?.injuredSince === true, "injured: marked as out");
  check(pickAfterMissed({ status: "1st Team" }, false)?.status === "Squad", "left out: Squad");

  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  const started = creditMatchResult(base, clubFixture(base), stats()).career;
  check(started.lastPick?.status === "1st Team", `a played start is recorded (${JSON.stringify(started.lastPick)})`);
  const subbed = creditMatchResult(base, clubFixture(base), stats({ minutes: 20, cameo: true, enteredAt: 70 })).career;
  check(subbed.lastPick?.status === "Substitute", "a cameo is recorded as off the bench");
  const hurt = simulateMissedFixture({ ...started, injury: { note: "Hamstring", weeksRemaining: 2 } } as CareerState, clubFixture(started)).career;
  check(hurt.lastPick?.status === "1st Team" && hurt.lastPick?.injuredSince === true, "a missed match injured keeps the start and marks the injury");
  check(creditMatchResult(hurt, clubFixture(hurt), stats()).career.lastPick?.injuredSince !== true, "playing again clears the injury mark");
}

// ── 3. Dropped to the bench ────────────────────────────────────────────────
{
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  const fx = clubFixture(base);
  const sub = { status: "Substitute" as const };
  const starter: CareerState = { ...base, lastPick: { status: "1st Team" }, energy: 100 };

  const m = benchMomentFor(starter, sub, fx, 100);
  check(!!m, "starter → sub fires the bench moment");
  check(!!m && m.text.length > 20, "the bench moment has words");

  check(benchMomentFor({ ...starter, lastPick: { status: "Substitute" } }, sub, fx, 100) === null, "sub → sub does not fire");
  check(benchMomentFor({ ...starter, lastPick: { status: "Squad" } }, sub, fx, 100) === null, "squad → sub does not fire");
  check(benchMomentFor({ ...base, lastPick: undefined }, sub, fx, 100) === null, "an old save with no record does not fire");
  check(benchMomentFor(starter, { status: "Injured" }, fx, 100) === null, "injured does not fire");
  check(benchMomentFor(starter, { status: "Squad" }, fx, 100) === null, "out of the squad does not fire");
  check(benchMomentFor(starter, { status: "1st Team" }, fx, 100) === null, "still starting does not fire");
  check(benchMomentFor(starter, sub, { ...fx, kind: "international" }, 100) === null, "an international does not fire");
  check(benchMomentFor({ ...starter, benchMomentSeen: fixtureMomentKey(starter, fx) }, sub, fx, 100) === null,
    "seen for this fixture: not said twice");

  // The real reason, when there is one.
  const tired = benchMomentFor(starter, sub, fx, MIN_ENERGY_TO_START - 1);
  check(tired?.reason === "energy", `low energy is the reason (${tired?.reason})`);
  const back = benchMomentFor({ ...starter, lastPick: { status: "1st Team", injuredSince: true } }, sub, fx, 100);
  check(back?.reason === "injury", `back from injury is the reason (${back?.reason})`);
  const angry = benchMomentFor({ ...starter, relationships: { ...starter.relationships, boss: 20 } }, sub, fx, 100);
  check(angry?.reason === "boss" || angry?.reason === "rival", `a bad relationship (or a rival with the shirt) is the reason (${angry?.reason})`);

  // Deterministic for the same fixture.
  check(benchMomentFor(starter, sub, fx, 100)?.text === m?.text, "same fixture, same words");
}

if (problems.length) {
  console.error(`managerMoments: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("managerMoments: all checks passed");
