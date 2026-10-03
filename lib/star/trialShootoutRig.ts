/**
 * THE TRIAL'S PENALTY SHOOTOUT — RIGGED SO YOU TAKE THE WINNING KICK.
 *
 * Harry (1 Oct 2026, reviewing the v0.20 trial): "If anything we should do a
 * full pen shootout where it rigs the game so it always has you having to
 * score the winning pen, and that's how it should end." Up to three kicks
 * each, Trialists against Academy.
 *
 * ── v0.24 (Harry, 2 Oct 2026): you take ONE kick, the last ──
 *
 * "I'm not meant to take all three pens … you have two teammates take those
 * first two, and then the academy players take their three." And: "it could
 * be any organization of outcomes to get to that. They could miss three, we
 * miss two, and I'm the last one. Basically your pen should be to win the
 * game." And the opponents "miss in the same exact way" — so they don't now.
 *
 * So every kick but your last is struck by the match itself
 * (penaltyTaking.ts's automatic kick), and the rig decides each one before it
 * is struck:
 *
 *   order: Academy 1, team-mate 1, Academy 2, team-mate 2, Academy 3, YOU.
 *
 * A `RigScript` is rolled once per save (`createRigScript`): how many goals
 * each side has before your kick (0, 1 or 2 — the same for both, so it is
 * level), and WHICH kicks they are. That is 10 different paths — 0-0 (they
 * miss three, we miss two: Harry's own example), six ways to reach 1-1 and
 * three ways to reach 2-2 — and the number of goals is picked first, a third
 * each, so a 0-0 is not rare. Score your kick and you win; miss it and it
 * stays level (the scout still comes).
 *
 * ── Misses that look different ──
 *
 * Each rigged miss has its own style, drawn without repeats until all three
 * have been used, and its own side: `wide` (along the grass, past the post),
 * `skied` (high and wide) and `over` (inside the posts, over the bar).
 * Measured on the real engine before choosing (tests/star/trialShootoutRig.mts
 * keeps the numbers): all three stay out at least 99.5 % of the time at every
 * keeper the shootout uses. A rigged SAVE was tried and dropped: the keeper
 * parries about a quarter of them back in (a "rebound" goal), at every power
 * and keeper strength tried.
 *
 * ── If the engine ever disagrees ──
 *
 * A planned goal stays out about once in 200. `rigIntent` follows the script
 * only while that still ends level; otherwise it picks whichever result keeps
 * level reachable, so one surprise early on is absorbed by a later kick.
 *
 * Nothing here moves a ball. Pure: no React, no canvas.
 */
import type { PenaltyPlan } from "./penaltyTaking";
import { sameHeight } from "./penaltyTaking";
import { mulberry32 } from "./season";
import { PENALTY_RUNUPS, takerPenaltyRunup, type PenaltyRunupId } from "./runupStyles";

export type RigSide = "you" | "them";
export interface RigKick { side: RigSide; scored: boolean }
export interface RigState {
  kicks: RigKick[];
  over: boolean;
  /** "you" / "them" once decided; null while it is going on, and null at the
   *  end if your last kick missed (level — it would go to sudden death). */
  winner: RigSide | null;
}

/** Up to this many kicks each. Harry: "do up to three". */
export const SHOOTOUT_KICKS = 3;
/** Kicks in the whole shootout. */
export const SHOOTOUT_TOTAL = SHOOTOUT_KICKS * 2;

export type MissStyle = "wide" | "skied" | "over";
export const MISS_STYLES: MissStyle[] = ["wide", "skied", "over"];

/**
 * The plan for every kick before yours, in kick order (index = kick number,
 * 0-4). `intents[i]` is whether kick i is meant to go in; `sides[i]` which
 * way it goes; `misses[i]` how it misses when it does.
 */
export interface RigScript {
  intents: boolean[];
  sides: (1 | -1)[];
  misses: MissStyle[];
  /** Goals each side has before your kick (0, 1 or 2). */
  level: number;
}

export function createRig(): RigState {
  return { kicks: [], over: false, winner: null };
}

/** Academy first, Trialists second, every round. */
export function rigNextSide(kicks: RigKick[]): RigSide {
  return kicks.length % 2 === 0 ? "them" : "you";
}

export function rigGoals(kicks: RigKick[], side: RigSide): number {
  return kicks.filter(k => k.side === side && k.scored).length;
}

export function rigKicksTaken(kicks: RigKick[], side: RigSide): number {
  return kicks.filter(k => k.side === side).length;
}

/** Is the kick up now YOURS — the Trialists' last, the winning penalty? */
export function isYourKick(state: RigState): boolean {
  return !state.over && rigNextSide(state.kicks) === "you"
    && rigKicksTaken(state.kicks, "you") === SHOOTOUT_KICKS - 1;
}
/** Same question, the name the screen has always used. */
export const isWinningPenalty = isYourKick;

