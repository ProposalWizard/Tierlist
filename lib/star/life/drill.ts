/**
 * DEN'S HUNDRED — the drill's plan (Events v2, the kit man arc). Pure, no React.
 *
 * Harry, 20 Nov 2026, on the first version: "the drill is boring and
 * continuous, no one's doing 100 of those shots and also no one's missing."
 * On the second (ten varied balls, small targets): "the worst thing of the kit
 * man is the drill, I think it's a chance to be creative, also make sure it's
 * the main engine."
 *
 * So v3 is a little game with Den in it: ten balls in six rounds, each round a
 * different thing to do under one shed light.
 *   1. Call it       (2) he shouts a corner as he rolls it; hit that one, low.
 *   2. The bar       (1) hit the crossbar; he has a fiver on it.
 *   3. Old tricks    (2) through the tyre hung from the bar, then the bucket.
 *   4. Den in goal   (2) "I kept for the reserves in '89": the real keeper, slow and short.
 *   5. Lights out    (2) the shed light goes; he shouts a side in the dark.
 *   6. Double or nowt(1) light back, Den in goal: twenty, or ten off.
 * Each ball you get counts ten, so Den's voiced counts ("Ten." … "And a
 * hundred.") still fit, and the score out of a hundred still picks his line.
 *
 * The real game is ActivityHost on the match engine (EngineFeature →
 * CanvasMatch). This file is what both it and the dice stand-in read: the
 * balls, the targets, how a ball is judged, the points, and what Den says.
 * The dice (a device that cannot run the drill, a skipped Thursday, the soak)
 * roll each ball against its own difficulty.
 */
import { GOAL_H, POST_L, POST_R } from "../pitch";

/** A low corner: under this height, within this of a post. */
export const TARGET_LOW = 1.0;
export const TARGET_WIDTH = 1.4;

export type Side = "L" | "R";

/** What a ball has to do. */
export type Target =
  /** Low in the corner Den called (under 1 m, within 1.4 m of that post). */
  | { kind: "corner"; side: Side }
  /** Anywhere in the half Den shouted, under the bar (in the dark). */
  | { kind: "half"; side: Side }
  /** Off the crossbar. */
  | { kind: "bar" }
  /** Through the tyre: the ball crosses the line within r of its middle. */
  | { kind: "tyre"; x: number; z: number; r: number }
  /** The bucket on the line: crosses low (under 0.7 m) within w of it. */
  | { kind: "bucket"; x: number; w: number }
  /** Past the keeper: a goal anywhere. */
  | { kind: "past" };

export type RoundId = "call" | "bar" | "tricks" | "keeper" | "dark" | "double";

export interface Feed {
  round: RoundId;
  /** Two or three words, shown before the ball comes. */
  label: string;
  /** Where the ball sits across the pitch, metres from the middle (minus = your left). */
  x: number;
  /** Metres out. */
  dist: number;
  target: Target;
  /** Den in goal: the match's own keeper, weak and slow (strength, and how much of his reach). */
  keeper?: { strength: number; reach: number };
  /** The shed light: on, or out (it goes as the ball comes; he shouts the side in the dark). */
  dark?: boolean;
  /** How much harder than an easy ball (the dice take it off the chance). */
  diff: number;
  /** The last ball: hit it and it counts twenty; miss it and ten come off. */
  double?: boolean;
  /** What Den says as he sets it up. */
  call: string;
  /** A voiced clip of exactly that line (public/star/life/voice/hundred-balls; never regenerated). */
  voice?: string;
}

export interface Round { id: RoundId; name: string; line: string }

/** The six rounds, in order: the card shown before each one's first ball. */
export const ROUNDS: Round[] = [
  { id: "call", name: "Call it", line: "I shout a corner as I roll it. You hit that one, low." },
  { id: "bar", name: "The bar", line: "Hit the crossbar. I've a fiver says you can't." },
  { id: "tricks", name: "Old tricks", line: "Same tyre since '94. Through it, then knock my bucket over." },
  { id: "keeper", name: "Den in goal", line: "I kept for the reserves in '89. Mind my knees." },
  { id: "dark", name: "Lights out", line: "The groundsman's timer. When it goes, I shout the corner." },
  { id: "double", name: "Double or nowt", line: "Last one, and I'm in goal. Twenty, or ten off." },
];

const TYRE = { x: POST_L + 0.95, z: 1.6, r: 0.55 };
const BUCKET = { x: POST_R - 0.65, w: 0.6 };

