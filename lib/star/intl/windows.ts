/**
 * THE INTERNATIONAL WINDOWS — when national teams play.
 *
 * FIFA International Match Calendar 2026-2030 (Wikipedia, "FIFA International
 * Match Calendar", read 12 Oct 2026). From 2026 the September and October
 * breaks are one double window of four matches:
 *
 *   Sep–Oct  4 matches   e.g. 20 Sep – 5 Oct 2027
 *   November 2 matches   e.g.  8 – 16 Nov 2027
 *   March    2 matches   e.g. 22 – 30 Mar 2027
 *   June     2 matches   e.g.  7 – 15 Jun 2027 (after the club season)
 *
 * After 2030 there are no published dates, so the same pattern repeats: each
 * window opens on the Monday in the same week of the year it did in
 * 2027-2030 (Sep 18-24, Nov 8-14, Mar 18-24, Jun 1-7).
 *
 * Matchdays inside a window: a two-match window plays Thursday and Sunday of
 * its first week; the double window plays Thursday and Sunday of both weeks.
 *
 * Imports nothing, so calendar.ts can use it to leave the Premier League's
 * and the Championship's break weekends empty.
 */

export type WindowKind = "sepoct" | "nov" | "mar" | "jun";

export interface IntlWindow {
  kind: WindowKind;
  /** Calendar year it falls in. */
  year: number;
  /** First and last day (UTC dates). */
  start: Date;
  end: Date;
  /** The matchday dates, in order. */
  matchdays: Date[];
}

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Real FIFA windows, [month, day] of the opening Monday and the length in days. */
const REAL: Record<number, Partial<Record<WindowKind, [number, number, number]>>> = {
  2026: { sepoct: [9, 21, 16], nov: [11, 9, 9] },
  2027: { mar: [3, 22, 9], jun: [6, 7, 9], sepoct: [9, 20, 16], nov: [11, 8, 9] },
  2028: { mar: [3, 20, 9], jun: [5, 29, 9], sepoct: [9, 18, 16], nov: [11, 13, 9] },
  2029: { mar: [3, 19, 9], jun: [6, 4, 9], sepoct: [9, 24, 16], nov: [11, 12, 9] },
  2030: { mar: [3, 18, 9], jun: [6, 3, 9], sepoct: [9, 23, 16], nov: [11, 11, 9] },
};

/** For years past 2030: the Monday on or after this date, and the length. */
const RULE: Record<WindowKind, [number, number, number]> = {
  mar: [3, 18, 9], jun: [6, 1, 9], sepoct: [9, 18, 16], nov: [11, 8, 9],
};

function mondayOnOrAfter(d: Date): Date {
  return new Date(d.getTime() + ((1 - d.getUTCDay() + 7) % 7) * DAY);
}

export function windowFor(year: number, kind: WindowKind): IntlWindow | null {
  if (year < 2026 || (year === 2026 && (kind === "mar" || kind === "jun"))) return null;
  const real = REAL[year]?.[kind];
  const start = real ? utc(year, real[0], real[1]) : mondayOnOrAfter(utc(year, RULE[kind][0], RULE[kind][1]));
  const len = real ? real[2] : RULE[kind][2];
  const end = new Date(start.getTime() + (len - 1) * DAY);
  const offsets = kind === "sepoct" ? [3, 6, 10, 13] : [3, 6];
  return { kind, year, start, end, matchdays: offsets.map((o) => new Date(start.getTime() + o * DAY)) };
}

/**
 * The windows that fall inside one club season (August of `year` to July of
 * `year + 1`), in date order: Sep–Oct and November of the first year, March
 * and June of the second.
 */
export function seasonWindows(seasonStartYear: number): IntlWindow[] {
  return [
    windowFor(seasonStartYear, "sepoct"),
    windowFor(seasonStartYear, "nov"),
    windowFor(seasonStartYear + 1, "mar"),
    windowFor(seasonStartYear + 1, "jun"),
  ].filter((w): w is IntlWindow => !!w);
}

/**
 * The Saturdays of one club season that fall inside an international window
 * (the June window is after the season). The Premier League and the
 * Championship leave these empty; League One and below play on.
 */
export function breakSaturdays(seasonStartYear: number): number[] {
  const out: number[] = [];
  for (const w of seasonWindows(seasonStartYear)) {
    if (w.kind === "jun") continue;
    for (let t = w.start.getTime(); t <= w.end.getTime(); t += DAY) {
      if (new Date(t).getUTCDay() === 6) out.push(t);
    }
  }
  return out;
}
