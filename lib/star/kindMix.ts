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

/**
 * THE REAL MIX (Mikey, 9 Oct 2026, from Kane's real touches): "Kane would get
 * less chances for one-on-ones … but gets the ball in deeper situations far
 * more often … you can pass it … and then you might get the ball back".
 *
 * Measured from StatsBomb (12 England matches): Kane is on the ball 33 times a
 * match, 49% of it 35m+ from goal, 31% 18–35m out, 20% in the box. So a round
 * of the bag is 17 deals, 8 of them deep (a pass, build-up, a through ball)
 * and one in 17 a one-on-one, against one in 8 in the even mix. Long shots
 * and tight angles are dealt more, so your own shots a match stay about the
 * same (a striker: 2.1 → 2.5 a match, one-on-ones 0.67 → 0.49, measured over 600 matches): fewer gift chances, not fewer chances. Settings →
 * Match → Chance mix: Old deals the even mix exactly as before.
 */
export const REAL_MIX: Partial<Record<ScenarioKind, number>> = {
  midfield_pass: 3, buildup: 2, through_ball: 3,
  long_range: 2, cutback: 2, byline_cross: 2,
  tight_angle: 2, one_on_one: 1,
};

/** One round of the real-mix bag: each kind as many times as its weight. */
export function realMixRound(): ScenarioKind[] {
  return EVEN_KINDS.flatMap((k) => Array<ScenarioKind>(REAL_MIX[k] ?? 1).fill(k));
}

/** Deal the next kind. A fresh round never starts with the kind just dealt.
 *  `real`: deal from the real mix (REAL_MIX) instead of the even one. */
export function nextEvenKind(bag: KindBag, rng: () => number, real = false): ScenarioKind {
  if (bag.left.length === 0) {
    const round = real ? realMixRound() : [...EVEN_KINDS];
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