/** The ten balls (12 m night). The sides Den calls change night to night (`seedSides`). */
export const HUNDRED_FEEDS: Feed[] = [
  { round: "call", label: "Call it", x: -1, dist: 12, target: { kind: "corner", side: "L" }, diff: 0.08, call: "Left. Low." },
  { round: "call", label: "Call it again", x: 2.5, dist: 13, target: { kind: "corner", side: "R" }, diff: 0.16, call: "Right!" },
  { round: "bar", label: "The bar", x: 0, dist: 15, target: { kind: "bar" }, diff: 0.18, call: "A fiver on the bar." },
  { round: "tricks", label: "The tyre", x: -2, dist: 11, target: { kind: "tyre", ...TYRE }, diff: 0.28, call: "Through the tyre." },
  { round: "tricks", label: "The bucket", x: 2, dist: 11, target: { kind: "bucket", ...BUCKET }, diff: 0.16, call: "Knock my bucket over." },
  { round: "keeper", label: "Den in goal", x: -1.5, dist: 12, keeper: { strength: 55, reach: 0.92 }, target: { kind: "past" }, diff: 0.04, call: "Aye, go on.", voice: "b3-thursdays.t-soup.say0.q0" },
  { round: "keeper", label: "He's warm now", x: 3, dist: 13, keeper: { strength: 60, reach: 0.95 }, target: { kind: "past" }, diff: 0.08, call: "I'm warm now." },
  { round: "dark", label: "Lights out", x: 0.5, dist: 12, dark: true, target: { kind: "corner", side: "R" }, diff: 0.28, call: "Listen for me." },
  { round: "dark", label: "Still dark", x: -2, dist: 12, dark: true, target: { kind: "corner", side: "L" }, diff: 0.26, call: "Again. Listen." },
  { round: "double", label: "Double or nowt", x: 0.5, dist: 12, keeper: { strength: 50, reach: 0.9 }, double: true, target: { kind: "past" }, diff: 0.26, call: "Last one. Double or nothing." },
];

/** Den's calls change night to night: each "call it" and "lights out" side is his pick. */
function seedSides(feeds: Feed[], seed: number): Feed[] {
  let s = (seed | 0) ^ 0x5bd1e995;
  const flip = () => { s = Math.imul(s ^ (s >>> 13), 0x5bd1e995); s ^= s >>> 15; return (s & 1) === 1; };
  return feeds.map((f) => {
    if (f.target.kind !== "corner" && f.target.kind !== "half") return f;
    const side: Side = flip() ? "L" : "R";
    const call = f.round === "call" ? (side === "L" ? (f.label === "Call it" ? "Left. Low." : "Left!") : (f.label === "Call it" ? "Right. Low." : "Right!")) : f.call;
    return { ...f, target: { ...f.target, side }, call };
  });
}

export function feedsFor(extraDist = 0, seed?: number): Feed[] {
  const base = HUNDRED_FEEDS.map((f) => ({ ...f, dist: f.dist + extraDist }));
  return seed === undefined ? base : seedSides(base, seed);
}

/** In the dark Den shouts the side as the light goes ("Right." is his own voiced word). */
export function shoutOf(f: Feed): { text: string; voice?: string } | null {
  if (!f.dark || (f.target.kind !== "half" && f.target.kind !== "corner")) return null;
  return f.target.side === "R" ? { text: "Right.", voice: "b1-the-offer.n2.say0.c0" } : { text: "Left!" };
}

/** Points for the balls so far: ten each; the last is double or nothing (hit it: twenty;
 *  miss it: ten off). A hundred is the most there is: it is Den's hundred. */
export function pointsOf(hits: boolean[], feeds: Feed[] = HUNDRED_FEEDS): number {
  const p = hits.reduce((a, h, i) => a + (feeds[i]?.double ? (h ? 20 : -10) : h ? 10 : 0), 0);
  return Math.max(0, Math.min(100, p));
}

/** How a ball ended, as Den sees it. */
export type BallEnd = "hit" | "post" | "wide" | "over" | "central" | "saved" | "high" | "wrong" | "under-bar" | "missed-it";

/** Where the ball crossed the goal line (x across, z height; null = it never got there),
 *  whether it struck the bar on the way, and the match's own outcome word. */
export interface BallSeen { cross: { x: number; z: number } | null; bar: boolean; outcome: string }

const inGoal = (c: { x: number; z: number }) => c.x > POST_L && c.x < POST_R && c.z < GOAL_H;