/** Is the kick up now a team-mate's (one of the Trialists' first two)? */
export function isTeamMateKick(state: RigState): boolean {
  return !state.over && rigNextSide(state.kicks) === "you" && !isYourKick(state);
}

/** k distinct indices out of n, seeded. */
function choose(n: number, k: number, rng: () => number): Set<number> {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return new Set(idx.slice(0, k));
}

/** The kick numbers (0-4) your two team-mates take: Academy goes first. */
export const MATE_KICK_INDEX = [1, 3] as const;

/** Roll the path to your kick for one save. Same seed, same path. */
export function createRigScript(seed: number): RigScript {
  const rng = mulberry32((seed ^ 0x5b007) >>> 0);
  const level = Math.min(SHOOTOUT_KICKS - 1, Math.floor(rng() * SHOOTOUT_KICKS));
  const theirs = choose(SHOOTOUT_KICKS, level, rng);       // which of their 3
  const ours = choose(SHOOTOUT_KICKS - 1, level, rng);     // which of our 2
  const intents: boolean[] = [];
  for (let i = 0; i < SHOOTOUT_TOTAL - 1; i++) {
    const round = Math.floor(i / 2);
    intents.push(i % 2 === 0 ? theirs.has(round) : ours.has(round));
  }
  // Miss styles: each of the three once before any repeats, in a random order.
  const misses: MissStyle[] = [];
  let bag: MissStyle[] = [];
  for (let i = 0; i < SHOOTOUT_TOTAL - 1; i++) {
    if (bag.length === 0) {
      bag = [...MISS_STYLES];
      for (let a = bag.length - 1; a > 0; a--) {
        const b = Math.floor(rng() * (a + 1));
        [bag[a], bag[b]] = [bag[b], bag[a]];
      }
      // A fresh bag never starts with the style the last miss used.
      const last = [...misses].reverse().find((_, k) => !intents[misses.length - 1 - k]);
      if (last && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    misses.push(intents[i] ? "wide" : bag.pop()!);
  }
  const sides = intents.map(() => (rng() < 0.5 ? -1 : 1) as 1 | -1);
  // ── Team-mates never miss the same way twice (v0.25, Harry's live test,
  // point 8) ── On the 0-0 path the miss bag refilled between the two
  // team-mates' kicks, so both could drag it wide; and a planned goal that
  // had to miss after all (rigIntent going off script) was always "wide".
  // Now the two team-mates' styles always differ and they go opposite ways.
  const [m1, m2] = MATE_KICK_INDEX;
  const other = (...not: (MissStyle | undefined)[]) => MISS_STYLES.find(m => !not.includes(m)) ?? MISS_STYLES[0];
  if (!intents[m1] && !intents[m2] && misses[m1] === misses[m2]) {
    misses[m2] = other(misses[m1], intents[m2 - 1] ? undefined : misses[m2 - 1]);
    const after = m2 + 1;
    if (after < misses.length && !intents[after] && misses[after] === misses[m2]) misses[after] = other(misses[m2], intents[m2 - 1] ? undefined : misses[m2 - 1]);
  }
  // A planned goal's fallback miss: unlike its team-mate's and the kick before.
  for (let i = 0; i < misses.length; i++) {
    if (!intents[i]) continue;
    const mate = (MATE_KICK_INDEX as readonly number[]).indexOf(i);
    misses[i] = other(mate >= 0 ? misses[MATE_KICK_INDEX[1 - mate]] : undefined, i > 0 ? misses[i - 1] : undefined);
  }
  sides[m2] = (-sides[m1]) as 1 | -1;
  return { intents, sides, misses, level };
}

/**
 * Should the automatic kick that is up now go in? The script's answer, unless
 * an earlier kick went against the script and following it would no longer
 * end level before your kick — then whichever result keeps level reachable.
 */
export function rigIntent(state: RigState, script: RigScript): boolean {
  const i = state.kicks.length;
  if (i >= SHOOTOUT_TOTAL - 1) return false;
  const planned = script.intents[i];
  const theirs = rigGoals(state.kicks, "them"), ours = rigGoals(state.kicks, "you");
  const side = rigNextSide(state.kicks);
  // Goals the rest of the script would add, after this kick.
  let restThem = 0, restUs = 0, leftThem = 0, leftUs = 0;
  for (let j = i + 1; j < SHOOTOUT_TOTAL - 1; j++) {
    if (j % 2 === 0) { leftThem++; if (script.intents[j]) restThem++; }
    else { leftUs++; if (script.intents[j]) restUs++; }
  }
  const endsLevel = (scores: boolean) => {
    const t = theirs + (side === "them" && scores ? 1 : 0) + restThem;
    const u = ours + (side === "you" && scores ? 1 : 0) + restUs;
    return t === u;
  };
  if (endsLevel(planned)) return planned;
  // Off script: keep level reachable with the kicks left after this one.
  const reachable = (scores: boolean) => {
    const d = (theirs + (side === "them" && scores ? 1 : 0)) - (ours + (side === "you" && scores ? 1 : 0));
    return d >= -leftThem && d <= leftUs;
  };
  if (reachable(planned)) return planned;
  return !planned;
}

/** Records the kick that was just taken. */
export function rigApply(state: RigState, scored: boolean): RigState {
  if (state.over) return state;
  const side = rigNextSide(state.kicks);
  const kicks = [...state.kicks, { side, scored }];
  const over = kicks.length >= SHOOTOUT_TOTAL;
  const yours = rigGoals(kicks, "you"), theirs = rigGoals(kicks, "them");
  return {
    kicks,
    over,
    winner: over ? (yours > theirs ? "you" : theirs > yours ? "them" : null) : null,
  };
}

/** Did your kick (the last) go in? `false` while unfinished or if it missed. */
export function winningPenaltyScored(state: RigState): boolean {
  if (!state.over) return false;
  const last = state.kicks[state.kicks.length - 1];
  return !!last && last.side === "you" && last.scored;
}

/** A rigged goal: along the grass into the corner, 0.35 m inside the post. */
export const RIG_GOAL_OFF = 3.3;
export const RIG_GOAL_POWER = 0.94;
export const RIG_GOAL_CONTACT = -0.8;
/** Rigged misses, by style (metres off centre, power, contact at technique 60). */
export const RIG_MISS: Record<MissStyle, { off: number; power: number; cy: number }> = {
  /** Along the grass, 1.5 m past the post. */
  wide: { off: 5.2, power: 0.75, cy: 0 },
  /** Leaned back on: high and wide of the post. */
  skied: { off: 4.4, power: 0.85, cy: 0.6 },
  /** Inside the posts, over the bar. */
  over: { off: 3.3, power: 1.0, cy: 1 },
};
/** The old names, kept for anything still reading them. */
export const RIG_MISS_OFF = RIG_MISS.wide.off;
export const RIG_MISS_POWER = RIG_MISS.wide.power;

/**
 * The plan an automatic kick is struck with. `techniqueOfTaker` is his rating
 * (the engine turns it into accuracy and the contact into a height —
 * `sameHeight` is the same correction every planned penalty gets).
 */
export function rigPlanFor(scores: boolean, side: 1 | -1, techniqueOfTaker: number, miss: MissStyle = "wide"): PenaltyPlan {
  if (scores) {
    return { style: "placed", off: side * RIG_GOAL_OFF, power: RIG_GOAL_POWER, cy: sameHeight(RIG_GOAL_CONTACT, techniqueOfTaker) };
  }
  const m = RIG_MISS[miss];
  return { style: "placed", off: side * m.off, power: m.power, cy: sameHeight(m.cy, techniqueOfTaker) };
}

/**
 * The keeper's read for an automatic kick: on a rigged goal he still dives (so
 * it looks like a save that did not come off) but guesses the corner wrong.
 */
export function rigKeeperRead<R extends { readChance: number }>(scores: boolean, read: R): R {
  return scores ? { ...read, readChance: 0 } : read;
}

/** How a rigged miss reads, for the line under the pitch. */
export const MISS_LINE: Record<MissStyle, string> = {
  wide: "Dragged wide!",
  skied: "Skied it, high and wide!",
  over: "Over the bar!",
};

// ── Everybody runs up his own way (Harry, 2 Oct 2026) ─────────────────────
//
// "Everyone does a Bruno run-up … you could explain players have different
// run-ups for each one." The match picks a taker's run-up from his id
// (runupStyles.ts's `takerPenaltyRunup`), so the shootout picks the run-ups
// first — five different ones out of the seven, in a seeded order — and then
// gives each taker an id that maps to his.

/** `n` different penalty run-ups (n ≤ 7), in an order seeded per save. */
export function pickRunups(seed: number, n: number): PenaltyRunupId[] {
  const rng = mulberry32((seed ^ 0x2a11) >>> 0);
  const all = PENALTY_RUNUPS.map(s => s.id);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.max(0, Math.min(all.length, n)));
}

/** An id starting `base` that the match turns into exactly this run-up. */
export function idForRunup(base: string, wanted: PenaltyRunupId): string {
  for (let i = 0; i < 500; i++) {
    const id = `${base}-${i}`;
    if (takerPenaltyRunup(id) === wanted) return id;
  }
  return base;
}
