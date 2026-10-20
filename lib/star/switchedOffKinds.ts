/**
 * CHANCE TYPES SWITCHED OFF.
 *
 * Harry, 24 Sep 2026: "for now remove volley and header from scenario gallery
 * and from being in the game in general." Back ON (B10, 20 Oct 2026: "headers
 * AND volleys back on, with the ball-in-the-air + shadow signal and build-ups
 * lofting it to your head"), so the list is empty. A header or a volley with
 * no drawings of its own is played off the team's cross drawings
 * (lib/star/airDrawings.ts).
 *
 * One list, so switching a kind off again is adding its word here: the match,
 * the gallery and the highlights page never ask for it, and if the engine's
 * own pickers roll one anyway, the match swaps it for the nearest chance that
 * is still on before you ever see it.
 */
import type { ScenarioKind } from "./canvasEngine";

export const SWITCHED_OFF_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>([]);

export const isSwitchedOff = (k: ScenarioKind): boolean => SWITCHED_OFF_KINDS.has(k);

/** The list with switched-off kinds taken out. If that leaves nothing, the
 *  original comes back, and the match's own swap (playableKind) covers it. */
export function withoutSwitchedOff(kinds: readonly ScenarioKind[]): ScenarioKind[] {
  const kept = kinds.filter(k => !isSwitchedOff(k));
  return kept.length ? kept : [...kinds];
}

/**
 * A switched-off kind, swapped for the nearest one that is on. Both are
 * finishes in the box, so they become the other finishes in the box: a volley
 * (central, off a cross) a one-on-one or a tight angle; a header (off a wide
 * cross) a cutback or a tight angle. Any other kind comes back unchanged, and
 * the rng is only drawn from when a swap actually happens.
 */
export function playableKind(kind: ScenarioKind, rng: () => number): ScenarioKind {
  if (!isSwitchedOff(kind)) return kind;
  if (kind === "volley") return rng() < 0.6 ? "one_on_one" : "tight_angle";
  return rng() < 0.6 ? "cutback" : "tight_angle";
}
