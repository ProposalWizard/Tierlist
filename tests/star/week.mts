import {
  WEEK_ACTIONS, REST_ENERGY, SKIP_ENERGY, actionsLeft, canAct, spendAction, rest, skipToMatchDay, startNewWeek,
} from "../../lib/star/week";
import { hookCheck } from "../../lib/star/selection";
import { liveRating, finaliseMatch } from "../../lib/star/matchStats";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * The week between matches, and being taken off during one.
 *
 * Energy is back, rebuilt against the real design: a budget spent by playing
 * and earned back only by a deliberate choice — Rest, or giving up the rest
 * of the week outright — never by the week simply turning over. What remains
 * here from the earlier no-energy era is the three-actions-a-week structure
 * itself and two of the three reasons a manager takes a player off; the
 * third, tired legs, is energy's own.
 *
 * Your rating decided nothing about how long you stayed on the pitch either,
 * before any of this. You played every minute of every match you started,
 * however badly it was going.
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
  club: "Arsenal", nationality: "England", startYear: 2027,
} as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const matchResult = (minutes = 90): MatchStats => ({
  minutes, chances: 5, goals: 1, assists: 0, passes: 12, rating: 7.2, starMan: false,
  bossChange: 2, teamChange: 1, fansChange: 2,
  wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0,
});

// ── A week is three things ─────────────────────────────────────────────────
{
  const c = base();
  check(actionsLeft(c) === WEEK_ACTIONS, `a fresh week has ${WEEK_ACTIONS} days in it`);
  check(canAct(c), "and you can do something with them");

  let spent = c;
  for (let i = 0; i < WEEK_ACTIONS; i++) spent = spendAction(spent);
  check(actionsLeft(spent) === 0, "spend them all and there are none left");
  check(!canAct(spent), "and nothing more can be done");
  check(actionsLeft(spendAction(spent)) === 0,
    "spending one you do not have does nothing — the screens disable the buttons, this is the backstop");

  // An old save has no field at all and must not read as a spent week.
  const legacy = { ...c, weekActions: undefined };
  check(actionsLeft(legacy) === WEEK_ACTIONS, "a career saved before weeks existed opens with a full one");
}

// ── Rest costs a day and buys some happiness and energy ─────────────────────
{
  const c: CareerState = { ...base(), happiness: 50, energy: 50 };
  const rested = rest(c);
  check(rested.happiness > c.happiness, "resting does you good");
  check(rested.energy === 50 + REST_ENERGY, `and gives some energy back too (${rested.energy})`);
  check(actionsLeft(rested) === WEEK_ACTIONS - 1, "and costs a day");
  check(rest({ ...c, energy: 95 }).energy === 100, "energy still caps at 100");

  let none = base();
  for (let i = 0; i < WEEK_ACTIONS; i++) none = spendAction(none);
  check(rest(none).happiness === none.happiness, "you cannot rest on a day you do not have");
  check(rest(none).energy === none.energy, "…or gain energy from trying to");
}

// ── Skip to Match Day: the real "regenerates on skipping" ───────────────────
//
// The literal design brief: energy comes back when you skip to the end of
// the week, not on its own. Bigger than Rest's top-up, because it costs
// everything else the week could have been spent on, not just one day of it.
{
  const c: CareerState = { ...base(), energy: 20 };
  const skipped = skipToMatchDay(c);
  check(skipped.energy === 20 + SKIP_ENERGY, `a real top-up (${skipped.energy})`);
  check(SKIP_ENERGY > REST_ENERGY, "skipping the week buys back more than resting once does");
  check(actionsLeft(skipped) === 0, "…because it gives up everything else the week could have been");
  check(skipToMatchDay({ ...c, energy: 90 }).energy === 100, "energy still caps at 100");

  let none = { ...base(), energy: 20 };
  for (let i = 0; i < WEEK_ACTIONS; i++) none = spendAction(none);
  check(skipToMatchDay(none).energy === none.energy, "nothing left to give up, nothing gained");
}

// ── Training is no longer a budget you can run out of ──────────────────────
//
// Nothing gates a training session but the three days a week — this plays a
// whole season training every single day available and asserts it never once
// runs out of anything to spend.
{
  let c = base();
  let sessions = 0;
  let sessionsInLastThird = 0;
  let weeks = 0;
  const total = c.fixtures.filter(f => (f.kind ?? "league") === "league").length;

  while (nextFixtureFor(c) && weeks < 60) {
    while (canAct(c)) {
      c = spendAction(c);
      sessions++;
      if (weeks > total * 0.66) sessionsInLastThird++;
    }
    const f = nextFixtureFor(c)!;
    c = creditMatchResult(c, f, matchResult()).career;
    weeks++;
  }

  check(weeks > 15, `a whole season is played (${weeks} weeks)`);
  check(sessions > 20, `and you can actually train through it (${sessions} sessions)`);
  check(sessionsInLastThird > 3,
    `including in the closing weeks (${sessionsInLastThird}) — nothing pins you at a floor by week three`);
}

// ── Every week rolls over, played or not ───────────────────────────────────
{
  const c = { ...base(), weekActions: 0 };
  const f = nextFixtureFor(c)!;
  const after = creditMatchResult(c, f, matchResult()).career;
  check(actionsLeft(after) === WEEK_ACTIONS, "playing a match starts a new week");

  const roll = startNewWeek();
  check(roll.weekActions === WEEK_ACTIONS, "the rollover is one place");
}

