/**
 * THE CAREER CLOCK (docs/plans/PEOPLE_AND_MEMORY_PLAN.md section 2; Harry, 27 Nov 2026: "there should
 * also be a time of day either on the phone or somewhere on screen").
 *
 * One time of day for the whole career, between matches: a DAY and a MINUTE. Day 0 is the phone's
 * "today" (lib/star/phoneClock.ts `phoneToday`: the day of the last match you played, or the day
 * before the first one). The clock is saved on the career as `career.clock` (about 20 bytes:
 * `{ k, d, m }`). `k` says which gap between matches it belongs to; after the next match it no longer
 * matches and the clock starts again in the evening of that match (home by 19:00 after a 15:00 game,
 * 23:00 after a night game). Old saves have no clock: they read the same default. Nothing here moves
 * a fixture: the season's calendar still only turns when a match is played.
 *
 *  - Doing something costs minutes (`passTime`). The week's 3 things cost half a day each
 *    (`WEEK_THING_MINS`, week.ts `spendAction`).
 *  - Sleep jumps to 07:00 the next day (`sleepClock`).
 *  - The clock never passes TIME TO LEAVE: kick-off minus 2 h 30 on match day (`leaveAt`). There a
 *    "Go to the match" button shows (components/star/ClockPill.tsx). You can never sleep past a match.
 *
 * Harry's 5 questions are not answered yet (28 Nov 2026): the plan's recommended answers are the
 * defaults, each ONE named setting below. Pure: no React, no three.js. Test: tests/star/lifeClock.mts.
 */
import type { CareerState, Fixture } from "../types";
import { divisionOf, fixtureTimestamp } from "../calendar";
import { kickoffHour, formatKickoff } from "../kickoff";
import { phoneToday } from "../phoneClock";

// ── Harry's questions: the defaults (change one line) ─────────────────────

/** Q1: in a 3D place the clock moves by itself, 1 game minute every this many REAL seconds. Menus stop it. */
export const REAL_SECS_PER_GAME_MIN = 6;
/** Q2: the week's 3 things stay. Each one also costs this many game minutes (half a day). */
export const WEEK_THING_MINS = 240;
/** Q4: on match day the clock stops this many minutes before kick-off, with a "Go to the match" button. */
export const LEAVE_BEFORE_KICKOFF = 150;
/** Sleep wakes you at this minute of the day (07:00). */
export const WAKE_AT = 7 * 60;

export const DAY_MINS = 24 * 60;
const DAY_MS = 86_400_000;

/** What the career saves (all short keys: it rides on every save). */
export interface SavedClock {
  /** Which gap between matches this clock is for (`gapKey`). */
  k: number;
  /** Days since day 0 (the phone's today). */
  d: number;
  /** Minute of the day, 0..1439. */
  m: number;
  /** Phase 3: the day the house counters below belong to (absolute day, see `dayNumber`). */
  td?: number;
  /** Phase 3: energy the house things gave today. */
  te?: number;
  /** Phase 3: mood the house things gave today. */
  tm?: number;
  /** Phase 3: uses of each thing today. */
  tu?: Record<string, number>;
  /** Phase 3: your mood, -10..+10 (drifts back to 0, a point a day). */
  mo?: number;
  /** Phase 2: a team-mate you texted "come round?": [absolute day, minute he comes, his id, said yes 1/0]. */
  inv?: [number, number, string, number];
}

/** Which gap between matches the career is in: the season and how many fixtures are played. */
export function gapKey(c: Pick<CareerState, "season" | "fixtures">): number {
  let n = 0;
  for (const f of c.fixtures ?? []) if (f.played) n++;
  return (c.season ?? 1) * 1000 + n;
}

function ts(c: CareerState, f: Fixture): number {
  return fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, divisionOf(c));
}
/** A fixture's kick-off, in minutes of its day (the same seed as kickoff.ts `homeSkyFor`). */
export function kickoffMins(c: CareerState, f: Fixture): number {
  const t = ts(c, f);
  if (!Number.isFinite(t)) return 15 * 60;
  return Math.round(kickoffHour(new Date(t), `${c.season}:${f.week}:${f.kind ?? "league"}:${f.opponent}`) * 60);
}

