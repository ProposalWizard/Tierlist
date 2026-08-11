import type { CareerRecord, Detector, FootballEvent, MatchRecord, StoryMemory } from "../types";
import { GOAL_DETECTORS } from "./goals";
import { CREATION_DETECTORS } from "./creation";
import { RESULT_DETECTORS } from "./result";
import { PERSONAL_DETECTORS } from "./personal";
import { TABLE_DETECTORS } from "./table";
import { COMPETITION_DETECTORS } from "./competition";
import { STREAK_DETECTORS } from "./streaks";
import { CAREER_DETECTORS } from "./career";

/**
 * The registry.
 *
 * Adding a detectable event to the whole game is one entry in one of these
 * arrays. Nothing else in the engine has to know it exists: importance scoring
 * reads its tags, account selection reads its tags, the template index falls
 * back to the archetype's generic line if nobody has written a specific one yet.
 * So a new event is useful on the day it is added and gets better as templates
 * are written for it, rather than being useless until all thirteen are.
 */
export const MATCH_DETECTORS: Detector[] = [
  ...GOAL_DETECTORS,
  ...CREATION_DETECTORS,
  ...RESULT_DETECTORS,
  ...PERSONAL_DETECTORS,
  ...TABLE_DETECTORS,
  ...COMPETITION_DETECTORS,
  ...STREAK_DETECTORS,
];

function flatten(x: FootballEvent | FootballEvent[] | null): FootballEvent[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export function detectMatch(r: MatchRecord, m: StoryMemory): FootballEvent[] {
  const out: FootballEvent[] = [];
  for (const d of MATCH_DETECTORS) {
    // A detector that throws must not take the feed down with it. It is content,
    // not physics — a missing post is invisible, a white screen is not.
    try { out.push(...flatten(d(r, m))); } catch { /* skip */ }
  }
  return dedupe(out);
}

export function detectCareer(r: CareerRecord, m: StoryMemory): FootballEvent[] {
  const out: FootballEvent[] = [];
  for (const d of CAREER_DETECTORS) {
    try { out.push(...flatten(d(r, m))); } catch { /* skip */ }
  }
  return dedupe(out);
}

/** Two detectors firing the same id is a bug in one of them; keep the louder. */
function dedupe(events: FootballEvent[]): FootballEvent[] {
  const byId = new Map<string, FootballEvent>();
  for (const e of events) {
    const prev = byId.get(e.id);
    if (!prev || e.baseImportance > prev.baseImportance) byId.set(e.id, e);
  }
  return Array.from(byId.values());
}

export { CAREER_DETECTORS };
