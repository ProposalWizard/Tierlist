/**
 * lib/guest/promptSchedule.ts — WHEN the "Save your career" card shows.
 * Pure, so tests/star/guestPrompt.mts can check it without a browser.
 *
 * Harry, 25 Oct 2026: "We should have a max amount of days before they have
 * to sign in or get prompted every day, maybe 7 days."
 *
 *  - Days 0 to 6 after the guest account was made: the two moments, each
 *    once (after the first match, after the first season).
 *  - Day 7 onwards: once a day, the first time the game opens that day, until
 *    they save with Google. "Later" closes it until tomorrow. Never a lock-out.
 *  - "That Google account is taken" always shows straight away (handled by
 *    the card itself, not here).
 */

export type GuestMilestone = "first-match" | "first-season";

/** From this many whole days after the account was made, the card shows daily. */
export const DAILY_FROM_DAY = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since the guest account was made (0 on the first day). Null when unknown. */
export function guestAgeDays(createdAt: string | number | null | undefined, now: number): number | null {
  if (createdAt === null || createdAt === undefined) return null;
  const t = typeof createdAt === "number" ? createdAt : Date.parse(createdAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** The player's own calendar day, e.g. "2026-11-02" (the card is once per LOCAL day). */
export function localDayKey(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type GuestPromptPick =
  | { kind: "daily"; day: number }
  | { kind: "milestone"; milestone: GuestMilestone }
  | null;

/**
 * Which card, if any.
 * @param milestone   the moment the career has reached (null: none yet)
 * @param seen        milestones already closed with "Later"
 * @param ageDays     guestAgeDays (null: unknown, so only the moments apply)
 * @param lastDaily   the day key the daily card was last shown/closed
 * @param today       localDayKey(now)
 */
export function pickGuestPrompt(o: {
  milestone: GuestMilestone | null;
  seen: readonly string[];
  ageDays: number | null;
  lastDaily: string | null;
  today: string;
}): GuestPromptPick {
  if (o.ageDays !== null && o.ageDays >= DAILY_FROM_DAY) {
    return o.lastDaily === o.today ? null : { kind: "daily", day: o.ageDays };
  }
  if (o.milestone && !o.seen.includes(o.milestone)) return { kind: "milestone", milestone: o.milestone };
  return null;
}
