/**
 * THINGS IN THE HOUSE DO SOMETHING (plan section 5b and phase 3; Harry, 27 Nov 2026: "how actions
 * affect things"). The house's things (home3d/livingRooms.ts) said "Energy +1" or "Mood +1" on their
 * card, but nothing in the game changed. Now using one:
 *   - costs game minutes (the clock moves: ACT_MINS),
 *   - gives the career's real energy (career.energy, the same number Rest and matches use) and your
 *     mood (career.clock.mo, -10..+10, drifting back to 0 a point a day),
 *   - but only up to a DAILY CAP, so nothing can be farmed and Rest stays the way to recover
 *     (Harry's question 2: the week's 3 things stay; house things are small extras):
 *       energy from house things: at most +3 a day, all things together (HOUSE_ENERGY_CAP),
 *       mood from house things: at most +3 a day (HOUSE_MOOD_CAP),
 *       coffee: the 3rd a day gives nothing; the 5th makes you jittery (mood -1),
 *       each other thing gives its effect once a day (the 2nd go is just for fun).
 * The day's counters ride on the clock (`td`, `te`, `tm`, `tu`): a few bytes. Pure.
 * Test: tests/star/houseActs.mts.
 */
import type { CareerState } from "../types";
import { clockOf, dayNumber, hhmm, passTime, absOf, type SavedClock } from "./clock";

export const HOUSE_ENERGY_CAP = 3;
export const HOUSE_MOOD_CAP = 3;
/** Coffee: the cup that gives nothing, and the cup that makes you jittery. */
export const COFFEE_FLAT = 3;
export const COFFEE_JITTERY = 5;
export const MOOD_MIN = -10;
export const MOOD_MAX = 10;

/** Game minutes each thing takes (the plan: coffee 10, shower 15…). Others: DEFAULT_MINS. */
export const ACT_MINS: Record<string, number> = {
  fridge: 5, coffee: 10, shower: 15, bath: 30, mirror: 5, treadmill: 30, mat: 15,
  pool: 20, darts: 15, arcade: 15, lounger1: 30, lounger2: 30, seatsL: 120, seatsR: 120, cabinet: 5,
};
export const DEFAULT_MINS = 10;

export interface ActResult {
  career: CareerState;
  /** The card's line: what it did, in words ("Energy +1", or why not). */
  text: string;
  /** "10 minutes later · 14:30". */
  sub: string;
  mins: number;
  energy: number;
  mood: number;
}

/** The thing's own words without its old promise ("Fresh coffee. Energy +1" → "Fresh coffee."). */
export function plainWords(text: string | undefined): string {
  const t = (text ?? "").replace(/\s*(Energy|Mood|Fitness)\s*[+-]\d+.*$/i, "").trim();
  return t || "Done.";
}

/** The day's counters, reset on a new day (and the mood drifts towards 0 a point per day passed). */
function today(c: CareerState): SavedClock & { td: number } {
  const s = clockOf(c);
  const day = dayNumber(c, s.d);
  if (s.td === day) return { ...s, td: day };
  const passed = s.td === undefined ? 0 : Math.max(0, day - s.td);
  const mo = s.mo ?? 0;
  const drift = Math.sign(mo) * Math.max(0, Math.abs(mo) - passed);
  return { ...s, td: day, te: 0, tm: 0, tu: {}, mo: drift || undefined };
}

/** Your mood now (-10..+10), after the drift. */
export function moodOf(c: CareerState): number {
  return today(c).mo ?? 0;
}

/**
 * Use a thing: its time, then its effect within the day's caps. `effect` is the thing's own
 * (livingRooms.ts `effect`: energy/mood and its words).
 */
export function applyThing(c: CareerState, id: string, effect: { energy?: number; mood?: number; text?: string } = {}): ActResult {
  const mins = ACT_MINS[id] ?? DEFAULT_MINS;
  const s = today(c);
  const uses = (s.tu?.[id] ?? 0) + 1;
  let wantE = effect.energy ?? 0, wantM = effect.mood ?? 0;
  const notes: string[] = [];
  if (id === "coffee") {
    if (uses >= COFFEE_FLAT) { wantE = 0; if (uses < COFFEE_JITTERY) notes.push("Your third coffee today. It does nothing now."); }
    if (uses >= COFFEE_JITTERY) { wantM = -1; notes.push("Too much coffee. You feel jittery."); }
  } else if (uses > 1) {
    // a second go at the same thing: fun, no more effect today (a run still tires you)
    if (wantE > 0) wantE = 0;
    if (wantM > 0) wantM = 0;
    if ((effect.energy ?? 0) > 0 || (effect.mood ?? 0) > 0) notes.push("You've already done this today. No more from it until tomorrow.");
  }
  const te = s.te ?? 0, tm = s.tm ?? 0;
  const gainE = wantE > 0 ? Math.max(0, Math.min(wantE, HOUSE_ENERGY_CAP - te)) : wantE;
  const gainM = wantM > 0 ? Math.max(0, Math.min(wantM, HOUSE_MOOD_CAP - tm)) : wantM;
  if (wantE > 0 && gainE < wantE) notes.push(`That's all the energy the house gives today (${HOUSE_ENERGY_CAP} of ${HOUSE_ENERGY_CAP}).`);
  if (wantM > 0 && gainM < wantM && wantE <= 0) notes.push(`You're as cheerful as the house can make you today.`);
  const energy = Math.max(0, Math.min(100, c.energy + gainE));
  const realE = energy - c.energy;
  const mo = Math.max(MOOD_MIN, Math.min(MOOD_MAX, (s.mo ?? 0) + gainM));
  const realM = mo - (s.mo ?? 0);
  const clock: SavedClock = { ...s, te: te + Math.max(0, realE), tm: tm + Math.max(0, realM), tu: { ...(s.tu ?? {}), [id]: uses }, mo: mo || undefined };
  if (clock.mo === undefined) delete clock.mo;
  const spent = passTime({ ...c, energy, clock }, mins);
  const passed = absOf(clockOf(spent)) - absOf(clock);
  const gains = [realE ? `Energy ${realE > 0 ? "+" : ""}${realE}` : "", realM ? `Mood ${realM > 0 ? "+" : ""}${realM}` : ""].filter(Boolean).join(" · ");
  const words = plainWords(effect.text);
  const text = [words, gains, ...notes].filter(Boolean).join(" ");
  const sub = passed > 0 ? `${passed} minutes later · ${hhmm(clockOf(spent).m)}` : `${hhmm(clockOf(spent).m)} · time to leave for the match`;
  return { career: spent, text, sub, mins: passed, energy: realE, mood: realM };
}
