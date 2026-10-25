/**
 * lib/teamRoom/status.ts — little profiles with live status (plan U0.2, T2;
 * Harry, 25 Oct 2026). Pure: no React, no database; tested in
 * tests/star/teamRoomStatus.mts.
 *
 *   Presence   green = the room is open and used in the last 10 minutes
 *              (Slack's rule); empty ring = idle 10 min, the tab hidden or
 *              closed; red with a bar = do not disturb (buzzes paused);
 *              amber = busy on a schedule ("back at 5").
 *   Status     an emoji and a few words ("🎬 filming clips") with "clear
 *              after": 1 hour, today, this week or never.
 *   Schedules  a repeating status ("🎓 Uni · 9–5 weekdays") that turns itself
 *              on and off at those times, in the setter's own time zone.
 *              While it is on your name says "back at 5" and (unless you
 *              switch it off) buzzes wait.
 *
 * Saved in team_status (team_room_v4.sql), one row per person, written only
 * by that person.
 */
import type { TeamPerson } from "./config";

/** Days are Monday = 0 … Sunday = 6. Times "HH:MM", 24-hour. */
export interface Schedule { id: string; emoji: string; text: string; days: number[]; from: string; to: string; pause: boolean }

export interface StatusRow {
  person: TeamPerson;
  emoji: string | null;
  text: string | null;
  clear_at: string | null;
  dnd_until: string | null;
  schedules: Schedule[];
  /** The setter's time zone ("Europe/London"): schedules run on their clock. */
  tz: string | null;
  updated_at: string;
}

export type Presence = "active" | "away" | "dnd" | "busy";

/** Slack's rule: away after 10 minutes without a key, a tap or the mouse. */
export const AWAY_AFTER_MS = 10 * 60_000;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isHhmm = (s: unknown): s is string => typeof s === "string" && HHMM.test(s);
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A schedule as saved, cleaned (anything odd is left out; never throws). */
export function cleanSchedules(raw: unknown): Schedule[] {
  if (!Array.isArray(raw)) return [];
  const out: Schedule[] = [];
  for (const r of raw.slice(0, 8)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const days = Array.isArray(x.days) ? Array.from(new Set(x.days.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))).sort() : [];
    if (!days.length || !isHhmm(x.from) || !isHhmm(x.to) || x.from === x.to) continue;
    out.push({
      id: typeof x.id === "string" && x.id ? x.id.slice(0, 20) : `s${out.length + 1}`,
      emoji: typeof x.emoji === "string" ? x.emoji.slice(0, 8) : "",
      text: typeof x.text === "string" ? x.text.slice(0, 60) : "",
      days, from: x.from, to: x.to, pause: x.pause !== false,
    });
  }
  return out;
}

/** The weekday (Mon = 0) and minute of the day at `now` in time zone `tz` (the viewer's own zone if none or unknown). */
export function clockIn(now: Date, tz: string | null): { day: number; min: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || undefined, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
    return { day: day < 0 ? 0 : day, min: Number(get("hour")) * 60 + Number(get("minute")) };
  } catch {
    return { day: (now.getDay() + 6) % 7, min: now.getHours() * 60 + now.getMinutes() };
  }
}

/** The schedule on at `now`, if any. A schedule that runs past midnight (22:00–02:00) counts from the day it starts. */
export function scheduleOn(list: readonly Schedule[], now: Date, tz: string | null): Schedule | null {
  const { day, min } = clockIn(now, tz);
  for (const s of list) {
    const a = mins(s.from), b = mins(s.to);
    if (a < b) { if (s.days.includes(day) && min >= a && min < b) return s; }
    else if ((s.days.includes(day) && min >= a) || (s.days.includes((day + 6) % 7) && min < b)) return s;
  }
  return null;
}

