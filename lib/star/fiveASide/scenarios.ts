/**
 * FIVE-A-SIDE SCENARIOS — the fixed chances, shared by the Scenario gallery's
 * Five-a-side tab and the five-a-side test area (/star-fiveaside-dev).
 *
 * Harry, 19 Oct 2026: bring five-a-side back "as its own test area … with
 * scenarios". The gallery already had the five-a-side chance pictures
 * (`fiveChanceWorld`, seeds 3000–3009). They moved here, unchanged, so the
 * gallery and the test area read the SAME pictures rather than two copies.
 *
 * Three ways to play each picture, the three kinds of chance a real
 * five-a-side match has (see FiveASide.tsx):
 *  - "yours" — the ball at your feet: tap a team-mate to pass, or drag to shoot.
 *  - "mate"  — the same picture with a team-mate on the ball: you watch him.
 *  - "them"  — the same picture turned round: they attack your goal, and you
 *              get the one tap of the brace window.
 *
 * Pure: no engine physics here. A scenario is just a match state to resume
 * from; the five-a-side screen plays it.
 */
import { mulberry32 } from "../season";
import type { Vec2 } from "../canvasEngine";
import type { FiveWorld } from "./passage";
import { mirror } from "./geometry";
import { FIVE_A_SIDE } from "./rules";
import { newFlow, bandOf } from "./flow";
import { newFiveMatch, type FiveMatchState } from "./match";

/** Moves an input position by up to `a` metres either way. The gallery's own
 *  `J`, shared so its shape pictures and these chances jitter the same way. */
export const jitter = (rng: () => number, v: number, a: number) => v + (rng() * 2 - 1) * a;

/** The ten fixed chance pictures. 3000 is the gallery's original spread. */
export const FIVE_CHANCE_SEEDS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];

/** A fixed 5-a-side world with the ball in the last third, for a chance.
 *  (Moved from app/star-gallery-dev/page.tsx; byte-for-byte the same.) */
export function fiveChanceWorld(seed: number): FiveWorld {
  const J = jitter;
  const on = seed === 3000 ? 0 : 1;
  const rng = mulberry32(seed + 3);
  return {
    ball: { x: J(rng, 30, 3 * on), y: J(rng, 9, 2 * on) },
    you: { x: J(rng, 32, 3 * on), y: J(rng, 9.5, 2 * on) },
    mates: [
      { x: J(rng, 26, 3 * on), y: J(rng, 6, 2 * on) },
      { x: J(rng, 38, 3 * on), y: J(rng, 7, 2 * on) },
      { x: J(rng, 34, 3 * on), y: J(rng, 3.5, 1.5 * on) },
    ],
    yourKeeper: { x: 34, y: 33 },
    opps: [
      { x: J(rng, 31, 3 * on), y: J(rng, 4.5, 1.5 * on) },
      { x: J(rng, 37, 3 * on), y: J(rng, 5.5, 1.5 * on) },
      { x: J(rng, 27, 3 * on), y: J(rng, 8, 2 * on) },
      { x: J(rng, 34, 3 * on), y: J(rng, 2.5, 1 * on) },
    ],
    theirKeeper: { x: 34, y: 1.2 },
  };
}

export type FiveScenarioKind = "yours" | "mate" | "them";

export const FIVE_SCENARIO_KINDS: { key: FiveScenarioKind; label: string; short: string; line: string }[] = [
  { key: "yours", label: "Your chance", short: "Yours", line: "The ball is at your feet. Tap a team-mate to pass, or drag back from the ball to shoot." },
  { key: "mate", label: "Team-mate's chance", short: "Team-mate's", line: "The same picture, a team-mate on the ball. Watch him take it." },
  { key: "them", label: "Their attack", short: "Theirs", line: "The same picture turned round: they attack your goal. Tap a man to block, or the goal to send your keeper." },
];

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The world each kind plays from.
 *  - yours: the gallery picture as it is.
 *  - mate: you swap places with the team-mate nearest the ball, so HE is on it
 *    (`buildMateAttack` gives the chance to the mate nearest the ball).
 *  - them: the picture turned round (`mirror`) with the sides swapped — your
 *    four become their four, their keeper yours. Their man on the ball stands
 *    where you stood.
 */
export function scenarioWorld(kind: FiveScenarioKind, seed: number): FiveWorld {
  const w = fiveChanceWorld(seed);
  if (kind === "yours") return w;
  if (kind === "mate") {
    let near = 0;
    w.mates.forEach((m, i) => { if (dist(m, w.ball) < dist(w.mates[near], w.ball)) near = i; });
    const mates = w.mates.map((m) => ({ ...m })) as FiveWorld["mates"];
    const you = { ...mates[near] };
    // The mate takes your spot beside the ball; you take his.
    mates[near] = { ...w.you };
    return { ...w, you, mates };
  }
  const m = (p: Vec2) => mirror(p);
  return {
    ball: m(w.ball),
    // Your four now: their four, turned round.
    you: m(w.opps[0]),
    mates: [m(w.opps[1]), m(w.opps[2]), m(w.opps[3])],
    yourKeeper: m(w.theirKeeper),
    // Their four: you and your three, turned round. You stood by the ball.
    opps: [m(w.you), m(w.mates[0]), m(w.mates[1]), m(w.mates[2])],
    theirKeeper: m(w.yourKeeper),
  };
}

/**
 * A match state that is waiting for exactly this chance. The five-a-side
 * screen resumes from it (`resumeFrom`), so the chance is built, struck and
 * stepped by the screen's own code, the same as in a real five-a-side match.
 */
export function scenarioState(kind: FiveScenarioKind, seed: number): FiveMatchState {
  const world = scenarioWorld(kind, seed);
  const base = newFiveMatch(seed, FIVE_A_SIDE);
  const possession = kind === "them" ? "them" : "you";
  return {
    ...base,
    world,
    possession,
    restart: "open-play",
    flow: { ...newFlow(possession === "you"), band: bandOf(FIVE_A_SIDE, world.ball.y) },
    awaiting: kind === "yours" ? "passage" : kind === "mate" ? "mate" : "opp",
    log: [FIVE_SCENARIO_KINDS.find((k) => k.key === kind)?.label ?? "Scenario"],
  };
}

/** "Your chance 3" — the name shown on screen and in the numbers. */
export function scenarioName(kind: FiveScenarioKind, seed: number): string {
  const label = FIVE_SCENARIO_KINDS.find((k) => k.key === kind)?.label ?? kind;
  return `${label} ${FIVE_CHANCE_SEEDS.indexOf(seed) + 1}`;
}

/**
 * The screen seed for roll k (0, 1, 2 …) of a scenario picture. The test
 * area's "Again" moves to the next roll; the numbers (scripts/fiveaside-data)
 * play rolls 0, 1, 2 … with the same seeds, so roll k is the same dice there
 * and on screen.
 */
export function scenarioRollSeed(pictureSeed: number, k: number): number {
  return pictureSeed * 100 + k;
}
