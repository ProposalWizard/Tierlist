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
 * v4 (this one): Den's own night is ten DIFFERENT balls, each a different thing a kit man
 * would set up, every one on the real engine's own ball (EngineFeature): a volley off his
 * throw, a header off his lob, a first-time finish off his cut-back, a half-volley inside a
 * post, a chip over the dummy (a real blocker, the engine's own block rule), the skip (drop
 * it in, not the net), the crossbar, then Den in goal twice and double or nowt. Den stands
 * on the pitch, drawn by the match's own figure at the match's own scale.
 *
 * Since 20 Nov 2026 (Harry: "there should be hundreds of things like this") the rounds are a
 * LIBRARY (ROUND_LIBRARY) any story's "challenge" activity picks from (dials.rounds), with its
 * own words (calls, round lines, reaction lines) and its own person in goal; Den's hundred is
 * one list of them (HUNDRED_ROUNDS). How to use it: lib/star/life/README.md.
 *
 * The real game is ActivityHost on the match engine (EngineFeature →
 * CanvasMatch). This file is what both it and the dice stand-in read: the
 * balls, the targets, how a ball is judged, the points, and what Den says.
 * The dice (a device that cannot run the drill, a skipped Thursday, the soak)
 * roll each ball against its own difficulty.
 */
import { CX, GOAL_H, POST_L, POST_R } from "../pitch";

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
  | { kind: "past" }
  /** In the net, anywhere under the bar (nobody in goal). */
  | { kind: "net" }
  /** Inside either post: within 1.4 m of a post, under the bar. */
  | { kind: "either" }
  /** In the skip: the ball comes down into it (its first fall through SKIP_H inside the box). */
  | { kind: "skip"; x: number; y: number; w: number; l: number };

/** The skip's sides: the ball has to come down through this height inside it. */
export const SKIP_H = 1.0;

/** The library of rounds any story's challenge can use (lib/star/life/README.md). */
export type RoundKind =
  | "call-it"     // he shouts a corner as he feeds; hit that one, low
  | "crossbar"    // hit the bar
  | "props"       // the tyre hung from the bar, then the bucket on the line
  | "keeper"      // the named person goes in goal (the match's own keeper, weak and slow)
  | "lights-out"  // the light goes; he shouts the corner in the dark
  | "double"      // the last ball, the named person in goal: twenty, or ten off
  | "corners"     // a plain ball, low in a corner (either)
  | "far"         // from twenty yards, low in a corner
  // v4, Den's own night (each one the real engine's own ball):
  | "volley"      // he throws it up: hit it before it lands (the match's volley)
  | "header"      // he lobs it in: head it (the match's header)
  | "cutback"     // he rolls it back from the byline: first time, far corner
  | "half-volley" // he drops it: on the bounce, inside a post
  | "chip"        // the dummy stands in the way (a real blocker): chip it
  | "skip";       // the skip in the six-yard box: drop it in

/** @deprecated the v3 drill's names for its rounds; kept so old callers read. */
export type RoundId = RoundKind;

export interface Feed {
  /** Which kind of round this ball belongs to. */
  round: RoundKind;
  /** Which round of the challenge (0-based): the card shows before each round's first ball. */
  roundNo: number;
  /** Two or three words, shown before the ball comes ({name} = the person in goal). */
  label: string;
  /** Where the ball sits across the pitch, metres from the middle (minus = your left). */
  x: number;
  /** Metres out. */
  dist: number;
  target: Target;
  /** Someone in goal: the match's own keeper, weak and slow (strength, and how much of his reach). */
  keeper?: { strength: number; reach: number };
  /** The light: out for this ball (it goes as the ball comes; he shouts the side in the dark). */
  dark?: boolean;
  /** How much harder than an easy ball (the dice take it off the chance). */
  diff: number;
  /** The last ball: hit it and it counts twenty; miss it and ten come off. */
  double?: boolean;
  /** What he says as he sets it up. */
  call: string;
  /** A voiced clip of exactly that line (played only if its speaker is in the story; voice.ts). */
  voice?: string;
  /** Which of the match's own balls this is: on the volley, a header, or at your feet (default). */
  engine?: "volley" | "header" | "ground";
  /** A ball rolled to you (the strike screen's moving ball): the cut-back. */
  rolling?: boolean;
  /** The dummy in the way (metres in front of the ball, toward goal): a real blocker. */
  dummy?: number;
  /** Where the feeder stands, from the ball (metres across, metres toward goal); drawn on the pitch. */
  feeder?: { dx: number; dy: number };
}