function lastPlayed(c: CareerState): Fixture | null {
  let best: Fixture | null = null, bt = -Infinity;
  for (const f of c.fixtures ?? []) { if (!f.played) continue; const t = ts(c, f); if (t > bt) { bt = t; best = f; } }
  return best;
}
function nextMatch(c: CareerState): Fixture | null {
  let best: Fixture | null = null, bt = Infinity;
  for (const f of c.fixtures ?? []) { if (f.played) continue; const t = ts(c, f); if (t < bt) { bt = t; best = f; } }
  return best;
}

/** Day 0 of this gap, as a time stamp (midnight of the phone's today). */
export function day0(c: CareerState): number {
  const d = phoneToday(c);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The clock when a gap starts: the evening of the last match, or 09:00 the day before the first one. */
export function freshClock(c: CareerState): SavedClock {
  const last = lastPlayed(c);
  const m = last ? Math.min(23 * 60, kickoffMins(c, last) + 240) : 9 * 60;
  return { k: gapKey(c), d: 0, m };
}

/** The clock now (the saved one when it is for this gap, else a fresh one). Never undefined. */
export function clockOf(c: CareerState): SavedClock {
  const s = c.clock;
  if (s && s.k === gapKey(c) && Number.isFinite(s.d) && Number.isFinite(s.m)) return s;
  // a new gap: the time starts again; the day's counters and the mood carry over (`td` tells which day they are)
  return { ...freshClock(c), ...(s ? { td: s.td, te: s.te, tm: s.tm, tu: s.tu, mo: s.mo, inv: s.inv } : null) };
}

/** Minutes since day 0's midnight. */
export const absOf = (s: Pick<SavedClock, "d" | "m">) => s.d * DAY_MINS + s.m;
const fromAbs = (s: SavedClock, abs: number): SavedClock => ({ ...s, d: Math.floor(abs / DAY_MINS), m: Math.round(abs - Math.floor(abs / DAY_MINS) * DAY_MINS) });

/** The next match, its day (0 = day 0) and its kick-off minute, or null (season over). */
export function nextMatchInfo(c: CareerState): { f: Fixture; day: number; ko: number; leave: number } | null {
  const f = nextMatch(c);
  if (!f) return null;
  const t = ts(c, f);
  if (!Number.isFinite(t)) return null;
  const when = new Date(t);
  const day = Math.round((new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() - day0(c)) / DAY_MS);
  const ko = kickoffMins(c, f);
  return { f, day, ko, leave: day * DAY_MINS + ko - LEAVE_BEFORE_KICKOFF };
}

/** Time to leave for the next match (minutes since day 0), or Infinity. The clock never passes it. */
export function leaveAt(c: CareerState): number {
  return nextMatchInfo(c)?.leave ?? Infinity;
}

/** Is it time to leave for the match (the clock has stopped)? */
export function timeToLeave(c: CareerState): boolean {
  return absOf(clockOf(c)) >= leaveAt(c);
}

/** A career with its clock set (same object back when nothing changed). */
function withClock(c: CareerState, s: SavedClock): CareerState {
  const o = c.clock;
  if (o && o.k === s.k && o.d === s.d && o.m === s.m && o.td === s.td && o.te === s.te && o.mo === s.mo && o.tu === s.tu && o.inv === s.inv) return c;
  return { ...c, clock: s };
}

/** `mins` pass (an action, a walk round the house). Stops at time to leave. */
export function passTime(c: CareerState, mins: number): CareerState {
  if (!(mins > 0)) return c;
  const s = clockOf(c);
  const now = absOf(s);
  const to = Math.max(now, Math.min(now + mins, leaveAt(c)));
  return withClock(c, fromAbs(s, to));
}

/** The minute you wake after sleeping now: 07:00 the next morning (or this morning, after midnight), never past time to leave. */
export function wakeAbs(c: CareerState): number {
  const s = clockOf(c);
  const now = absOf(s);
  const wake = s.m < WAKE_AT - 60 ? s.d * DAY_MINS + WAKE_AT : (s.d + 1) * DAY_MINS + WAKE_AT;
  return Math.max(now, Math.min(wake, leaveAt(c)));
}

/**
 * A night's sleep on the clock: 07:00 the next day. `after` is the career once the night's energy is
 * done (home3d/sleep.ts `sleepNight`); the clock is read from `before` (Rest also spends a week's
 * thing, which costs half a day: the night must not count that twice).
 */
export function sleepClock(before: CareerState, after: CareerState = before): CareerState {
  const s = clockOf(before);
  return withClock(after, fromAbs({ ...s, k: gapKey(after) }, wakeAbs(before)));
}

// ── Labels ─────────────────────────────────────────────────────────────

/** "14:20". */
export function hhmm(minOfDay: number): string {
  const m = ((Math.floor(minOfDay) % DAY_MINS) + DAY_MINS) % DAY_MINS;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The calendar date of day `d` of this gap. */
export function dateOf(c: CareerState, d: number): Date {
  const z = new Date(day0(c));
  return new Date(z.getFullYear(), z.getMonth(), z.getDate() + d);
}
/** A day number that never repeats (days since 1 Jan 2000), for seeds and the day's counters. */
export function dayNumber(c: CareerState, d: number): number {
  return Math.round((dateOf(c, d).getTime() - new Date(2000, 0, 1).getTime()) / DAY_MS);
}

/** "Tue 3 Nov". */
export function shortDate(dt: Date): string { return `${WD[dt.getDay()]} ${dt.getDate()} ${MON[dt.getMonth()]}`; }
/** "Tuesday 3 November". */
export function longDate(dt: Date): string { return `${WD_LONG[dt.getDay()]} ${dt.getDate()} ${MON_LONG[dt.getMonth()]}`; }

/** The line under the clock: "Tue 3 Nov · Match tomorrow" (abs = the minute shown, for a ticking clock). */
export function clockSubline(c: CareerState, abs = absOf(clockOf(c))): string {
  const d = Math.floor(abs / DAY_MINS);
  const nx = nextMatchInfo(c);
  let tail = "";
  if (nx) {
    const left = nx.day - d;
    if (abs >= nx.leave) tail = "Time to leave";
    else if (left === 0) tail = `Match today ${formatKickoff(nx.ko / 60)}`;
    else if (left === 1) tail = "Match tomorrow";
    else tail = `Match in ${left} days`;
  }
  return `${shortDate(dateOf(c, d))}${tail ? ` · ${tail}` : ""}`;
}

export interface TodayRow { when: string; what: string; sub?: string; now?: boolean }

/**
 * The Today and next list (the phone's lock screen, the clock pill's drop-down): now, who is
 * coming today (phase 2 fills `visits`), and when to leave for the match.
 */
export function todayList(c: CareerState, abs = absOf(clockOf(c)), visits: { from: number; name: string; why: string }[] = []): TodayRow[] {
  const d = Math.floor(abs / DAY_MINS), m = abs - d * DAY_MINS;
  const nx = nextMatchInfo(c);
  const rows: TodayRow[] = [];
  const part = m < 12 * 60 ? "morning" : m < 18 * 60 ? "afternoon" : "evening";
  const leaving = nx && abs >= nx.leave;
  rows.push({ when: "Now", now: true, what: leaving ? "Time to leave for the match" : nx && nx.day === d ? `Match day ${part}` : `Free ${part}`, sub: leaving ? "Everything else waits" : `${c.weekActions ?? 3} of this week's 3 things left` });
  for (const v of visits) if (v.from > m) rows.push({ when: hhmm(v.from), what: v.name, sub: v.why });
  if (nx) {
    const dt = dateOf(c, nx.day);
    const home = nx.f.home ? "home" : "away";
    rows.push({ when: nx.day === d ? hhmm(nx.ko) : `${WD[dt.getDay()]} ${hhmm(nx.ko)}`, what: `${nx.f.opponent} (${home})`, sub: `Leave the house by ${hhmm(nx.leave - nx.day * DAY_MINS)}` });
  }
  return rows;
}
