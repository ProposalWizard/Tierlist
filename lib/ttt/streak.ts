/**
 * lib/ttt/streak.ts — the daily Tic Tac Toe streak (Leo, 27 Nov 2026).
 * Kept on this device: the dates (YYYY-MM-DD, the puzzle's own daily date)
 * whose daily grid was finished. Pure sums plus two small storage helpers.
 */
export const STREAK_KEY = "kib-ttt-dailies";

const DAY = 86_400_000;
const toDay = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);

/** Days in a row up to today (or yesterday: a streak holds until today's grid is missed). */
export function currentStreak(dates: readonly string[], today: string): number {
  const days = new Set(dates.map(toDay));
  const t = toDay(today);
  let d = days.has(t) ? t : days.has(t - 1) ? t - 1 : NaN;
  let n = 0;
  while (!Number.isNaN(d) && days.has(d)) { n++; d--; }
  return n;
}

export function bestStreak(dates: readonly string[]): number {
  const days = Array.from(new Set(dates.map(toDay))).sort((a, b) => a - b);
  let best = 0, run = 0, prev = NaN;
  for (const d of days) { run = d === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

export function readDailies(): string[] {
  try { const v = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}

export function markDaily(date: string): string[] {
  const all = Array.from(new Set([...readDailies(), date])).sort().slice(-400);
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(all)); } catch { /* private mode */ }
  return all;
}

export const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);
