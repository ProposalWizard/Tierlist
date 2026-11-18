/**
 * THE CAREER'S FLOW: what happens between screens (owned by the CAREER area).
 * The website's version lives in app/star-dev/page.tsx (handlePlayMatch,
 * handleMatchComplete, the season end). This file is the phone's port of it,
 * calling the same lib/star functions in the same order.
 *
 * The MATCH area calls completeMatch(stats) at full time and nothing else.
 */
import type { MatchStats, Fixture } from "@/lib/star/types";
import { getCareer } from "./store";

/** The fixture the next match is for (null when the season has none left). */
export function nextFixture(): Fixture | null {
  const c = getCareer();
  return c?.fixtures.find((f) => !f.played) ?? null;
}

/** Full time: credit the match to the career. STUB until the career area ports it. */
export function completeMatch(_stats: MatchStats): void {
  // ported from page.tsx handleMatchComplete by the career area
}
