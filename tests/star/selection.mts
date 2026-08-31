import {
  selectionFor, selectionStanding, MISSED_WEEK, MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB,
} from "../../lib/star/selection";
import { setPieceDuties, setPieceSkills } from "../../lib/star/setPieces";
import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * Team selection, and set-piece duty.
 *
 * Both existed as numbers that decided nothing. `career.status` was stamped
 * "1st Team" when the career was created and never touched again, so you could
 * be on 3 out of 100 with the manager and still start every week. And
 * `skills.freeKick` was trainable, had an achievement for maxing it, appeared on
 * two screens — and was read by no code anywhere.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 18, position: "CAM",
  club: "Arsenal", nationality: "England",
} as StarPlayer;

const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];

const base = () => makeInitialCareer(PLAYER, CLUBS);

const withState = (over: Partial<CareerState>): CareerState => ({ ...base(), ...over });

const stats = (rating: number): MatchStats => ({
  chances: 4, goals: 0, assists: 0, passes: 10, rating, starMan: false,
  bossChange: rating >= 7 ? 3 : -5, teamChange: 0, fansChange: 0,
  wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1,
  homeScore: 1, awayScore: 1,
});

// ── A new career starts ─────────────────────────────────────────────────────
{
  const v = selectionFor(base());
  check(v.status === "1st Team", `a new player is in the side (${v.status}, standing ${v.standing.toFixed(0)})`);
  check(v.onAt === 0, "and starts the match");
}

// ── A bad run costs you your place, in stages ──────────────────────────────
{
  const dip = withState({ relationships: { ...base().relationships, boss: 38 }, form: [5.2, 5.5, 5.0, 4.8, 5.4] });
  const bench = selectionFor(dip);
  check(bench.status === "Substitute", `a poor run puts you on the bench (${bench.status}, ${bench.standing.toFixed(0)})`);
  check(bench.onAt >= 55 && bench.onAt < 75, `and you come on in the last half hour (${bench.onAt}')`);

  const dropped = withState({
    relationships: { ...base().relationships, boss: 12 },
    form: [3.8, 4.1, 3.5, 4.0, 3.2], starRating: 1.2, matchFitness: 55,
  });
  check(selectionFor(dropped).status === "Squad", "keep it up and you are out of the squad altogether");
  check(selectionFor(dropped).onAt === 90, "…and you do not play a minute");

  // The bench is the middle rung, not the floor: a bad month must cost minutes
  // before it costs the squad.
  check(selectionStanding(dip) > selectionStanding(dropped), "the standing scale is ordered");
}

// ── One bad game is not a run ───────────────────────────────────────────────
//
// Caught by measurement: averaging only the games actually PLAYED let a single
// match swing the whole judgement, so one 4.2 in your opening week put you on
// the bench. The window is a fixed five, padded with neutral performances.
{
  let c = base();
  const bad = { ...stats(4.2), bossChange: -5 };
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    const f = c.fixtures.find(x => !x.played)!;
    c = creditMatchResult(c, f, bad).career;
    // Topped up between matches — five full ninety-minute games in a row
    // with no recovery would run energy down on its own and pull the
    // manager's verdict all the way to Squad regardless of form, which is
    // its own real behaviour (see tests/star/energy.mts) but not what this
    // block is isolating.
    c = { ...c, energy: 100 };
    seen.push(selectionFor(c).status);
  }
  check(seen[0] === "1st Team", `one bad game does not cost you your place (${seen[0]})`);
  check(seen.includes("Substitute"), `a run of them does (${seen.join(" → ")})`);
  check(seen.indexOf("Substitute") >= 2, "and it takes at least three of them");
}

// ── A cameo is judged on less evidence ─────────────────────────────────────
//
// `minutes` had been an argument of finaliseMatch since it was written and was
// read by nothing: a substitute who played twenty minutes was rated as though
// he had played ninety.
{
  const c = base();
  const full = finaliseMatch(6, 2, 1, 20, 90, 3, 1, c);
  const cameo = finaliseMatch(2, 2, 1, 6, 22, 3, 1, c);
  check(full.rating > cameo.rating, `two goals in ninety beats two in twenty (${full.rating} vs ${cameo.rating})`);
  check(cameo.rating > 6.5, "a good cameo is still a good cameo");

  const fullBad = finaliseMatch(6, 0, 0, 4, 90, 0, 2, c);
  const cameoBad = finaliseMatch(1, 0, 0, 1, 22, 0, 2, c);
  check(cameoBad.rating > fullBad.rating, `and you cannot be blamed for twenty minutes (${cameoBad.rating} vs ${fullBad.rating})`);

  // A full match must be completely unchanged by this — the multiplier is
  // exactly 1 at ninety minutes.
  const raw = Math.max(1, Math.min(10, 6.0 + 2 * 1.2 + 0.8 + 20 * 0.05 + 0.4));
  check(Math.abs(full.rating - Math.round(raw * 10) / 10) < 0.05,
    `a ninety-minute rating is untouched (${full.rating} vs ${raw})`);
  check((full.minutes ?? 0) === 90 && (cameo.minutes ?? 0) === 22, "the minutes played are carried on the result");
}

