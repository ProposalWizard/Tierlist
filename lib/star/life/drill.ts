/**
 * DEN'S HUNDRED — the drill's plan (Events v2, the kit man arc). Pure, no React.
 *
 * Harry, 20 Nov 2026, on the first version: "the drill is boring and
 * continuous, no one's doing 100 of those shots and also no one's missing."
 * So: ten balls, each one different (where it comes from, how far, a volley,
 * a keeper for the last three), small targets low in the corners, a line from
 * Den after every ball, a streak, and the last ball double or nothing.
 * "A hundred" is Den's joke: each ball counts ten.
 *
 * The real game is ActivityHost on the match engine (EngineFeature). This file
 * is what both it and the dice stand-in read: the feeds, the target, the
 * points, and what Den says. The dice (a device that cannot run the drill, a
 * skipped Thursday, the soak) roll each ball against its own difficulty, so
 * the rolled score spread matches what a normal player gets on the pitch.
 */

/** A ball counts when it crosses the line inside one of the two targets: this low, this close to a post. */
export const TARGET_LOW = 1.0;
export const TARGET_WIDTH = 1.4;

export interface Feed {
  /** Two words, shown before the ball comes. */
  label: string;
  /** Where the ball sits across the pitch, metres from the middle (minus = your left). */
  x: number;
  /** Metres out. */
  dist: number;
  /** A keeper is in goal for this one. */
  keeper?: boolean;
  /** Den chips it up: the match's own volley (aerial). */
  volley?: boolean;
  /** How much harder than the first ball (the dice take it off the chance). */
  diff: number;
  /** The last ball: hit it and it counts twenty; miss it and ten come off. */
  double?: boolean;
  /** What Den says as he feeds it. */
  call: string;
}

/** The ten balls (12 m night). A further-out night moves every ball back. */
export const HUNDRED_FEEDS: Feed[] = [
  { label: "Rolled square", x: -1.2, dist: 12, diff: 0, call: "Easy one first." },
  { label: "From the right", x: 4.5, dist: 13, diff: 0.06, call: "Coming from the other side." },
  { label: "Tight angle", x: -8.5, dist: 10, diff: 0.2, call: "Out wide. Find the far corner." },
  { label: "Edge of box", x: 1.5, dist: 16, diff: 0.12, call: "Step back to the edge of the box." },
  { label: "Other side", x: 7.5, dist: 11, diff: 0.16, call: "Now the right, tight." },
  { label: "On the volley", x: 0, dist: 11, volley: true, diff: 0.25, call: "I'll chip this one up." },
  { label: "Further out", x: -2, dist: 20, diff: 0.22, call: "Twenty yards. Keep it down." },
  { label: "Keeper in", x: -3, dist: 12, keeper: true, diff: 0.22, call: "The young keeper's stayed out. He's in." },
  { label: "Keeper again", x: 3.5, dist: 13, keeper: true, diff: 0.24, call: "He's got your number now." },
  { label: "Double or nothing", x: 0.5, dist: 11, keeper: true, double: true, diff: 0.26, call: "Last one. Double or nothing." },
];

export function feedsFor(extraDist = 0): Feed[] {
  return HUNDRED_FEEDS.map((f) => ({ ...f, dist: f.dist + extraDist }));
}

/** Points for the balls so far: ten each; the last is double or nothing (hit it: twenty;
 *  miss it: ten off). A hundred is the most there is: it is Den's hundred. */
export function pointsOf(hits: boolean[], feeds: Feed[] = HUNDRED_FEEDS): number {
  const p = hits.reduce((a, h, i) => a + (feeds[i]?.double ? (h ? 20 : -10) : h ? 10 : 0), 0);
  return Math.max(0, Math.min(100, p));
}

/** How a ball ended, as Den sees it. */
export type BallEnd = "hit" | "post" | "wide" | "over" | "central" | "saved" | "high";

/** Den's line after a ball. `streak` = hits in a row before this one. */
export function denAfter(end: BallEnd, streak: number, i: number, feeds: Feed[] = HUNDRED_FEEDS): string {
  const last = !!feeds[i]?.double;
  if (end === "hit") {
    if (last) return "\"Twenty. Told you it was double.\"";
    if (streak + 1 >= 4) return "\"Four in a row. Stop counting, I'll do that.\"";
    if (streak + 1 === 3) return "\"That's three on the bounce, so don't think about it.\"";
    return ["\"Ten.\"", "\"Low and hard, that's it.\"", "\"Better. Same again.\"", "\"In the corner.\""][i % 4];
  }
  if (streak >= 3) return "\"There it is. You started thinking.\"";
  if (last) return "\"That's ten off, then. You looked up.\"";
  switch (end) {
    case "post": return "\"Off the post, and that's nowt.\"";
    case "wide": return "\"Wide. You opened your body.\"";
    case "over": return "\"Over. Get your knee over it.\"";
    case "high": return "\"In, but too high. A keeper eats that.\"";
    case "central": return "\"In, but he'd have saved that one.\"";
    case "saved": return "\"He's read you.\"";
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