/** A round as the screen shows it: its name and his line on the round's card. */
export interface Round { id: string; kind: RoundKind; name: string; line: string }

/** A story's pick of a round (an activity's `dials.rounds`). Everything but `kind` is optional. */
export interface RoundSpec {
  kind: RoundKind;
  /** How many balls (default: the round's own; the whole challenge is at most ten). */
  balls?: number;
  /** The round card's name and his line on it ({name} = the person in goal). */
  name?: string;
  line?: string;
  /** His words before each ball, in order (the last repeats). */
  calls?: string[];
  /** Voiced clips of those words, in the same order. */
  voices?: (string | null)[];
}

const TYRE = { x: POST_L + 0.95, z: 1.6, r: 0.55 };
/** The skip: in the six-yard box, a touch left of centre (clear of the target card on a phone),
 *  3 m by 1.8 m (a small builder's skip). */
const SKIP = { x: CX - 0.8, y: 4.2, w: 1.5, l: 0.9 };
const BUCKET = { x: POST_R - 0.65, w: 0.6 };
type Ball = Omit<Feed, "round" | "roundNo">;

/** Each round's card and its balls (k = the ball's place in the round). */
export const ROUND_LIBRARY: Record<RoundKind, { name: string; line: string; balls: number; ball: (k: number) => Ball; maxDist?: number }> = {
  "call-it": {
    name: "Call it", line: "I shout a corner as I roll it. You hit that one, low.", balls: 2,
    ball: (k) => k === 0
      ? { label: "Call it", x: -1, dist: 12, target: { kind: "corner", side: "L" }, diff: 0.08, call: "Left. Low." }
      : { label: "Call it again", x: k % 2 ? 2.5 : -2, dist: 13, target: { kind: "corner", side: "R" }, diff: 0.16, call: "Right!" },
  },
  crossbar: {
    name: "The bar", line: "Hit the crossbar.", balls: 1,
    ball: (k) => ({ label: k ? "The bar again" : "The bar", x: k % 2 ? 1.5 : 0, dist: 15, target: { kind: "bar" }, diff: 0.18, call: "On the bar." }),
  },
  props: {
    name: "Old tricks", line: "Through the tyre, then knock the bucket over.", balls: 2,
    ball: (k) => k % 2 === 0
      ? { label: "The tyre", x: -2, dist: 11, target: { kind: "tyre", ...TYRE }, diff: 0.28, call: "Through the tyre." }
      : { label: "The bucket", x: 2, dist: 11, target: { kind: "bucket", ...BUCKET }, diff: 0.16, call: "Knock the bucket over." },
  },
  keeper: {
    name: "{name} in goal", line: "I'll go in. Mind my knees.", balls: 2,
    ball: (k) => k === 0
      ? { label: "{name} in goal", x: -1.5, dist: 12, keeper: { strength: 55, reach: 0.92 }, target: { kind: "past" }, diff: 0.04, call: "Go on, then." }
      : { label: "Warm now", x: k % 2 ? 3 : -2.5, dist: 13, keeper: { strength: 60, reach: 0.95 }, target: { kind: "past" }, diff: 0.08, call: "I'm warm now." },
  },
  "lights-out": {
    name: "Lights out", line: "When the light goes, I shout the corner.", balls: 2,
    ball: (k) => k === 0
      ? { label: "Lights out", x: 0.5, dist: 12, dark: true, target: { kind: "corner", side: "R" }, diff: 0.28, call: "Listen for me." }
      : { label: "Still dark", x: k % 2 ? -2 : 1.5, dist: 12, dark: true, target: { kind: "corner", side: "L" }, diff: 0.26, call: "Again. Listen." },
  },
  double: {
    name: "Double or nowt", line: "Last one, and I'm in goal. Twenty, or ten off.", balls: 1,
    ball: () => ({ label: "Double or nowt", x: 0.5, dist: 12, keeper: { strength: 50, reach: 0.9 }, double: true, target: { kind: "past" }, diff: 0.26, call: "Last one. Double or nothing." }),
  },
  corners: {
    name: "The corners", line: "Low in the corners.", balls: 2,
    ball: (k) => ({ label: k ? "Other corner" : "Low corner", x: k % 2 ? 2 : -1.5, dist: 12, target: { kind: "corner", side: k % 2 ? "R" : "L" }, diff: 0.1, call: "Low in the corner." }),
  },
  far: {
    name: "Twenty yards", line: "From out here. Keep it down.", balls: 1,
    ball: (k) => ({ label: "Twenty yards", x: k % 2 ? 2 : -2, dist: 20, target: { kind: "corner", side: k % 2 ? "R" : "L" }, diff: 0.24, call: "Keep it down." }),
  },
  volley: {
    name: "Off my throw", line: "I throw it up, you hit it before it lands.", balls: 1, maxDist: 16,
    ball: (k) => ({ label: k ? "Another volley" : "On the volley", x: k % 2 ? 1.5 : -1, dist: 13, engine: "volley", feeder: { dx: 2.4, dy: -2.6 }, target: { kind: "net" }, diff: 0.14, call: "Don't let it bounce." }),
  },
  header: {
    name: "Head it", line: "I'll lob it in. Use your forehead.", balls: 1, maxDist: 10,
    ball: (k) => ({ label: k ? "Another header" : "Head it", x: k % 2 ? 1 : 0, dist: 8, engine: "header", feeder: { dx: -3.2, dy: -1.8 }, target: { kind: "net" }, diff: 0.12, call: "Up it goes. Head it." }),
  },
  cutback: {
    name: "First time", line: "I roll it back from the byline. No touch. Far corner.", balls: 1, maxDist: 14,
    ball: (k) => ({ label: k ? "Another cut-back" : "The cut-back", x: 0.5, dist: 11, rolling: true, feeder: { dx: 5.2, dy: -8.4 }, target: { kind: "corner", side: "L" }, diff: 0.18, call: "First time. Far corner." }),
  },
  "half-volley": {
    name: "On the bounce", line: "I drop it, you hit it on the bounce. Inside a post.", balls: 1, maxDist: 18,
    ball: (k) => ({ label: k ? "Another bounce" : "Half-volley", x: k % 2 ? -1.5 : 1.5, dist: 14, engine: "volley", feeder: { dx: -2.2, dy: -1.6 }, target: { kind: "either" }, diff: 0.26, call: "On the bounce. Inside a post." }),
  },
  chip: {
    name: "The dummy", line: "The dummy's in the way. Go over him.", balls: 1,
    ball: (k) => ({ label: k ? "Over him again" : "Chip the dummy", x: k % 2 ? 1 : 0, dist: 14, dummy: 3.2, target: { kind: "net" }, diff: 0.26, call: "Over him. Not through him." }),
  },
  skip: {
    name: "The skip", line: "See the skip? In it. Not the net. The skip.", balls: 1,
    ball: () => ({ label: "Hit the skip", x: -1, dist: 15, target: { kind: "skip", ...SKIP }, diff: 0.36, call: "In the skip. Drop it in." }),
  },
};

