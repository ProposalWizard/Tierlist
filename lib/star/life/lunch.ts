/**
 * LUNCH AT THE TRAINING GROUND — the food hall, phase 1 (docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md section 3;
 * Harry, 19 Nov 2026, RUL-UI-013: "a training centre where u can actually interact with teammates in like a food
 * hall"). The phone card on the Training page (components/star/LunchCard.tsx); the 3D canteen comes later.
 * The plan's suggested answers are the defaults: F1 food does something small, next session only, sharing the
 * house and gym caps; F2 treats never hurt; F3 the short chat is free, only the long lunch costs a week thing.
 *
 *  - LUNCH IS 12:30 TO 14:00 on the career clock (life/clock.ts). Before 12:30 you can wait for it; never past
 *    time to leave for a match. Eating takes EAT_MINS clock minutes, the long lunch LONG_LUNCH_MINS more.
 *  - ONE PLATE A DAY (PLATES):
 *      protein   gym points ×1.1 for today's gym session (with the shake: never past ×1.2 together)
 *      pasta     +3 energy now
 *      balanced  +1 energy now, and gym points ×1.05 for today's gym session
 *      treat     mood +1
 *      skip      nothing (no penalty)
 *    Energy and mood come out of the HOUSE's daily caps (houseActs.ts: +3 energy, +3 mood a day, all things
 *    together), so food can never be farmed and Rest stays the way to recover.
 *    The gym part lasts for the next session only: exercises done after lunch, the same day. Tomorrow it is
 *    gone. It is read by gym/progress.ts gymExercise (lunchGymLift), which keeps the ×1.2 ceiling.
 *  - SIT WITH A TEAM-MATE (real squad players, `c.squad`): a short chat is free (a line, nothing else); a long
 *    lunch costs one of the week's 3 things and moves his bond a little through the people helpers
 *    (people.ts nudge + moveTeamFromPerson, as the Chat action does). One of each a day.
 *  - CLUB SIZE CHANGES ONLY THE WORDS: a tea urn in the National League and North/South, a counter in League
 *    One and Two, a canteen in the Championship, a chef in the Premier League (`hallOf`).
 *
 * Saved: `career.clock.lu`, one number of at most 4 digits (day × 100 + plate × 10 + table). Old saves have
 * none: no lunch yet today. Pure. Test: tests/star/lunch.mts.
 */
import type { CareerState } from "../types";
import { divisionOf } from "../calendar";
import { clockOf, absOf, leaveAt, passTime, hhmm, type SavedClock } from "./clock";
import { houseDay, HOUSE_ENERGY_CAP, HOUSE_MOOD_CAP, MOOD_MIN, MOOD_MAX } from "./houseActs";
import { freshLife, lifeWeek, meet, moveTeamFromPerson, nudge, remember } from "./people";
import type { LifeState } from "./types";

// director.ts's lifeOf/cloneLife, copied small so the gym (which reads lunchGymLift) never loads the event book
const lifeOf = (c: CareerState): LifeState => c.life ?? freshLife();
const cloneLife = (l: LifeState): LifeState => JSON.parse(JSON.stringify(l)) as LifeState;

export const LUNCH_FROM = 12 * 60 + 30;
export const LUNCH_UNTIL = 14 * 60;
export const EAT_MINS = 20;
export const LONG_LUNCH_MINS = 45;
/** The long lunch's bond nudge on the team-mate (before the people curve; the Chat action gives +1 to +3). */
export const LONG_LUNCH_BOND = 4;

export type Plate = "protein" | "pasta" | "balanced" | "treat" | "skip";
export const PLATES: Plate[] = ["protein", "pasta", "balanced", "treat", "skip"];
const CODE: Record<Plate, number> = { protein: 1, pasta: 2, balanced: 3, treat: 4, skip: 5 };
const OF_CODE: Record<number, Plate> = { 1: "protein", 2: "pasta", 3: "balanced", 4: "treat", 5: "skip" };