/** "5", "5:30", "17:00" → how a person's "back at" reads: 12-hour, no :00 ("back at 5", "back at 5:30"). */
export function backAt(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3, 5);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${h12}` : `${h12}:${m}`;
}

/** "Mon–Fri", "Sat", "Mon, Wed, Fri", "Every day". */
export function daysLabel(days: readonly number[]): string {
  const N = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const d = [...days].sort();
  if (d.length === 7) return "Every day";
  if (d.join() === "0,1,2,3,4") return "Mon–Fri";
  if (d.join() === "5,6") return "Weekends";
  const run = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  return run ? `${N[d[0]]}–${N[d[d.length - 1]]}` : d.map((x) => N[x]).join(", ");
}

/** "9:00–17:00" → "9–5" style for a status line. */
export const hoursLabel = (s: Pick<Schedule, "from" | "to">) => `${backAt(s.from)}–${backAt(s.to)}`;

export interface LiveStatus {
  emoji: string | null;
  text: string | null;
  /** On a schedule now: busy, with "back at …". */
  busy: Schedule | null;
  backAt: string | null;
  /** Buzzes paused (do not disturb, or a schedule with "pause buzzes"). */
  quiet: boolean;
  dndUntil: string | null;
}

/** What a person's status says at `now`: a schedule that is on wins over a typed status; cleared ones are gone. */
export function liveStatus(row: StatusRow | null | undefined, now: Date): LiveStatus {
  const none: LiveStatus = { emoji: null, text: null, busy: null, backAt: null, quiet: false, dndUntil: null };
  if (!row) return none;
  const t = now.getTime();
  const dnd = row.dnd_until && Date.parse(row.dnd_until) > t ? row.dnd_until : null;
  const on = scheduleOn(cleanSchedules(row.schedules), now, row.tz);
  if (on) return { emoji: on.emoji || null, text: on.text || null, busy: on, backAt: backAt(on.to), quiet: !!dnd || on.pause, dndUntil: dnd };
  const kept = !row.clear_at || Date.parse(row.clear_at) > t;
  return { emoji: kept ? row.emoji || null : null, text: kept ? row.text || null : null, busy: null, backAt: null, quiet: !!dnd, dndUntil: dnd };
}

/** The dot: do not disturb beats busy beats here-now. `here` = the room is open and used in the last 10 minutes. */
export function presenceOf(here: boolean, live: LiveStatus): Presence {
  if (live.dndUntil) return "dnd";
  if (live.busy) return "busy";
  return here ? "active" : "away";
}

export const PRESENCE_WORD: Record<Presence, string> = { active: "Active", away: "Away", dnd: "Do not disturb", busy: "Busy" };

/** When "clear after" ends: 1 hour, today (midnight), this week (Sunday midnight), never (null). */
export type ClearAfter = "1h" | "today" | "week" | "never";
export function clearAt(after: ClearAfter, now: Date): string | null {
  if (after === "never") return null;
  if (after === "1h") return new Date(now.getTime() + 3600_000).toISOString();
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  if (after === "week") d.setDate(d.getDate() + ((7 - ((d.getDay() + 6) % 7)) % 7));
  return d.toISOString();
}

/** Pause buzzes: 30 min, 1 hour, until 9 tomorrow. */
export type PauseFor = "30m" | "1h" | "tomorrow";
export function pauseUntil(p: PauseFor, now: Date): string {
  if (p === "30m") return new Date(now.getTime() + 30 * 60_000).toISOString();
  if (p === "1h") return new Date(now.getTime() + 3600_000).toISOString();
  const d = new Date(now);
  d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** A row as read from the database, cleaned. */
export function cleanStatus(raw: Record<string, unknown>, person: TeamPerson): StatusRow {
  const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  return {
    person,
    emoji: str(raw.emoji, 16), text: str(raw.text, 100),
    clear_at: str(raw.clear_at, 40), dnd_until: str(raw.dnd_until, 40),
    schedules: cleanSchedules(raw.schedules), tz: str(raw.tz, 64),
    updated_at: str(raw.updated_at, 40) ?? new Date(0).toISOString(),
  };
}

/** The status line under a name: "🎬 filming clips", "🎓 Uni · back at 5", "" when none. */
export function statusLine(live: LiveStatus): string {
  const words = [live.emoji, live.text].filter(Boolean).join(" ");
  if (live.busy) return `${words || "Busy"} · back at ${live.backAt}`;
  return words;
}
