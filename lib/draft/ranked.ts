/**
 * lib/draft/ranked.ts — Ranked or Custom (Leo, 27 Nov 2026: "not loads of diff
 * things that make drafts too different so u cant rlly compare to others").
 *
 * A draft is RANKED when it uses the standard rules, so its records can sit
 * next to everyone else's. Three Hall of Fame boards only:
 *   Normal · Prime · Chemistry (Chemistry plays with Normal ratings).
 * Anything else (fewer re-spins, hidden ratings, a narrower era, Chemistry
 * with Prime) is CUSTOM: it plays the same and goes in your history, but not
 * the Hall of Fame. Pure.
 */
import type { DraftSettings } from "@/app/draft/page";

export const RANKED = { eraStart: 2007, eraEnd: 2026, respins: 3 as const };

export function isRanked(s: Pick<DraftSettings, "eraStart" | "eraEnd" | "respins" | "hiddenRatings" | "mode"> & { chemistry?: boolean }): boolean {
  if (s.eraStart > RANKED.eraStart || s.eraEnd < RANKED.eraEnd) return false;
  if (s.respins !== RANKED.respins) return false;
  if (s.hiddenRatings) return false;
  if (s.chemistry && s.mode === "prime") return false;
  return true;
}

/** The Hall of Fame board a ranked draft goes on; null for a custom one. */
export function boardFor(s: Parameters<typeof isRanked>[0]): "normal" | "prime" | "chem" | null {
  if (!isRanked(s)) return null;
  return s.chemistry ? "chem" : s.mode;
}

/** Why it is custom, in a few words (the setup screen). */
export function customReasons(s: Parameters<typeof isRanked>[0]): string[] {
  const r: string[] = [];
  if (s.eraStart > RANKED.eraStart || s.eraEnd < RANKED.eraEnd) r.push("a narrower era");
  if (s.respins !== RANKED.respins) r.push(`${s.respins} re-spin${s.respins === 1 ? "" : "s"}`);
  if (s.hiddenRatings) r.push("hidden ratings");
  if (s.chemistry && s.mode === "prime") r.push("Chemistry with Prime");
  return r;
}