/** What each plate does. `gym`: today's gym points times this (the shake's ceiling still holds). */
export const PLATE_EFFECT: Record<Plate, { energy: number; mood: number; gym: number }> = {
  protein: { energy: 0, mood: 0, gym: 1.1 },
  pasta: { energy: 3, mood: 0, gym: 1 },
  balanced: { energy: 1, mood: 0, gym: 1.05 },
  treat: { energy: 0, mood: 1, gym: 1 },
  skip: { energy: 0, mood: 0, gym: 1 },
};
export const PLATE_NAME: Record<Plate, string> = { protein: "Protein", pasta: "Pasta", balanced: "Balanced", treat: "Treat", skip: "Skip lunch" };
export const PLATE_ICON: Record<Plate, string> = { protein: "🍗", pasta: "🍝", balanced: "🥗", treat: "🍰", skip: "⏭️" };
/** The card's one line: exactly what the plate does. */
export const PLATE_DOES: Record<Plate, string> = {
  protein: "Gym points ×1.1 in your next gym session",
  pasta: "+3 energy now",
  balanced: "+1 energy now · gym points ×1.05 next session",
  treat: "Mood +1",
  skip: "Nothing. No harm done",
};

// ── The hall: club size, words only ─────────────────────────────────────────

export type HallKind = "urn" | "counter" | "canteen" | "chef";
export interface Hall { kind: HallKind; title: string; line: string; icon: string; food: Record<Plate, string> }

/** The food hall at your club: a tea urn at the bottom, a chef at the top. Changes words only, never a plate. */
export function hallOf(c: Pick<CareerState, "division">): Hall {
  const d = divisionOf(c);
  if (d === "premier") return { kind: "chef", icon: "👨‍🍳", title: "The club restaurant", line: "The club chef is plating up.", food: { protein: "Grilled salmon, greens", pasta: "Fresh pasta, chef's sauce", balanced: "Chicken, rice and greens", treat: "Chef's chocolate fondant", skip: "Just a water" } };
  if (d === "championship") return { kind: "canteen", icon: "🍽️", title: "The canteen", line: "A proper canteen, trays and all.", food: { protein: "Chicken breast, eggs", pasta: "Pasta bake", balanced: "Chicken, rice and veg", treat: "Sticky toffee pudding", skip: "Just a water" } };
  if (d === "league_one" || d === "league_two") return { kind: "counter", icon: "🥪", title: "The counter", line: "Two dinner ladies and a small counter.", food: { protein: "Chicken and eggs", pasta: "Pasta and sauce", balanced: "Jacket potato and salad", treat: "A slice of cake", skip: "Just a water" } };
  return { kind: "urn", icon: "🫖", title: "The tea urn", line: "A tea urn and a tray of sandwiches in the clubhouse.", food: { protein: "Chicken sandwich", pasta: "Pasta salad tub", balanced: "Ham salad roll", treat: "A biscuit and a brew", skip: "Just a brew" } };
}

// ── Reading the save ────────────────────────────────────────────────────────

export interface LunchToday { plate: Plate; chatted: boolean; long: boolean }

/** What you have had today (null: nothing yet). Another day's record reads as nothing. */
export function lunchToday(c: CareerState): LunchToday | null {
  const s = clockOf(c);
  const lu = s.lu;
  if (lu === undefined || !Number.isFinite(lu) || Math.floor(lu / 100) !== s.d) return null;
  const plate = OF_CODE[Math.floor(lu / 10) % 10];
  if (!plate) return null;
  const t = lu % 10;
  return { plate, chatted: (t & 1) === 1, long: (t & 2) === 2 };
}

const pack = (d: number, l: LunchToday) => d * 100 + CODE[l.plate] * 10 + (l.chatted ? 1 : 0) + (l.long ? 2 : 0);

export type LunchStatus = "early" | "open" | "over" | "match";

/** Where lunch stands now: before 12:30, open, over for today, or no lunch (time to leave for a match first). */
export function lunchStatus(c: CareerState): LunchStatus {
  const s = clockOf(c);
  const now = absOf(s);
  const leave = leaveAt(c);
  const start = s.d * 1440 + LUNCH_FROM;
  if (s.m >= LUNCH_UNTIL) return "over";
  if (now >= leave || (s.m < LUNCH_FROM && start >= leave)) return "match";
  return s.m < LUNCH_FROM ? "early" : "open";
}

/**
 * The gym lift lunch gives the next gym session (1 = none): the plate's, on the day you ate it, after lunch.
 * gym/progress.ts multiplies it with the shake and caps the two at ×1.2.
 */
export function lunchGymLift(c: CareerState): number {
  const l = lunchToday(c);
  return l ? PLATE_EFFECT[l.plate].gym : 1;
}

