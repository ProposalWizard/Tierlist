/**
 * THE CAREER CLOCK (lib/star/life/clock.ts, plan phase 1): time adds up, sleep lands at 07:00, the
 * clock never passes time to leave for a match (you can never sleep past one), the days run out at
 * match day, a played match starts a new gap in the evening, the week's things cost half a day, the
 * saved clock is small, and an old save with no clock loads and reads a sensible time.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { rest } from "../../lib/star/week";
import { sleepNight } from "../../lib/star/home3d/sleep";
import { loadCareerFromStoredForm } from "../../lib/star/storage";
import { absOf, clockOf, passTime, sleepClock, leaveAt, timeToLeave, nextMatchInfo, hhmm, gapKey, todayList, clockSubline, WAKE_AT, WEEK_THING_MINS, DAY_MINS, LEAVE_BEFORE_KICKOFF } from "../../lib/star/life/clock";
import { LiveClock } from "../../lib/star/life/liveClock";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const base: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 60 };

// ── a fresh career (no match played): 09:00 the day before the first match ──
const c0 = clockOf(base);
check(c0.d === 0 && c0.m === 9 * 60, `a new career starts 09:00 on day 0 (got d${c0.d} ${hhmm(c0.m)})`);
const nx = nextMatchInfo(base);
check(!!nx && nx.day >= 1, `the first match is on a later day (day ${nx?.day})`);
check(!!nx && nx.leave === nx.day * DAY_MINS + nx.ko - LEAVE_BEFORE_KICKOFF, "time to leave = kick-off minus 2 h 30");

// ── costs add up ──
const a1 = passTime(base, 10);
check(absOf(clockOf(a1)) === absOf(c0) + 10, "10 minutes pass");
const a2 = passTime(passTime(a1, 25), 40);
check(absOf(clockOf(a2)) === absOf(c0) + 75, "10 + 25 + 40 = 75 minutes");
check(passTime(base, 0) === base && passTime(base, -5) === base, "no time, or less than none: the same career");
check(JSON.stringify(a2.clock).length <= 30, `the saved clock is small (${JSON.stringify(a2.clock).length} bytes)`);

// ── never past time to leave ──
const far = passTime(base, 100 * DAY_MINS);
check(absOf(clockOf(far)) === leaveAt(base), "a long wait stops exactly at time to leave");
check(timeToLeave(far) && !timeToLeave(base), "time to leave shows only then");
check(clockSubline(far).includes("Time to leave"), `the clock's line says so ("${clockSubline(far)}")`);
check(todayList(far)[0].what.includes("leave for the match"), "the Today list says so");

// ── sleep: 07:00 next day; never past the match ──
const eve = passTime(base, 13 * 60); // 22:00 on day 0
const slept = sleepClock(eve);
check(clockOf(slept).d === 1 && clockOf(slept).m === WAKE_AT, `asleep at ${hhmm(clockOf(eve).m)}: awake 07:00 next day (d${clockOf(slept).d} ${hhmm(clockOf(slept).m)})`);
const lateNight = passTime(base, 16 * 60); // 01:00 day 1
const slept2 = sleepClock(lateNight);
check(clockOf(slept2).d === 1 && clockOf(slept2).m === WAKE_AT, "asleep after midnight: awake 07:00 the same morning");
let sl = base;
for (let i = 0; i < 40; i++) sl = sleepClock(sl);
check(absOf(clockOf(sl)) === leaveAt(base), "forty nights in a row never sleep past the match");
// the night with Rest: the clock is read from before Rest (Rest's half day is not added to the night)
const night = sleepClock(eve, sleepNight(eve).career);
check(clockOf(night).m === WAKE_AT && clockOf(night).d === 1 && night.energy > eve.energy, "the night with Rest: 07:00 next day and the energy");

// ── the week's 3 things cost half a day each ──
const r1 = rest(base);
check(absOf(clockOf(r1)) === absOf(c0) + WEEK_THING_MINS, `Rest costs ${WEEK_THING_MINS} minutes`);
const r0 = rest({ ...base, weekActions: 0 });
check(r0.weekActions === 0 && absOf(clockOf(r0)) === absOf(c0), "nothing left this week: no time either");

// ── days run out at match day: the gap ends; a played match starts a new one in the evening ──
const fx = base.fixtures.map((f) => ({ ...f }));
const first = fx.findIndex((f) => f.opponent === nx!.f.opponent && f.week === nx!.f.week);
fx[first] = { ...fx[first], played: true };
const after: CareerState = { ...far, fixtures: fx };
check(gapKey(after) !== gapKey(far), "a played match is a new gap");
const ca = clockOf(after);
check(ca.d === 0 && ca.m >= 17 * 60 && ca.m <= 23 * 60, `after the match: the evening of match day (${hhmm(ca.m)})`);
check(!timeToLeave(after), "a new gap is not stuck at time to leave");

// ── the live clock (3D places): 1 game minute per 6 real seconds, sent in lumps, held at leave ──
const lc = new LiveClock(600, 610);
lc.tick(2); lc.tick(2); lc.tick(2);
check(Math.abs(lc.now() - 601) < 1e-9, `6 real seconds = 1 game minute (${lc.now()})`);
lc.paused = true; lc.tick(2);
check(Math.abs(lc.now() - 601) < 1e-9, "paused (a menu): no time passes");
lc.paused = false;
for (let i = 0; i < 100; i++) lc.tick(2);
check(lc.now() === 610 && lc.held, "the live clock holds at time to leave");
const sent = lc.flush(1);
check(sent >= 9, `its minutes are sent to the career (${sent})`);
lc.sync(600 + sent, 610);
check(lc.now() === 610, "when they land, the career's clock is the truth again");

// ── an old save with no clock loads and reads the default ──
const old = JSON.parse(JSON.stringify(a2)) as Record<string, unknown>;
delete old.clock;
const loaded = loadCareerFromStoredForm(old);
check(!!loaded, "an old save (no clock) loads");
if (loaded) check(clockOf(loaded).m === 9 * 60 && clockOf(loaded).d === 0, "and reads 09:00 day 0");
const withC = loadCareerFromStoredForm(JSON.parse(JSON.stringify(a2)));
check(!!withC && absOf(clockOf(withC!)) === absOf(clockOf(a2)), "a saved clock survives save and load");

if (problems.length) {
  console.error(`lifeClock: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`lifeClock: ok (day 0 ${hhmm(c0.m)}; first match day ${nx!.day} at ${hhmm(nx!.ko)}, leave ${hhmm(nx!.leave - nx!.day * DAY_MINS)}; sleep → 07:00; a gap after a match starts ${hhmm(ca.m)})`);
