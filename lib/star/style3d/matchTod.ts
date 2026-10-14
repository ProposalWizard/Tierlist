/**
 * WHAT TIME OF DAY A CAREER MATCH IS PLAYED AT, IN 3D (Harry, 13 Oct 2026: "Can we use the different
 * day times aswell to not always have a shadow? Like what happened to the golden hour feel").
 *
 * Every 3D career match used to be golden hour, whose low sun throws the stand's long shadow over the
 * goal end every time. Now each fixture gets its own kick-off light, seeded from the season and week
 * (the same match always looks the same): about half afternoon (a high sun, short shadows), a third
 * golden hour, the rest a night match under floodlights.
 *
 * Not a three.js file: the career page imports it.
 */
import type { TimeOfDay } from "./real/assets";

export const MATCH_TOD_SHARE: Readonly<Record<TimeOfDay, number>> = { day: 0.5, golden: 0.32, night: 0.18 };

export function matchTodFor(season: number, week: number, homeCity = ""): TimeOfDay {
  // mulberry32, the game's own seeded dice, on a seed apart from the weather's
  let a = (season * 92821 + week * 6151 + homeCity.length * 389 + 0x5bd1e995) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  if (r < MATCH_TOD_SHARE.day) return "day";
  if (r < MATCH_TOD_SHARE.day + MATCH_TOD_SHARE.golden) return "golden";
  return "night";
}