// ── Doing it ────────────────────────────────────────────────────────────────

export interface LunchResult { career: CareerState; text: string; energy: number; mood: number }

/** Wait for lunch: the clock runs on to 12:30 (never past time to leave). */
export function waitForLunch(c: CareerState): CareerState {
  if (lunchStatus(c) !== "early") return c;
  const s = clockOf(c);
  return passTime(c, LUNCH_FROM - s.m);
}

function setClock(c: CareerState, s: SavedClock): CareerState {
  const clock = { ...s };
  if (clock.mo === undefined) delete clock.mo;
  return { ...c, clock };
}

/** Pick today's plate. A second plate does nothing ("You're full"). */
export function eatLunch(c: CareerState, plate: Plate): LunchResult {
  const had = lunchToday(c);
  if (had) return { career: c, text: had.plate === "skip" ? "You skipped lunch today. The kitchen's shut to you until tomorrow." : "You're full. One plate a day.", energy: 0, mood: 0 };
  const st = lunchStatus(c);
  if (st !== "open") return { career: c, text: st === "early" ? `Lunch is from ${hhmm(LUNCH_FROM)}.` : st === "over" ? "Lunch is over for today." : "No time for lunch: it's time to leave for the match.", energy: 0, mood: 0 };
  const eff = PLATE_EFFECT[plate];
  const s = houseDay(c);
  const te = s.te ?? 0, tm = s.tm ?? 0;
  const wantE = Math.max(0, Math.min(eff.energy, HOUSE_ENERGY_CAP - te));
  const energy = Math.max(0, Math.min(100, c.energy + wantE));
  const gotE = energy - c.energy;
  const wantM = Math.max(0, Math.min(eff.mood, HOUSE_MOOD_CAP - tm));
  const mo = Math.max(MOOD_MIN, Math.min(MOOD_MAX, (s.mo ?? 0) + wantM));
  const gotM = mo - (s.mo ?? 0);
  const clock: SavedClock = { ...s, te: te + gotE, tm: tm + gotM, mo: mo || undefined, lu: pack(s.d, { plate, chatted: false, long: false }) };
  let career = setClock({ ...c, energy }, clock);
  if (plate !== "skip") career = passTime(career, EAT_MINS);
  const notes: string[] = [];
  if (eff.energy > 0) {
    if (gotE <= 0 && c.energy >= 100) notes.push("Your energy is already full.");
    else if (gotE <= 0) notes.push(`No energy from it: food and the house give ${HOUSE_ENERGY_CAP} a day, and you've had them.`);
    else notes.push(gotE < eff.energy && wantE < eff.energy ? `Energy +${gotE} (that's the day's ${HOUSE_ENERGY_CAP} from food and the house).` : `Energy +${gotE}.`);
  }
  if (eff.mood > 0) notes.push(gotM > 0 ? `Mood +${gotM}.` : `No mood from it: food and the house give ${HOUSE_MOOD_CAP} a day, and you've had them.`);
  if (eff.gym > 1) notes.push(`Gym points ×${eff.gym} in your next gym session today.`);
  const text = plate === "skip" ? "You skip lunch. Nothing changes." : [`${PLATE_NAME[plate]}.`, ...notes].join(" ");
  return { career, text, energy: gotE, mood: gotM };
}

// ── The table ───────────────────────────────────────────────────────────────

export interface LunchMate { id: string; name: string; short: string; bond: number }

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };

/** Who is eating today: three real team-mates, your closest first, the rest by the day (the same all day). */
export function lunchMates(c: CareerState, n = 3): LunchMate[] {
  const squad = (c.squad ?? []).filter((p) => p.id && p.name);
  if (!squad.length) return [];
  const people = c.life?.people ?? {};
  const day = clockOf(c).d;
  const seed = `${c.season}:${c.week}:${day}`;
  const bond = (id: string) => people[id]?.b ?? 30;
  const best = [...squad].sort((a, b) => bond(b.id) - bond(a.id))[0];
  const rest = squad.filter((p) => p.id !== best.id).sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
  const pick = (bond(best.id) > 30 ? [best, ...rest] : [...rest]).slice(0, n);
  return pick.map((p) => ({ id: p.id, name: p.name, short: p.shortName || p.name.split(" ").slice(-1)[0], bond: bond(p.id) }));
}

