/**
 * lib/teamRoom/today.ts — #today: each person's check-in for the day, the
 * week as a grid, and the Today bot's morning ask (Harry, 12 Nov 2026: "we
 * don't even have a #today … that should be a page in the today channel …
 * this week, see what everyone's doing").
 *
 * No new table. A check-in is an ordinary message in #today ("[#today] on the
 * goal replays"); a person's check-in for a day is their NEWEST message in
 * #today that UK day (thread replies do not count). "/today words" writes one.
 * Pure: tested in tests/star/teamRoomBots.mts.
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";
import { botMentionsIn, parseMessage } from "./extras";
import type { BotRow } from "./channels";
import type { TeamMessage } from "./logic";
import type { NewBotRow } from "./patchBot";

export const TODAY_CHANNEL = "today";

/** The UK date (YYYY-MM-DD), hour and weekday (0 = Sunday) of a moment. */
export function ukDay(at: Date | number | string): { day: string; hour: number; weekday: number } {
  const d = at instanceof Date ? at : new Date(at);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}

export interface CheckIn { id: number; person: TeamPerson; text: string; at: string }

/** The text a check-in is saved as: a message in #today. */
export const checkInBody = (text: string) => `[#${TODAY_CHANNEL}] ${(text ?? "").replace(/\s+/g, " ").trim()}`.slice(0, 300);

/** Every check-in: a #today message that is not a thread reply and has words. */
function checkIns(messages: readonly TeamMessage[]): (CheckIn & { day: string })[] {
  const out: (CheckIn & { day: string })[] = [];
  for (const m of messages) {
    const p = parseMessage(m.body);
    if (p.channel !== TODAY_CHANNEL || p.replyTo || p.patch || !p.text.trim()) continue;
    // A question to a bot ("@Today bot who is in?") is not a check-in.
    if (botMentionsIn(p.text).length) continue;
    out.push({ id: m.id, person: m.person, text: p.text.trim(), at: m.created_at, day: ukDay(m.created_at).day });
  }
  return out;
}

/** Each person's check-in for one UK day (their newest that day), or nothing. */
export function checkInsFor(messages: readonly TeamMessage[], day: string): Partial<Record<TeamPerson, CheckIn>> {
  const out: Partial<Record<TeamPerson, CheckIn>> = {};
  for (const c of checkIns(messages)) {
    if (c.day !== day) continue;
    const have = out[c.person];
    if (!have || c.id > have.id) out[c.person] = { id: c.id, person: c.person, text: c.text, at: c.at };
  }
  return out;
}

/** Who has not checked in on `day`, in board order. */
export const notCheckedIn = (messages: readonly TeamMessage[], day: string): TeamPerson[] => {
  const have = checkInsFor(messages, day);
  return TEAM_PEOPLE.filter((p) => !have[p]);
};

/** The seven UK days of the week `now` is in, Monday first. */
export function weekDays(now: Date | number): string[] {
  const d = now instanceof Date ? now : new Date(now);
  const { weekday } = ukDay(d);
  const back = (weekday + 6) % 7; // Monday = 0
  const out: string[] = [];
  // Noon keeps a clock change from tipping a day over.
  const noon = new Date(d.getTime());
  for (let i = 0; i < 7; i++) out.push(ukDay(new Date(noon.getTime() + (i - back) * 86400_000)).day);
  return out;
}

export interface WeekRow { day: string; label: string; today: boolean; future: boolean; cells: Record<TeamPerson, CheckIn | null> }

/** This week, a row a day (Mon to Sun), a cell a person. */
export function weekGrid(messages: readonly TeamMessage[], now: Date | number): WeekRow[] {
  const today = ukDay(now).day;
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return weekDays(now).map((day, i) => {
    const have = checkInsFor(messages, day);
    const cells = Object.fromEntries(TEAM_PEOPLE.map((p) => [p, have[p] ?? null])) as Record<TeamPerson, CheckIn | null>;
    return { day, label: `${names[i]} ${Number(day.slice(8))}`, today: day === today, future: day > today, cells };
  });
}

/* ── The Today bot ──────────────────────────────────────────────────── */

export const TODAY_BOT = {
  bot: "today",
  /** The morning ask goes out at this UK hour (or the first run after it). */
  hour: 9,
  /** …and never after this hour: a first run late in the day stays quiet. */
  lastHour: 13,
} as const;

const metaOf = (r: Pick<BotRow, "meta">) => (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
export const isTodayAsk = (r: Pick<BotRow, "bot" | "meta">) => r.bot === TODAY_BOT.bot && metaOf(r).kind === "ask";

/**
 * The Today bot's one post a day: from 09:00 UK, Monday to Friday, it asks
 * whoever has not checked in yet, by name, in #today. Once per UK day (it
 * reads its own rows first), nothing when everyone has checked in, nothing
 * when switched off, nothing at the weekend.
 */
export function todayAskPlan(input: { now: Date; rows: readonly BotRow[]; messages: readonly TeamMessage[]; enabled?: boolean }): NewBotRow[] {
  if (input.enabled === false) return [];
  const { day, hour, weekday } = ukDay(input.now);
  if (weekday === 0 || weekday === 6) return [];
  if (hour < TODAY_BOT.hour || hour > TODAY_BOT.lastHour) return [];
  if (input.rows.some((r) => isTodayAsk(r) && metaOf(r).day === day)) return [];
  const waiting = notCheckedIn(input.messages, day);
  if (!waiting.length) return [];
  return [{
    bot: TODAY_BOT.bot, channel: TODAY_CHANNEL, title: "What are you on today?",
    body: `${waiting.map((p) => `@${p}`).join(" ")} one line is enough. Type it in the Today tab, or anywhere: /today filming the goal replays`,
    url: `${TEAM_ROOM.home}?tab=chat&ch=${TODAY_CHANNEL}`, everyone: false, meta: { kind: "ask", day, people: waiting },
  }];
}