// ── Playing well keeps you in ───────────────────────────────────────────────
{
  const flying = withState({
    relationships: { ...base().relationships, boss: 92 },
    form: [8.4, 7.9, 8.8, 9.1, 8.0], starRating: 4.2,
  });
  const v = selectionFor(flying);
  check(v.status === "1st Team", "a player in form starts");
  check(v.reason.includes("First name"), `and is told as much ("${v.reason}")`);
}

// ── Energy is a floor, not another weighted input ───────────────────────────
//
// Applied ON TOP of the standing-based verdict — never upgrading it, only
// ever pulling it down — so a red-hot standing cannot talk the manager into
// starting a player who cannot physically get through ninety minutes.
{
  const inForm = () => withState({
    relationships: { ...base().relationships, boss: 92 },
    form: [8.4, 7.9, 8.8, 9.1, 8.0], starRating: 4.2,
  });

  const rested = selectionFor({ ...inForm(), energy: 100 });
  check(rested.status === "1st Team", "plenty of energy, nothing changes");

  const leggy = selectionFor({ ...inForm(), energy: MIN_ENERGY_TO_START - 1 });
  check(leggy.status === "Substitute",
    `too fatigued to start, even in career-best form (${leggy.status}, energy ${MIN_ENERGY_TO_START - 1})`);
  check(leggy.reason.toLowerCase().includes("fatigu"), `and told why ("${leggy.reason}")`);

  const shattered = selectionFor({ ...inForm(), energy: MIN_ENERGY_TO_SUB - 1 });
  check(shattered.status === "Squad",
    `running on empty is not even trusted off the bench (${shattered.status}, energy ${MIN_ENERGY_TO_SUB - 1})`);
  check(shattered.onAt === 90, "…and does not play a minute");

  // The other direction must never happen: energy cannot upgrade a verdict
  // standing alone would not have earned.
  const outOfFormButFresh = selectionFor(withState({
    relationships: { ...base().relationships, boss: 10 },
    form: [3.5, 3.8, 3.2, 3.6, 3.4], starRating: 1.5, matchFitness: 60, energy: 100,
  }));
  check(outOfFormButFresh.status === "Squad", "full energy does not rescue a player nobody wants to pick");
}

// ── A real injury overrides everything, energy included ────────────────────
{
  const starButInjured = withState({
    relationships: { ...base().relationships, boss: 95 },
    form: [9, 9, 9, 9, 9], starRating: 5, energy: 100,
    injury: { weeksRemaining: 3, note: "Hamstring strain" },
  });
  const v = selectionFor(starButInjured);
  check(v.status === "Injured", `nothing else matters while injured (${v.status})`);
  check(v.onAt === 90, "…and you do not play a minute");
  check(v.reason.includes("Hamstring strain") && v.reason.includes("3 more week"),
    `the reason names the injury and the timeline ("${v.reason}")`);

  const oneWeekLeft = selectionFor({ ...starButInjured, injury: { weeksRemaining: 1, note: "Knock" } });
  check(oneWeekLeft.reason.includes("1 more week") && !oneWeekLeft.reason.includes("1 more weeks"),
    `singular when it is down to the last week ("${oneWeekLeft.reason}")`);

  const notInjured = selectionFor({ ...starButInjured, injury: null });
  check(notInjured.status === "1st Team", "and clearing it hands the verdict straight back to form and energy");
}

// ── It must not be a trap you cannot climb out of ──────────────────────────
{
  // Dropped, and unable to raise the boss relationship by playing well because
  // you are not playing. Missing weeks alone has to be enough to get back.
  let c = withState({
    relationships: { ...base().relationships, boss: 10 },
    form: [3.5, 3.8, 3.2, 3.6, 3.4], starRating: 1.5, matchFitness: 60,
  });
  check(selectionFor(c).status === "Squad", "start from out of the squad");

  let weeks = 0;
  while (selectionFor(c).status === "Squad" && weeks < 60) {
    const f = c.fixtures.find(f => !f.played);
    if (!f) break;
    c = simulateMissedFixture(c, f).career;
    weeks++;
  }
  check(selectionFor(c).status !== "Squad",
    `sitting out eventually gets you back on the bench (took ${weeks} weeks)`);
  check(weeks >= 3, `but not immediately — being dropped has to sting (${weeks} weeks)`);
  check(weeks <= 25, `and not for half a career (${weeks} weeks)`);
  check(c.matchFitness < 60, `sitting out costs you sharpness (${c.matchFitness.toFixed(0)})`);
  check(MISSED_WEEK.boss > 0 && MISSED_WEEK.matchFitness < 0, "the trade is explicit: the manager softens, the legs go");
}

