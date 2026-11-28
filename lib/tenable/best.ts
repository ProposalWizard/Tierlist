/**
 * lib/tenable/best.ts — your best score on each Ten-A-Ball challenge, kept on
 * this device (Leo, 27 Nov 2026), and the share line. Pure apart from storage.
 */
export const BEST_KEY = "kib-tenable-best";

export function readBests(): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/** Saves the score if it beats the old best; returns the best now. */
export function saveBest(id: string, score: number): number {
  const all = readBests();
  const best = Math.max(all[id] ?? 0, score);
  all[id] = best;
  try { localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch { /* private mode */ }
  return best;
}

/** "Ten-A-Ball: Prem top scorers 7/10 ⚽⚽⚽⚽⚽⚽⚽❌❌❌ knowitball.co.uk/tenable/<id>" */
export function shareLine(title: string, score: number, id: string): string {
  const s = Math.max(0, Math.min(10, score));
  return `Ten-A-Ball: ${title}\n${s}/10 ${"⚽".repeat(s)}${"❌".repeat(10 - s)}\nknowitball.co.uk/tenable/${id}`;
}

/** One challenge per title (the newest), for lists that were showing the same one twice. */
export function oncePerTitle<T extends { title: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => { const k = r.title.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
