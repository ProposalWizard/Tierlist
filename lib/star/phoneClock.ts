/**
 * THE PHONE'S CLOCK (Mikey, 22 Oct 2026: "the phone clock is wrong"). It read
 * the date off `career.week` as if every week were a league matchweek, so
 * with cup and European games in the list it ran weeks ahead of the next
 * match (12/12 on a phone whose next match was Sat 31 Oct). Today is the day
 * of the last game you played, read off that fixture's real date; before the
 * first game, the day before it.
 */
import type { CareerState } from "./types";
import { divisionOf, fixtureTimestamp, formatDateNumeric } from "./calendar";

const DAY = 86_400_000;

export function phoneToday(career: CareerState): Date {
  const div = divisionOf(career);
  const ts = (f: CareerState["fixtures"][number]) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  let last = -Infinity, next = Infinity;
  for (const f of career.fixtures ?? []) {
    const t = ts(f);
    if (f.played) last = Math.max(last, t); else next = Math.min(next, t);
  }
  if (last > -Infinity) return new Date(last);
  if (next < Infinity) return new Date(next - DAY);
  return new Date(Date.UTC(career.player.startYear + career.season - 1, 7, 1));
}

/** "28/10": the phone's status bar. */
export function phoneClockLabel(career: CareerState): string {
  return formatDateNumeric(phoneToday(career)).replace(/\/\d{2}$/, "");
}
