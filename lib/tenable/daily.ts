/**
 * lib/tenable/daily.ts — which Ten-A-Ball challenge is "today's".
 *
 * The page promised "A new challenge every day!", but no challenge had a date,
 * so the same list showed every day (Leo's fault list, 24 Nov 2026; measured
 * 26 Nov: 33 challenges, none dated). Now:
 *   1. A challenge given today's date by hand (daily_date) wins.
 *   2. Otherwise the game takes turns through the list, one a day, the same
 *      one for everybody (UK date), oldest first. With 33 challenges the cycle
 *      is 33 days; every new challenge added makes it a day longer.
 */
export type DailyCandidate = { id: string; created_at: string; daily_date: string | null };

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whole days since 1 Jan 2026 for a YYYY-MM-DD date. */
function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86_400_000);
}

export function pickDaily<T extends DailyCandidate>(items: T[], today: string): T | null {
  if (items.length === 0) return null;
  const dated = items.find((p) => p.daily_date === today);
  if (dated) return dated;
  const order = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const n = order.length;
  return order[((dayNumber(today) % n) + n) % n];
}
