/**
 * lib/draft/daily.ts — the Daily Draft (Leo, 27 Nov 2026).
 *
 * Everyone gets the same club-and-season spins today, in the same order,
 * picked from today's UK date. Same settings for all (DAILY_SETTINGS). Your
 * score is your first season's league points; the ranking counts today's
 * saved daily runs (event_key "daily:<date>:…", app/api/draft/daily).
 * Pure: no network, no storage (the streak helpers take storage in).
 */

export const DAILY_PREFIX = "daily:";

export const DAILY_SETTINGS = {
  eraStart: 2007,
  eraEnd: 2026,
  mode: "normal" as const,
  draftOrder: "club-first" as const,
  respins: 0 as const,
  hiddenRatings: false,
};

/** A small fast seeded random (mulberry32). Same seed, same numbers, every device. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export interface ClubSeasons { name: string; seasons: number[] }

/**
 * Today's spins, in order: pick a season, then a club in it (the normal
 * game's balance), never the same club-season twice. Sorted input, so the
 * order of the club list doesn't matter.
 */
export function dailySpinOrder(clubs: readonly ClubSeasons[], date: string, eraStart = DAILY_SETTINGS.eraStart, eraEnd = DAILY_SETTINGS.eraEnd, n = 40): { club: string; year: number }[] {
  const byYear = new Map<number, string[]>();
  for (const c of [...clubs].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const y of c.seasons) if (y >= eraStart && y <= eraEnd) byYear.set(y, [...(byYear.get(y) ?? []), c.name]);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  const rnd = seeded(hashString(`kib-daily-draft:${date}`));
  const out: { club: string; year: number }[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < n && years.length && guard++ < n * 50) {
    const y = years[Math.floor(rnd() * years.length)];
    const list = byYear.get(y)!;
    const club = list[Math.floor(rnd() * list.length)];
    const k = `${club}-${y}`;
    if (used.has(k)) continue;
    used.add(k);
    out.push({ club, year: y });
  }
  return out;
}

/** The next of today's spins not used yet. */
export function nextDailySpin(order: readonly { club: string; year: number }[], used: ReadonlySet<string>): { club: string; year: number } | null {
  return order.find((s) => !used.has(`${s.club}-${s.year}`)) ?? null;
}

/** One square per pick: how close to the best player that spin offered. */
export function pickSquare(overall: number, best: number): string {
  if (overall >= best - 1) return "🟩";
  if (overall >= best - 5) return "🟨";
  return "🟧";
}

export function shareText(date: string, squares: string, points: number, finish: number, topPct: number | null): string {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const ord = (n: number) => `${n}${[, "st", "nd", "rd"][((n % 100) - 20) % 10] || [, "st", "nd", "rd"][n % 100] || "th"}`;
  const rank = topPct !== null ? ` · top ${topPct}%` : "";
  // Seven squares a row (they are two-character emoji, so split by code point).
  const cells = Array.from(squares);
  const rows = [cells.slice(0, 7), cells.slice(7, 14), cells.slice(14)].filter((r) => r.length).map((r) => r.join("")).join("\n");
  return `Knowitball Daily Draft · ${day}\n${rows}\n${points} pts · finished ${ord(finish)}${rank}\nknowitball.co.uk/draft`;
}

/** "Top 12%": share of today's players who scored at least as much. Null with too few to say. */
export function topPercent(points: number, all: readonly number[]): number | null {
  if (all.length < 5) return null;
  const atLeast = all.filter((p) => p >= points).length;
  return Math.max(1, Math.ceil((atLeast / all.length) * 100));
}

/** Days in a row with a Daily Draft played (dates YYYY-MM-DD). */
export function dailyStreak(dates: readonly string[], today: string): number {
  const DAY = 86_400_000;
  const toDay = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY);
  const days = new Set(dates.map(toDay));
  let d = days.has(toDay(today)) ? toDay(today) : toDay(today) - 1;
  let n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}