// ── A missed week is a real week ───────────────────────────────────────────
{
  const c = base();
  const f = c.fixtures.find(x => !x.played)!;
  const before = { week: c.week, apps: c.seasonStats.appearances, played: c.league.find(t => t.name === PLAYER.club)!.played };
  const { career: after } = simulateMissedFixture(c, f);

  check(after.week === before.week + 1, "the week advances");
  check(after.fixtures.find(x => x.week === f.week)!.played, "the fixture is played");
  check(after.seasonStats.appearances === before.apps, "you are not credited with an appearance");
  check(after.league.find(t => t.name === PLAYER.club)!.played === before.played + 1, "your club still played it");
  check(after.money > c.money, "and you are still paid");
  check(after.form.length === c.form.length,
    "a match you did not play does not go into your form — otherwise being dropped would drop you further");

  // Every club plays exactly one game — the same invariant the played path holds.
  const games = after.league.reduce((n, t) => n + t.played, 0);
  check(games === after.league.length, `the whole division played one round (${games} of ${after.league.length})`);
}

// ── The stored status keeps up ─────────────────────────────────────────────
{
  let c = base();
  for (let i = 0; i < 6; i++) {
    const f = c.fixtures.find(x => !x.played)!;
    c = creditMatchResult(c, f, stats(3.5)).career;
  }
  check(c.status !== "1st Team",
    `six bad games and the stored status has moved (${c.status})`);
  check(c.status === selectionFor(c).status, "the stored status agrees with the manager");
}

// ── Set-piece duty is earned, and earned relative to the club ──────────────
{
  const weakClub = base();
  weakClub.league = weakClub.league.map(t => t.name === PLAYER.club ? { ...t, strength: 58 } : t);
  const bigClub = base();
  bigClub.league = bigClub.league.map(t => t.name === PLAYER.club ? { ...t, strength: 88 } : t);

  const a = setPieceDuties(weakClub), b = setPieceDuties(bigClub);
  check(a.freeKickNeeded < b.freeKickNeeded,
    `the same player takes free kicks sooner at a smaller club (${a.freeKickNeeded} vs ${b.freeKickNeeded})`);
  check(a.penaltyNeeded < a.freeKickNeeded, "penalties come before free kicks");

  // A beginner takes neither; training it takes them over.
  const rookie = { ...weakClub, skills: { ...weakClub.skills, freeKick: 30 }, starRating: 1 };
  check(!setPieceDuties(rookie).freeKicks && !setPieceDuties(rookie).penalties, "a beginner takes neither");

  const trained = { ...weakClub, skills: { ...weakClub.skills, freeKick: 85 }, starRating: 4 };
  check(setPieceDuties(trained).freeKicks && setPieceDuties(trained).penalties, "train it and they are yours");

  // …and moving to a bigger club can take them off you again, which is the point.
  const movedUp = { ...bigClub, skills: { ...bigClub.skills, freeKick: 55 }, starRating: 2.5 };
  const stayedPut = { ...weakClub, skills: { ...weakClub.skills, freeKick: 55 }, starRating: 2.5 };
  check(setPieceDuties(stayedPut).freeKicks && !setPieceDuties(movedUp).freeKicks,
    "the same player loses the free kicks when he moves up");

  // Not in the squad, not taking anything.
  const out = setPieceDuties(trained, "Squad");
  check(!out.freeKicks && !out.penalties, "a player who is not in the squad takes nothing");
  const sub = setPieceDuties(trained, "Substitute");
  check(sub.penalties, "a substitute can absolutely take a penalty");
}

// ── The free-kick rating is what strikes a dead ball ───────────────────────
{
  const open = { power: 70, technique: 40 };
  check(setPieceSkills(open, 95, "one_on_one") === open, "open play is untouched by the free-kick rating");
  check(setPieceSkills(open, 95, "long_range") === open, "…and so is a shot from distance");

  const fk = setPieceSkills(open, 95, "free_kick");
  check(fk.technique > open.technique, `a specialist strikes a free kick better than his general technique (${open.technique} → ${fk.technique})`);
  check(fk.power === open.power, "power is unchanged — this is placement, not force");

  const poor = setPieceSkills(open, 10, "penalty");
  check(poor.technique < open.technique, `and a player who cannot hit them is worse at it (${poor.technique})`);
  check(setPieceSkills(open, 40, "free_kick").technique === 40, "at parity it makes no difference");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the manager picks the side, and set-piece duty is earned");
