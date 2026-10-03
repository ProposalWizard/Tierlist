/**
 * AN EVEN MIX OF HIGHLIGHTS, FOR NOW.
 *
 * Harry, 3 Oct 2026: "already I was getting too many cutbacks, can you just
 * evenly distribute highlights for now."
 *
 * While EVEN_KIND_MIX is on, every open-play highlight the match hands you
 * (and every move that carries on after a pass) is dealt from a shuffled bag
 * holding each open-play kind once. So in any run of eight you get each kind
 * once, and never the same kind twice in a row. Set pieces (penalties, free
 * kicks, corners) still come when the match gives one: they are not in the bag.
 *
 * What this turns off while it is on: where the ball is, your position, the
 * playstyle toggle's kind mix, the gap to the other side and your stats no
 * longer change WHICH kind you get. They still decide how often the ball finds
 * you. Set EVEN_KIND_MIX to false to put all of that back exactly as it was.
 */
import type { ScenarioKind } from "./canvasEngine";
import { isSwitchedOff } from "./switchedOffKinds";

/** THE ONE SWITCH. */
export const EVEN_KIND_MIX = true;

/** Every open-play kind that is switched on (volley and header are off). */
export const EVEN_KINDS: ScenarioKind[] = ([
  "one_on_one", "tight_angle", "long_range", "cutback",
  "byline_cross", "through_ball", "midfield_pass", "buildup",
] as ScenarioKind[]).filter((k) => !isSwitchedOff(k));

/** The bag: what is left to deal this round, and the last kind dealt. */
export interface KindBag { left: ScenarioKind[]; last?: ScenarioKind }

export function newKindBag(): KindBag { return { left: [] }; }

/** Deal the next kind. A fresh round never starts with the kind just dealt. */
export function nextEvenKind(bag: KindBag, rng: () => number): ScenarioKind {
  if (bag.left.length === 0) {
    const round = [...EVEN_KINDS];
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    if (round.length > 1 && round[0] === bag.last) [round[0], round[1]] = [round[1], round[0]];
    bag.left = round;
  }
  const k = bag.left.shift()!;
  bag.last = k;
  return k;
}
