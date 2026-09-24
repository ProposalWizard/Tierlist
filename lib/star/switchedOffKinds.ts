/**
 * CHANCE TYPES SWITCHED OFF FOR NOW.
 *
 * Harry, 24 Sep 2026: "for now remove volley and header from scenario gallery
 * and from being in the game in general."
 *
 * One list, so turning one back on is deleting a word here. Nothing is
 * deleted from the engine (canvasEngine.ts is never edited, Mikey's rule):
 * it still knows how to build a volley or a header. The match, the gallery
 * and the highlights page simply never ask for one — and if the engine's own
 * pickers roll one anyway, the match swaps it for the nearest chance that is
 * still on before you ever see it.
 *
 * This is about the CHANCE types (the situations you are handed). A team-mate
 * still heads a cross you put on his head: that is how a cross is finished,
 * not a situation you are dealt.
 */
import type { ScenarioKind } from "./canvasEngine";

export const SWITCHED_OFF_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["volley", "header"]);

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
