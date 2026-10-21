/**
 * WHERE THE STAMINA BAR SITS (B14b, Harry, 21 Oct 2026: "move it").
 *
 * B14 put the bar top-left of the pitch. On a computer, with the goal on the
 * left (a side-on chance), it touched the goal net. The bar now picks one of
 * the pitch's four corners, the first one that covers nothing that matters:
 * the goal (posts, net and bar), the ball, and every man. It stays where it
 * is while that corner is still clear, and only moves when something comes
 * into it, so it does not hop about. Bottom corners are tried first: the goal
 * is at the top of an up-the-pitch picture.
 *
 * Pure: boxes in, a corner out. The match hands it the boxes (CanvasMatch).
 */

export type BarCorner = "bl" | "br" | "tl" | "tr";

/** A box on the glass, CSS px, canvas-local. */
export interface Box { x1: number; y1: number; x2: number; y2: number }

/** The bar's size (CSS px) and its gap from the pitch edge. */
export const BAR_W = 124;
export const BAR_H = 52;   // tall enough for the computer's "W A S D move · Shift sprint" line
export const BAR_INSET = 8;
/** Clear space kept around the bar (CSS px). */
export const BAR_MARGIN = 6;

/** The order corners are tried in. */
export const BAR_ORDER: BarCorner[] = ["bl", "br", "tl", "tr"];

/** The bar's box in a corner of a W x H pitch. `topPad`: extra room at the top (the added-time badge). */
export function barBox(c: BarCorner, W: number, H: number, topPad = 0): Box {
  const left = c === "bl" || c === "tl";
  const top = c === "tl" || c === "tr";
  const x1 = left ? BAR_INSET : W - BAR_INSET - BAR_W;
  const y1 = top ? BAR_INSET + topPad : H - BAR_INSET - BAR_H;
  return { x1, y1, x2: x1 + BAR_W, y2: y1 + BAR_H };
}

const overlaps = (a: Box, b: Box, m: number) =>
  a.x1 - m < b.x2 && b.x1 < a.x2 + m && a.y1 - m < b.y2 && b.y1 < a.y2 + m;

/** How many of `things` the bar would cover in corner `c`. */
export function barHits(c: BarCorner, W: number, H: number, things: Box[], topPad = 0): number {
  const b = barBox(c, W, H, topPad);
  let n = 0;
  for (const t of things) if (overlaps(b, t, BAR_MARGIN)) n++;
  return n;
}

/**
 * The corner for this frame. Keeps `current` while it covers nothing; else
 * the first clear corner in BAR_ORDER; if none is clear, the one covering
 * least (ties: BAR_ORDER). `important` boxes (the goal, the ball) count ten
 * times a man, so the bar would sooner sit on a man than on the goal.
 */
export function pickBarCorner(
  W: number, H: number,
  things: { box: Box; weight?: number }[],
  current: BarCorner | null,
  topPad = 0,
): BarCorner {
  const cost = (c: BarCorner) => {
    const b = barBox(c, W, H, topPad);
    let s = 0;
    for (const t of things) if (overlaps(b, t.box, BAR_MARGIN)) s += t.weight ?? 1;
    return s;
  };
  if (current && cost(current) === 0) return current;
  let best: BarCorner = BAR_ORDER[0], bestCost = Infinity;
  for (const c of BAR_ORDER) {
    const k = cost(c);
    if (k === 0) return c;
    if (k < bestCost) { best = c; bestCost = k; }
  }
  return best;
}