/** Short chat lines over lunch (invented; {name} is the team-mate). Free: a line and nothing else. */
export const CHAT_LINES = [
  "{name} reckons the gaffer's got a new drill for this afternoon. Nobody's looking forward to it.",
  "{name} is telling the table about his dog eating a whole box of boots.",
  "{name} wants to know if you've seen the fixtures. \"Brutal month, that.\"",
  "{name} nicks a chip off your plate and acts like it never happened.",
  "{name} is arguing that crossbar challenge should count as training.",
  "{name} asks where you get your haircut. You don't tell him.",
  "{name} says the physio's music in the treatment room is a crime.",
  "{name}: \"Did you see that finish yesterday? Mine, I mean.\"",
  "{name} is trying to start a quiz. Nobody knows the answers.",
  "{name} has opinions on the new away kit. Strong ones.",
  "{name} shows you a video of his little lad scoring in the park.",
  "{name} says the kit man has been in a mood all week.",
];
/** Words for the long lunch (invented). */
export const LONG_LINES = [
  "You and {name} stay on long after the trays have gone. He tells you about growing up, the trials he failed, the coach who kept him going.",
  "A long one with {name}. Football first, then everything else. You leave knowing him a lot better.",
  "{name} opens up about how hard the move here was for his family. You listen. It means something to him.",
  "You and {name} talk through the next match, then his plans for after football. Proper chat.",
];

function lineFor(list: string[], seed: string, name: string): string {
  return list[hash(seed) % list.length].replace(/\{name\}/g, name);
}

/** Why you can't sit with him like this now (null = you can). */
export function tableBlocked(c: CareerState, kind: "chat" | "long"): string | null {
  const l = lunchToday(c);
  if (!l) return lunchStatus(c) === "open" ? "Pick a plate first" : "Lunch is from 12:30";
  if (l.plate === "skip") return "You skipped lunch today";
  if (kind === "chat") return l.chatted ? "You've had your chat today" : null;
  if (l.long) return "You've had a long lunch today";
  if ((c.weekActions ?? 3) <= 0) return "None of this week's 3 things left";
  if (absOf(clockOf(c)) + LONG_LUNCH_MINS > leaveAt(c)) return "No time: you leave for the match soon";
  return null;
}

/** A short chat at his table: free. A line, nothing else. */
export function lunchChat(c: CareerState, mate: LunchMate): { career: CareerState; line: string } | null {
  if (tableBlocked(c, "chat")) return null;
  const s = clockOf(c), l = lunchToday(c)!;
  const line = lineFor(CHAT_LINES, `${c.season}:${c.week}:${s.d}:${mate.id}`, mate.short);
  return { career: setClock(c, { ...s, lu: pack(s.d, { ...l, chatted: true }) }), line };
}

/**
 * A long lunch with him: one of the week's 3 things and LONG_LUNCH_MINS on the clock. His bond moves a little
 * (people.ts nudge, the same curve as the Chat action), and through him the team (moveTeamFromPerson).
 */
export function longLunch(c0: CareerState, mate: LunchMate): { career: CareerState; line: string; bond: number; team: number } | null {
  if (tableBlocked(c0, "long")) return null;
  const s = clockOf(c0), l = lunchToday(c0)!;
  let c: CareerState = setClock({ ...c0, weekActions: Math.max(0, (c0.weekActions ?? 3) - 1) }, { ...s, lu: pack(s.d, { ...l, long: true }) });
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  const p = meet(life, mate.id, now, mate.name);
  const bond = nudge(p, "b", LONG_LUNCH_BOND);
  p.m = remember(p.m, "long-lunch", now, 1);
  const tm = moveTeamFromPerson(life, mate.id, bond);
  const line = lineFor(LONG_LINES, `${c.season}:${c.week}:${s.d}:${mate.id}:long`, mate.short);
  life.log = [...life.log, { w: now, e: "lunch", c: mate.id, t: line.slice(0, 140) }].slice(-12);
  c = { ...c, life };
  let team = 0;
  if (tm.team) {
    const t = Math.max(0, Math.min(100, c.relationships.team + tm.team));
    team = t - c.relationships.team;
    c = { ...c, relationships: { ...c.relationships, team: t } };
  }
  return { career: passTime(c, LONG_LUNCH_MINS), line, bond, team };
}
