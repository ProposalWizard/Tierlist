import {
  WEEK_ACTIONS, WEEK_RECOVERY, REST_ENERGY, actionsLeft, canAct, spendAction, rest, startNewWeek,
} from "../../lib/star/week";
import { hookCheck } from "../../lib/star/selection";
import { liveRating, finaliseMatch } from "../../lib/star/matchStats";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * The week between matches, and being taken off during one.
 *
 * Energy was a one-way street: it started at 100, cost 40 a match and 15 a
 * training session, and outside a drink or a dilemma never came back. Eighteen
 * league matches drain 720 against a pool of 100, so by the third week of the
 * first season you sat pinned at the floor and could never train again — the one
 * currency the whole life side of the game runs on was unspendable.
 *
 * And your rating and your legs decided nothing about how long you stayed on the
 * pitch. You played every minute of every match you started, however badly it
 * was going and however empty you were.
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
  club: "Arsenal", nationality: "England",
} as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const TRAINING_COST = 15;

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

// ── Rest costs a day and buys real energy ──────────────────────────────────
{
  const tired: CareerState = { ...base(), energy: 40, happiness: 50 };
  const rested = rest(tired);
  check(rested.energy === 40 + REST_ENERGY, `resting is worth ${REST_ENERGY} energy`);
  check(rested.happiness > tired.happiness, "and does you good besides");
  check(actionsLeft(rested) === WEEK_ACTIONS - 1, "and costs a day");

  const full: CareerState = { ...base(), energy: 95 };
  check(rest(full).energy === 100, "energy never goes over 100");

  let none = base();
  for (let i = 0; i < WEEK_ACTIONS; i++) none = spendAction(none);
  const spent = { ...none, energy: 40 };
  check(rest(spent).energy === 40, "you cannot rest on a day you do not have");
}

// ── The bug this fixes: a season you can actually train in ─────────────────
//
// Before, energy only went down. This plays a whole season doing nothing but
// playing and training whenever there is a day and the energy for it, and
// asserts you are still training in the final weeks.
{
  let c = base();
  let sessions = 0;
  let sessionsInLastThird = 0;
  let weeks = 0;
  let floored = 0;
  const total = c.fixtures.filter(f => (f.kind ?? "league") === "league").length;

  while (nextFixtureFor(c) && weeks < 60) {
    // Spend the week: train while there is a day and the energy for it, rest
    // when there is not, exactly as a player would.
    while (canAct(c)) {
      if (c.energy >= TRAINING_COST + 25) {
        c = spendAction({ ...c, energy: c.energy - TRAINING_COST });
        sessions++;
        if (weeks > total * 0.66) sessionsInLastThird++;
      } else {
        c = rest(c);
      }
    }
    if (c.energy <= 16) floored++;
    const f = nextFixtureFor(c)!;
    c = creditMatchResult(c, f, matchResult()).career;
    weeks++;
  }

  check(weeks > 15, `a whole season is played (${weeks} weeks)`);
  check(sessions > 20, `and you can actually train through it (${sessions} sessions)`);
  check(sessionsInLastThird > 3,
    `including in the closing weeks (${sessionsInLastThird}) — the old model had you pinned at the floor by week three`);
  check(floored === 0, `and you never arrive at a match empty (${floored} weeks at the floor)`);
  check(c.energy > 20, `finishing the season with something left (${Math.round(c.energy)})`);
}

// ── …but you cannot have everything ────────────────────────────────────────
//
// Training three times a week costs more than a week gives back. That is the
// tension: a budget you can always afford is not a budget.
{
  const cost = WEEK_ACTIONS * TRAINING_COST + 40;   // three sessions plus a match
  check(cost > WEEK_RECOVERY,
    `three sessions and a match cost more than a week returns (${cost} vs ${WEEK_RECOVERY})`);
  check(TRAINING_COST * 2 + 40 > WEEK_RECOVERY,
    "and so do two — you have to rest sometimes, or buy the energy");
  check(REST_ENERGY + WEEK_RECOVERY - 40 > 0,
    "resting and playing leaves you better off, so recovery is always reachable");
}

// ── Every week rolls over, played or not ───────────────────────────────────
{
  const c = { ...base(), energy: 30, weekActions: 0 };
  const f = nextFixtureFor(c)!;
  const after = creditMatchResult(c, f, matchResult()).career;
  check(actionsLeft(after) === WEEK_ACTIONS, "playing a match starts a new week");
  check(after.energy > 30 - 40, `and the week gives energy back (${Math.round(after.energy)})`);

  const roll = startNewWeek(50);
  check(roll.energy === 50 + WEEK_RECOVERY && roll.weekActions === WEEK_ACTIONS, "the rollover is one place");
  check(startNewWeek(95).energy === 100, "and never overfills you");
}

// ── Being taken off ────────────────────────────────────────────────────────
{
  const rng = mulberry32(7);
  const never = (over: Partial<Parameters<typeof hookCheck>[0]>) =>
    Array.from({ length: 400 }, (_, i) => hookCheck({
      minute: 70, startMinute: 0, liveRating: 7.5, energy: 80, scoreDiff: 0,
      rng: mulberry32(i + 1), ...over,
    })).filter(d => d.hooked).length;

  check(never({}) === 0, "a player having a good game on full legs is never taken off");
  check(never({ minute: 50, liveRating: 5.7, energy: 5 }) === 0, "nobody is hooked before the hour");
  check(never({ minute: 66, startMinute: 60, liveRating: 5.7, energy: 5 }) === 0,
    "and not within a quarter of an hour of coming on");

  // 5.8 is what a real contributionless defeat scores — the formula starts at
  // 6.0 and only a defeat pulls it down, so nothing lower is reachable in play.
  const bad = never({ liveRating: 5.8 });
  check(bad > 0 && bad < 400, `a bad afternoon can get you hooked, and does not always (${bad}/400)`);
  const empty = never({ energy: 8 });
  check(empty > 0, `empty legs can too (${empty}/400)`);
  check(empty > bad, `and the legs are the steeper of the two (${empty} vs ${bad}) — you could see that one coming`);

  const won = never({ scoreDiff: 4, minute: 80 });
  check(won > 0, `and being rested with the game won is a thing (${won}/400)`);
  const restedReasons = Array.from({ length: 200 }, (_, i) => hookCheck({
    minute: 80, startMinute: 0, liveRating: 8, energy: 90, scoreDiff: 4, rng: mulberry32(i + 500),
  })).filter(d => d.hooked);
  check(restedReasons.every(d => d.reason === "rested"), "…and it is not dressed up as a punishment");
  check(restedReasons.every(d => !d.message.includes("number is up")), "the message matches the reason");

  // Later is likelier, for all of them.
  const early = never({ liveRating: 5.8, minute: 62 });
  const late = never({ liveRating: 5.8, minute: 88 });
  check(late > early, `the longer it goes the likelier it gets (${early} at 62' vs ${late} at 88')`);

  check(rng() >= 0, "the rng helper is used");
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