// ── Being taken off ────────────────────────────────────────────────────────
{
  const rng = mulberry32(7);
  const never = (over: Partial<Parameters<typeof hookCheck>[0]>) =>
    Array.from({ length: 400 }, (_, i) => hookCheck({
      minute: 70, startMinute: 0, liveRating: 7.5, scoreDiff: 0,
      rng: mulberry32(i + 1), ...over,
    })).filter(d => d.hooked).length;

  check(never({}) === 0, "a player having a good game is never taken off");
  check(never({ minute: 50, liveRating: 5.7 }) === 0, "nobody is hooked before the hour");
  check(never({ minute: 66, startMinute: 60, liveRating: 5.7 }) === 0,
    "and not within a quarter of an hour of coming on");

  // 5.8 is what a real contributionless defeat scores — the formula starts at
  // 6.0 and only a defeat pulls it down, so nothing lower is reachable in play.
  const bad = never({ liveRating: 5.8 });
  check(bad > 0 && bad < 400, `a bad afternoon can get you hooked, and does not always (${bad}/400)`);

  const won = never({ scoreDiff: 4, minute: 80 });
  check(won > 0, `and being rested with the game won is a thing (${won}/400)`);
  const restedReasons = Array.from({ length: 200 }, (_, i) => hookCheck({
    minute: 80, startMinute: 0, liveRating: 8, scoreDiff: 4, rng: mulberry32(i + 500),
  })).filter(d => d.hooked);
  check(restedReasons.every(d => d.reason === "rested"), "…and it is not dressed up as a punishment");
  check(restedReasons.every(d => !d.message.includes("number is up")), "the message matches the reason");

  // Later is likelier, for both.
  const early = never({ liveRating: 5.8, minute: 62 });
  const late = never({ liveRating: 5.8, minute: 88 });
  check(late > early, `the longer it goes the likelier it gets (${early} at 62' vs ${late} at 88')`);

  check(rng() >= 0, "the rng helper is used");
}

// ── Tired legs — the third reason, energy's own ─────────────────────────────
{
  const fresh = (over: Partial<Parameters<typeof hookCheck>[0]>) =>
    Array.from({ length: 400 }, (_, i) => hookCheck({
      minute: 70, startMinute: 0, liveRating: 7.5, scoreDiff: 0,
      rng: mulberry32(i + 1), ...over,
    })).filter(d => d.hooked).length;

  check(fresh({ liveEnergy: 100 }) === 0, "fresh legs, playing well, never a fatigue hook");
  check(fresh({}) === 0, "and omitting energy entirely defaults to fresh, same as before this existed");

  const knackered = fresh({ liveEnergy: 8 });
  check(knackered > 0 && knackered < 400, `running on empty is a real risk, not a certainty (${knackered}/400)`);

  const legsReasons = Array.from({ length: 200 }, (_, i) => hookCheck({
    minute: 75, startMinute: 0, liveRating: 7.5, scoreDiff: 0, liveEnergy: 5,
    rng: mulberry32(i + 900),
  })).filter(d => d.hooked);
  check(legsReasons.length > 0, "a knackered player having a fine game can still be pulled");
  check(legsReasons.every(d => d.reason === "legs"), "…and it is not mistaken for a bad-form hook");

  // Later is likelier here too.
  const earlyTired = fresh({ liveEnergy: 10, minute: 62 });
  const lateTired = fresh({ liveEnergy: 10, minute: 88 });
  check(lateTired > earlyTired, `the longer he runs on empty the likelier it gets (${earlyTired} at 62' vs ${lateTired} at 88')`);
}

// ── Coming off early is judged on the minutes you played ───────────────────
{
  const c = base();
  const full = finaliseMatch(6, 0, 0, 0, 90, 0, 2, c, [], null);
  const hooked = finaliseMatch(3, 0, 0, 0, 64, 0, 2, c, [], "form");
  check(hooked.rating > full.rating,
    `sixty-four minutes of a bad game is not ninety (${hooked.rating} vs ${full.rating})`);
  // …and the real floor of the formula, which is what the hook threshold had to
  // be set against.
  check(full.rating === 5.7, `a contributionless defeat is the worst rating the formula produces (${full.rating})`);
  check(hooked.hooked === "form", "and the reason travels with the result");

  // …but the manager still notices.
  const withHook = creditMatchResult(c, nextFixtureFor(c)!, { ...matchResult(64), hooked: "form", bossChange: 0 }).career;
  const without = creditMatchResult(c, nextFixtureFor(c)!, { ...matchResult(64), hooked: null, bossChange: 0 }).career;
  check(withHook.relationships.boss < without.relationships.boss,
    `being hooked for your form costs you with him (${withHook.relationships.boss} vs ${without.relationships.boss})`);

  const rested = creditMatchResult(c, nextFixtureFor(c)!, { ...matchResult(78), hooked: "rested", bossChange: 0 }).career;
  check(rested.relationships.boss === without.relationships.boss, "being rested costs you nothing");
}

// ── One rating formula, not two ────────────────────────────────────────────
{
  const c = base();
  const full = finaliseMatch(6, 2, 1, 20, 90, 3, 1, c);
  const live = liveRating(2, 1, 20, 3, 1);
  check(Math.abs(full.rating - Math.round(live * 10) / 10) < 0.05,
    `the manager reads mid-match exactly what the scoresheet reads at the end (${live} vs ${full.rating})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a week is a budget you can spend, and the manager can take you off");