/** A whole challenge from a story's rounds: its balls and its round cards. At most ten balls;
 *  a "double" only as the last round (validateArcs checks a story's list). */
export function challenge(specs: RoundSpec[], extraDist = 0, seed?: number): { feeds: Feed[]; rounds: Round[] } {
  const feeds: Feed[] = [];
  const rounds: Round[] = [];
  specs.forEach((sp, roundNo) => {
    const lib = ROUND_LIBRARY[sp.kind];
    if (!lib) return;
    rounds.push({ id: `r${roundNo}`, kind: sp.kind, name: sp.name ?? lib.name, line: sp.line ?? lib.line });
    const n = Math.max(1, sp.kind === "double" ? 1 : sp.balls ?? lib.balls);
    for (let k = 0; k < n && feeds.length < 10; k++) {
      const b = lib.ball(k);
      const call = sp.calls?.length ? sp.calls[Math.min(k, sp.calls.length - 1)] : b.call;
      const voice = sp.voices?.[k] ?? undefined;
      // A further-out night moves the ball back, but a header stays a header (each kind's own cap).
      const dist = Math.max(b.dist, Math.min(b.dist + extraDist, lib.maxDist ?? Infinity));
      feeds.push({ ...b, round: sp.kind, roundNo, dist, call, ...(voice ? { voice } : {}) });
    }
  });
  return { feeds: seed === undefined ? feeds : seedSides(feeds, seed), rounds };
}

