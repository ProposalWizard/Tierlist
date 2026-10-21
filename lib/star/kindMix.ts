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

/** Every open-play kind that is switched on. Header and volley joined on
 *  20 Oct 2026 (B10: "headers AND volleys back on"), so a round is 10 deals:
 *  each kind 1 in 10 of open play (was 1 in 8). */
export const EVEN_KINDS: ScenarioKind[] = ([
  "one_on_one", "tight_angle", "long_range", "cutback",
  "byline_cross", "through_ball", "midfield_pass", "buildup",
  "header", "volley",
] as ScenarioKind[]).filter((k) => !isSwitchedOff(k));

/** The bag: what is left to deal this round, and the last kind dealt. */
export interface KindBag { left: ScenarioKind[]; last?: ScenarioKind }

export function newKindBag(): KindBag { return { left: [] }; }

/**
 * THE REAL MIX (Mikey, 9 Oct 2026): "Kane would get less chances for
 * one-on-ones … but gets the ball in deeper situations far more often … you
 * can pass it … and then you might get the ball back".
 *
 * Re-sourced 21 Oct 2026 from free data: every central forward in the Wyscout
 * public dataset (CC BY 4.0, 1,941 matches; roles from its PlayeRank file),
 * data/opendata/wyscout_shot_outcomes.json `forward_touches_by_area`: 52 touches
 * per 90, 58% of them 35 m+ from goal, 30% 18-35 m out, 12% in the box. So a
 * round of the bag is 17 deals: 10 deep (a pass, build-up, a through ball),
 * 5 from 18-35 m (long shot, cutback, cross), 2 in the box (a tight angle, a
 * one-on-one) — one one-on-one in 17, against one in 8 in the even mix.
 * Before the re-source the bag was 8 / 6 / 3 (an older single-player count).
 * Nothing live deals it yet: no screen passes `realMix` (chanceMaker.ts); it
 * becomes the "real" mix of Harry's D4 in the formula rebuild (piece 5f).
 * The even mix (the default) is unchanged.
 */
export const REAL_MIX: Partial<Record<ScenarioKind, number>> = {
  midfield_pass: 4, buildup: 3, through_ball: 3,
  long_range: 2, cutback: 2, byline_cross: 1,
  tight_angle: 1, one_on_one: 1,
  // B10 (20 Oct 2026): headers and volleys stay out of the real mix until the
  // role tables count them (piece 5f). The even mix (the default) deals them.
  header: 0, volley: 0,
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

// ─────────────────────────────────────────────────────────────────────────
//  NEW CHANCES (Settings → Chances: New, lib/star/newChances.ts)
// ─────────────────────────────────────────────────────────────────────────

/** How many served kinds the New deal looks back on: "at most 2 of one kind
 *  in any 8" needs the last 7. */
export const GUARD_WINDOW = 8;
export const GUARD_MAX_IN_WINDOW = 2;

/** May `k` be served next, after `dealt` (oldest first)? Never the kind just
 *  served, and at most GUARD_MAX_IN_WINDOW of one kind in any GUARD_WINDOW. */
export function guardAllows(k: ScenarioKind, dealt: readonly ScenarioKind[]): boolean {
  if (dealt.length && dealt[dealt.length - 1] === k) return false;
  const last = dealt.slice(-(GUARD_WINDOW - 1));
  return last.filter((x) => x === k).length < GUARD_MAX_IN_WINDOW;
}

/** One weighted pick from a list of kinds (copies are the weights), one rng() drawn. */
function pickCopies(list: readonly ScenarioKind[], rng: () => number): ScenarioKind {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * The New deal: the match radar's own weighted kinds (`offered`, copies are
 * the weights), with the guard. When nothing offered passes the guard, the
 * `wider` lists are tried in order (the zone's other lane, then the zones
 * either side), then the guard eases to "just not the same kind twice in a
 * row", then anything offered. Always exactly one rng() drawn.
 */
export function guardedDeal(
  offered: readonly ScenarioKind[], wider: readonly (readonly ScenarioKind[])[], dealt: readonly ScenarioKind[], rng: () => number,
): ScenarioKind {
  const notLast = (k: ScenarioKind) => !(dealt.length && dealt[dealt.length - 1] === k);
  const tiers: ScenarioKind[][] = [
    offered.filter((k) => guardAllows(k, dealt)),
    ...wider.map((w) => w.filter((k) => guardAllows(k, dealt))),
    offered.filter(notLast),
    ...wider.map((w) => w.filter(notLast)),
  ];
  const pool = tiers.find((t) => t.length) ?? [...offered];
  return pickCopies(pool, rng);
}

/** Remember a served kind for the guard (keeps the last GUARD_WINDOW). */
export function noteDealt(dealt: ScenarioKind[], k: ScenarioKind): void {
  dealt.push(k);
  if (dealt.length > GUARD_WINDOW) dealt.splice(0, dealt.length - GUARD_WINDOW);
}
