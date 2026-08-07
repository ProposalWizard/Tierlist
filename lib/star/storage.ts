import type { CareerState, StarPhase } from "./types";

const KEY = "star-career-v2";
const OLD_KEY = "star-career-v1";
const PHASE_KEY = "star-career-phase-v1";

/**
 * The phases a refresh must land you back in.
 *
 * The career itself has always been saved, but the phase was React state only,
 * so reloading always dropped you on the dashboard. For most screens that is
 * fine — you can navigate back. For these three it was a soft-lock: the season
 * was over, the dashboard had no fixture left to play and no way to reach the
 * Ballon d'Or, and the career could never advance again.
 *
 * Deliberately NOT resumable: `match` (the match state is not saved, so it would
 * resume an empty game), `post-match` and `training` (their results live in
 * component state), and every browsing screen (just navigate).
 */
const RESUMABLE: StarPhase[] = ["ballon-dor", "contract-renewal", "dilemma"];

export interface SavedPhase {
  phase: StarPhase;
  offerReason?: "form" | "star";
}

export function saveStarPhase(phase: StarPhase, offerReason?: "form" | "star") {
  try {
    if (!RESUMABLE.includes(phase)) { localStorage.removeItem(PHASE_KEY); return; }
    localStorage.setItem(PHASE_KEY, JSON.stringify({ phase, offerReason }));
  } catch {}
}

export function loadStarPhase(): SavedPhase | null {
  try {
    const raw = localStorage.getItem(PHASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPhase;
    return RESUMABLE.includes(parsed.phase) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCareer(state: CareerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCareer() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    localStorage.removeItem(PHASE_KEY);
  } catch {}
}
