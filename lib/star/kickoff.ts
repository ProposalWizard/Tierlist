/**
 * KICK-OFF TIME — and the sky behind Home's goal that goes with it (Harry,
 * 1 Oct 2026: "behind the goal should be stands, maybe flood lights if it's a
 * night game, then the sky"; asked to "switch by kick-off time", sunset
 * being his favourite).
 *
 * The game had no clock of its own, only a date per fixture (calendar.ts).
 * This gives each fixture a real English kick-off slot off its day of the
 * week, then reads the light at that hour in that month:
 *   - weekdays (cup and Europe nights): 19:45 or 20:00, always under lights
 *   - Saturday: 12:30, 15:00 (most often) or 17:30
 *   - Sunday: 14:00 or 16:30
 * The slot is seeded off the fixture, so the same match always has the same
 * time.
 *
 * SUNSET IS THE BASE PICTURE (Harry, 2 Oct 2026, v0.24 P1-18: "this sunset
 * one for now should be the base image, even if it's not night time. And
 * then if it's like a morning game, then obviously change it, just because
 * it looks the best"). So:
 *   - a kick-off before 13:00 (the Saturday 12:30) is "day";
 *   - a game played after dark (the middle of the first half more than about
 *     45 minutes after sunset) is "night", under lights;
 *   - everything else is "sunset". Before v0.24 a 15:00 in August was "day".
 */
import type { CareerState, Fixture } from "./types";
import { divisionOf, fixtureTimestamp } from "./calendar";

export type HomeSky = "day" | "sunset" | "night";

/** Rough UK sunset, local clock time in hours, by month (Jan = 0). */
const UK_SUNSET = [16.4, 17.3, 18.2, 19.9, 20.7, 21.3, 21.1, 20.3, 19.2, 18.1, 16.4, 15.9];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Kick-off as hours (19.75 = 19:45) for a fixture on this date. */
export function kickoffHour(date: Date, seedKey: string): number {
  const day = date.getDay(); // 0 Sun … 6 Sat
  const r = (hash(seedKey) % 1000) / 1000;
  if (day === 6) return r < 0.15 ? 12.5 : r < 0.8 ? 15 : 17.5;
  if (day === 0) return r < 0.5 ? 14 : 16.5;
  return r < 0.5 ? 19.75 : 20;
}

/** Kick-offs before this hour are morning games: the day sky. */
export const MORNING_BEFORE = 13;

/** Which sky a kick-off at `hour` in this month is played under. */
export function skyAt(month: number, hour: number): HomeSky {
  if (hour < MORNING_BEFORE) return "day";
  const mid = hour + 0.4; // the middle of the first half
  const sunset = UK_SUNSET[((month % 12) + 12) % 12];
  if (mid >= sunset + 0.75) return "night";
  return "sunset";
}

/** "19:45" */
export function formatKickoff(hour: number): string {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The sky behind Home's goal for the next match (sunset, the base picture,
 *  with nothing to play). */
export function homeSkyFor(career: CareerState, next: Fixture | null): HomeSky {
  if (!next) return "sunset";
  const ts = fixtureTimestamp(career.player.startYear, career.season, next.week, next.kind, divisionOf(career));
  if (!Number.isFinite(ts)) return "sunset";
  const date = new Date(ts);
  const hour = kickoffHour(date, `${career.season}:${next.week}:${next.kind ?? "league"}:${next.opponent}`);
  return skyAt(date.getMonth(), hour);
}