/** Den's hundred (the kit man arc): ten different balls in nine rounds, in his words (v4).
 *  Easy first (his throw, his lob), hard in the middle (the dummy, the skip, the bar), then
 *  Den in goal to finish. */
export const HUNDRED_ROUNDS: RoundSpec[] = [
  { kind: "volley", line: "I throw it up, you hit it before it lands.", calls: ["Don't let it bounce."] },
  { kind: "header", line: "I'll lob it in. Forehead, not your nose.", calls: ["Up it goes. Head it."] },
  { kind: "cutback", line: "I roll it back from the byline. No touch. Far corner.", calls: ["First time. Far corner."] },
  { kind: "half-volley", line: "I drop it, you hit it on the bounce. Inside a post." },
  { kind: "chip", line: "The dummy's in the way. Over him, not through him.", calls: ["Over him."] },
  { kind: "skip", line: "See the skip? In it. Not the net. The skip.", calls: ["In the skip. Drop it in."] },
  { kind: "crossbar", line: "Hit the crossbar. I've a fiver says you can't.", calls: ["A fiver on the bar."] },
  { kind: "keeper", line: "I kept for the reserves in '89. Mind my knees.", calls: ["Aye, go on.", "I'm warm now."], voices: ["b3-thursdays.t-soup.say0.q0", null] },
  { kind: "double" },
];

const HUNDRED = challenge(HUNDRED_ROUNDS);
/** The round cards of Den's hundred (nine). */
export const ROUNDS: Round[] = HUNDRED.rounds;
/** The ten balls (12 m night). The sides he calls change night to night (`seedSides`). */
export const HUNDRED_FEEDS: Feed[] = HUNDRED.feeds;

/** His calls change night to night: each called corner's side is his pick. */
function seedSides(feeds: Feed[], seed: number): Feed[] {
  let s = (seed | 0) ^ 0x5bd1e995;
  const flip = () => { s = Math.imul(s ^ (s >>> 13), 0x5bd1e995); s ^= s >>> 15; return (s & 1) === 1; };
  return feeds.map((f) => {
    if (f.target.kind !== "corner" && f.target.kind !== "half") return f;
    if (f.round === "cutback") {
      // Some nights he rolls it from the other byline: the far corner and his spot swap.
      if (!flip()) return f;
      const side: Side = f.target.side === "L" ? "R" : "L";
      return { ...f, target: { ...f.target, side }, feeder: f.feeder ? { ...f.feeder, dx: -f.feeder.dx } : f.feeder };
    }
    if (f.round !== "call-it" && f.round !== "lights-out") return f;
    const side: Side = flip() ? "L" : "R";
    const call = f.round === "call-it" && /^(Left|Right)/.test(f.call) ? (side === "L" ? (f.label === "Call it" ? "Left. Low." : "Left!") : (f.label === "Call it" ? "Right. Low." : "Right!")) : f.call;
    return { ...f, target: { ...f.target, side }, call };
  });
}

/** Den's hundred's balls (a further-out night moves every ball back). */
export function feedsFor(extraDist = 0, seed?: number): Feed[] {
  return challenge(HUNDRED_ROUNDS, extraDist, seed).feeds;
}