/** Judge one ball against its target: the one rule both the pitch and the tests use. */
export function judge(f: Feed, seen: BallSeen): BallEnd {
  const t = f.target;
  const c = seen.cross;
  const saved = seen.outcome === "saved" || seen.outcome === "caught" || seen.outcome === "tipped";
  if (t.kind === "bar") {
    if (seen.bar) return "hit";
    if (c && inGoal(c)) return "under-bar";
    return c && c.z >= GOAL_H ? "over" : "wide";
  }
  if (saved) return "saved";
  if (!c) return seen.outcome === "post" ? "post" : "wide";
  if (c.x <= POST_L || c.x >= POST_R) return seen.outcome === "post" ? "post" : "wide";
  if (c.z >= GOAL_H) return seen.bar ? "post" : "over";
  const mid = (POST_L + POST_R) / 2;
  switch (t.kind) {
    case "past": return "hit";
    case "half": return (t.side === "L" ? c.x < mid : c.x > mid) ? "hit" : "wrong";
    case "corner": {
      const near = t.side === "L" ? c.x <= POST_L + TARGET_WIDTH : c.x >= POST_R - TARGET_WIDTH;
      if (near && c.z <= TARGET_LOW) return "hit";
      if (!near && (t.side === "L" ? c.x > mid : c.x < mid)) return "wrong";
      return near ? "high" : "central";
    }
    case "tyre": return Math.hypot(c.x - t.x, c.z - t.z) <= t.r ? "hit" : "missed-it";
    case "bucket": return Math.abs(c.x - t.x) <= t.w && c.z <= 0.7 ? "hit" : "missed-it";
  }
}

/** Den's line after a ball. `streak` = hits in a row before this one. */
export function denAfter(end: BallEnd, streak: number, i: number, feeds: Feed[] = HUNDRED_FEEDS): string {
  const f = feeds[i];
  const last = !!f?.double;
  const round = f?.round;
  if (end === "hit") {
    if (last) return "\"Twenty. Told you it was double.\"";
    if (streak + 1 >= 4) return "\"Four on the bounce. Stop counting, I'll do that.\"";
    if (streak + 1 === 3) return "\"That's three in a row, so don't think about it.\"";
    switch (round) {
      case "bar": return "\"Ding. There goes my fiver.\"";
      case "tricks": return f.target.kind === "tyre" ? "\"Through the tyre! Thirty years that's hung there.\"" : "\"Bucket's over. I'll fill it again.\"";
      case "keeper": return i % 2 ? "\"I never saw it. Honest.\"" : "\"Too quick for me, that.\"";
      case "dark": return "\"Heard me, hit it. That's the job.\"";
      default: return i % 2 ? "\"Right where I said.\"" : "\"Low and hard, that's it.\"";
    }
  }
  if (streak >= 3) return "\"There it is. You started thinking.\"";
  if (last) return end === "saved" ? "\"Saved it! Ten off, and I'm telling everyone.\"" : "\"That's ten off, then. You looked up.\"";
  switch (end) {
    case "wrong": return round === "dark" ? "\"Other side! Were you listening?\"" : "\"I said the other one.\"";
    case "under-bar": return "\"In, but I said the bar. My fiver's safe.\"";
    case "missed-it": return f?.target.kind === "tyre" ? "\"Round it, not through it.\"" : "\"Bucket's still standing.\"";
    case "post": return "\"Off the post, and that's nowt.\"";
    case "wide": return "\"Wide. You opened your body.\"";
    case "over": return round === "bar" ? "\"Over the bar, not on it.\"" : "\"Over. Get your knee over it.\"";
    case "high": return "\"In, but too high. A keeper eats that.\"";
    case "central": return "\"In, but he'd have saved that one.\"";
    case "saved": return round === "keeper" || last ? "\"Still got it! Sixty-three, me.\"" : "\"He's read you.\"";
  }
}

/** The chance a ball is a hit by the dice, from your technique and the ball's difficulty. */
export function hitChance(technique: number, f: Feed): number {
  return Math.max(0.06, Math.min(0.95, 0.5 + (technique - 45) / 60 - f.diff));
}

/** Roll a whole night: the dice stand-in for the real drill. */
export function rollHundred(technique: number, rng: () => number, extraDist = 0): { score: number; tens: number; hits: boolean[] } {
  const feeds = feedsFor(extraDist);
  // Further out is harder: two points off the chance per extra metre.
  const hits = feeds.map((f) => rng() < hitChance(technique - extraDist * 2, f));
  return { score: hits.filter(Boolean).length, tens: pointsOf(hits, feeds), hits };
}