/** In the dark he shouts the side as the light goes ("Right." is Den's own voiced word). */
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
export type BallEnd = "hit" | "post" | "wide" | "over" | "central" | "saved" | "high" | "wrong" | "under-bar" | "missed-it" | "in-net" | "blocked";

/** Where the ball crossed the goal line (x across, z height; null = it never got there),
 *  whether it struck the bar on the way, and the match's own outcome word. */
export interface BallSeen {
  cross: { x: number; z: number } | null; bar: boolean; outcome: string;
  /** Where the ball first came down through SKIP_H (pitch x, y), for the skip. */
  land?: { x: number; y: number } | null;
}

/** Did the ball come down into the skip? */
export function inSkip(t: Extract<Target, { kind: "skip" }>, land: { x: number; y: number } | null | undefined): boolean {
  return !!land && Math.abs(land.x - t.x) <= t.w && Math.abs(land.y - t.y) <= t.l;
}

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
  if (t.kind === "skip") {
    if (inSkip(t, seen.land)) return "hit";
    return c && inGoal(c) ? "in-net" : "missed-it";
  }
  if (saved) return "saved";
  if (!c) return seen.outcome === "post" ? "post" : seen.outcome === "blocked" ? "blocked" : "wide";
  if (c.x <= POST_L || c.x >= POST_R) return seen.outcome === "post" ? "post" : "wide";
  if (c.z >= GOAL_H) return seen.bar ? "post" : "over";
  const mid = (POST_L + POST_R) / 2;
  switch (t.kind) {
    case "past": case "net": return "hit";
    case "either": return (c.x <= POST_L + TARGET_WIDTH || c.x >= POST_R - TARGET_WIDTH) ? "hit" : "central";
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

/**
 * A story's own reaction lines (an activity's `dials.lines`), looked up before the defaults:
 * "<kind>:<end>" then "<end>" (ends: hit, post, wide, over, central, saved, high, wrong,
 * under-bar, missed-it), and "streak3", "streak4" (a hit that makes the streak), "broken" (a
 * miss after three or more), "double:hit", "double:miss". {name} = him, {age} = his age.
 */
export type ReactionLines = Partial<Record<string, string>>;

/** His line after a ball. `streak` = hits in a row before this one. */
export function denAfter(end: BallEnd, streak: number, i: number, feeds: Feed[] = HUNDRED_FEEDS, lines?: ReactionLines): string {
  const f = feeds[i];
  const last = !!f?.double;
  const round = f?.round;
  const own = (...keys: string[]) => { for (const k of keys) { const v = lines?.[k]; if (v) return v; } return null; };
  if (end === "hit") {
    if (last) return own("double:hit") ?? "\"Twenty. Told you it was double.\"";
    if (streak + 1 >= 4) return own("streak4") ?? "\"Four on the bounce. Stop counting, I'll do that.\"";
    if (streak + 1 === 3) return own("streak3") ?? "\"That's three in a row, so don't think about it.\"";
    const mine = own(`${round}:hit`, "hit");
    if (mine) return mine;
    switch (round) {
      case "crossbar": return "\"Ding. There goes my fiver.\"";
      case "props": return f.target.kind === "tyre" ? "\"Through the tyre! Thirty years that's hung there.\"" : "\"Bucket's over. I'll fill it again.\"";
      case "keeper": return i % 2 ? "\"I never saw it. Honest.\"" : "\"Too quick for me, that.\"";
      case "lights-out": return "\"Heard me, hit it. That's the job.\"";
      case "volley": return "\"Never touched the floor. Lovely.\"";
      case "header": return "\"Forehead. Told you.\"";
      case "cutback": return "\"First time, far corner. That's a goal on Saturday.\"";
      case "half-volley": return "\"Off the bounce and in. Sweet as you like.\"";
      case "chip": return "\"Over his head. He never saw it, and he's a dummy.\"";
      case "skip": return "\"In the skip! Thirty years and nobody's done that.\"";
      default: return i % 2 ? "\"Right where I said.\"" : "\"Low and hard, that's it.\"";
    }
  }
  if (streak >= 3) return own("broken") ?? "\"There it is. You started thinking.\"";
  if (last) return own("double:miss", `double:${end}`) ?? (end === "saved" ? "\"Saved it! Ten off, and I'm telling everyone.\"" : "\"That's ten off, then. You looked up.\"");
  const mine = own(`${round}:${end}`, end);
  if (mine) return mine;
  switch (end) {
    case "wrong": return round === "lights-out" ? "\"Other side! Were you listening?\"" : "\"I said the other one.\"";
    case "under-bar": return "\"In, but I said the bar. My fiver's safe.\"";
    case "missed-it": return f?.target.kind === "tyre" ? "\"Round it, not through it.\"" : f?.target.kind === "skip" ? "\"Skip's still empty. Drop it in, don't drive it.\"" : "\"Bucket's still standing.\"";
    case "in-net": return "\"In the net. I said the skip.\"";
    case "blocked": return "\"Straight into the dummy. Over him!\"";
    case "post": return "\"Off the post, and that's nowt.\"";
    case "wide": return round === "volley" || round === "half-volley" ? "\"Wide. Watch it onto your laces.\"" : round === "header" ? "\"Wide. Eyes open next time.\"" : "\"Wide. You opened your body.\"";
    case "over": return round === "crossbar" ? "\"Over the bar, not on it.\"" : "\"Over. Get your knee over it.\"";
    case "high": return "\"In, but too high. A keeper eats that.\"";
    case "central": return round === "half-volley" ? "\"In, but I said inside a post.\"" : "\"In, but he'd have saved that one.\"";
    case "saved": return round === "keeper" ? "\"Still got it! {age}, me.\"" : "\"He's read you.\"";
  }
}

/** The chance a ball is a hit by the dice, from your technique and the ball's difficulty. */
export function hitChance(technique: number, f: Feed): number {
  return Math.max(0.06, Math.min(0.95, 0.5 + (technique - 45) / 60 - f.diff));
}

/** Roll a whole night: the dice stand-in for the real drill (any challenge's rounds; Den's by default). */
export function rollHundred(technique: number, rng: () => number, extraDist = 0, rounds: RoundSpec[] = HUNDRED_ROUNDS): { score: number; tens: number; hits: boolean[] } {
  const feeds = challenge(rounds, extraDist).feeds;
  // Further out is harder: two points off the chance per extra metre.
  const hits = feeds.map((f) => rng() < hitChance(technique - extraDist * 2, f));
  return { score: hits.filter(Boolean).length, tens: pointsOf(hits, feeds), hits };
}

/** What the target card says for a ball: the words under "Aim here". Whoever is in goal is
 *  named (the card used to say "BEAT DEN" whoever was in goal). */
export function promptOf(f: Feed, keeper: string | null | undefined, shout?: string | null): string {
  const t = f.target;
  const who = (keeper && keeper.trim() && keeper.trim() !== "He" ? keeper.trim() : "the keeper").toUpperCase();
  if (f.dark) return shout ? `${shout.replace(/[.!]/g, "").toUpperCase()} CORNER, LOW` : "WAIT FOR HIS SHOUT";
  switch (t.kind) {
    case "corner": return `${f.round === "cutback" ? "FIRST TIME · " : ""}${t.side === "L" ? "LEFT" : "RIGHT"} CORNER, LOW`;
    case "half": return `${t.side === "L" ? "LEFT" : "RIGHT"} HALF`;
    case "bar": return "HIT THE CROSSBAR";
    case "tyre": return "THROUGH THE TYRE";
    case "bucket": return "KNOCK THE BUCKET";
    case "either": return "ON THE BOUNCE · INSIDE A POST";
    case "skip": return "DROP IT IN THE SKIP";
    case "net": return f.dummy ? "CHIP THE DUMMY" : f.engine === "header" ? "HEAD IT IN" : f.engine === "volley" ? "VOLLEY IT IN" : "IN THE NET";
    case "past": return f.double ? `BEAT ${who} · TWENTY OR TEN OFF` : `BEAT ${who}`;
  }
}
