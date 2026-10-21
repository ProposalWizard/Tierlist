/**
 * Where the lag-test pill sits when a match is on screen (Harry, 21 Oct 2026:
 * "during a 2D match it sits on the scoreboard and hides the score").
 *
 * `keep` is the match's box on screen: its scoreboard down to the bottom of
 * the pitch. The pill goes in the first place that misses it, in this order:
 *   side   a free column beside the match (a laptop: the match is a 384 px
 *          column in the middle);
 *   below  under the pitch, at the bottom of the screen;
 *   above  over the scoreboard, at the top of the screen;
 *   band   over the stats strip (Goals, Assists, Pass, Avg rat), between the
 *          score and the pitch: a phone, where the pitch fills the screen
 *          (390x844: scoreboard at the top, pitch to 16 px from the bottom).
 *          The score, the ball and the pitch stay clear.
 * No room anywhere: null, and the pill keeps its usual dock (top or bottom).
 * Pure: the component measures, this decides.
 */
export interface Box { top: number; bottom: number; left: number; right: number }
export type PillSpot =
  | { at: "side"; top: number; left: number; width: number }
  | { at: "below" | "above"; gap: number }
  | { at: "band"; top: number; height: number };

/** The pill's width (it is max 320 px) and the space kept round it. */
export const PILL_W = 320;
export const PILL_M = 8;

export function lagPillSpot(o: { vw: number; vh: number; keep: Box; pillH: number; band?: { top: number; bottom: number } | null }): PillSpot | null {
  const { vw, vh, keep, pillH, band } = o;
  const k = { top: Math.max(0, keep.top), bottom: Math.min(vh, keep.bottom), left: Math.max(0, keep.left), right: Math.min(vw, keep.right) };
  const right = vw - k.right, left = k.left;
  if (right >= PILL_W + 2 * PILL_M) return { at: "side", top: Math.max(PILL_M, k.top), left: k.right + PILL_M, width: right - 2 * PILL_M };
  if (left >= PILL_W + 2 * PILL_M) return { at: "side", top: Math.max(PILL_M, k.top), left: PILL_M, width: left - 2 * PILL_M };
  const below = vh - k.bottom, above = k.top;
  if (below >= pillH + 2 * PILL_M) return { at: "below", gap: below };
  if (above >= pillH + 2 * PILL_M) return { at: "above", gap: above };
  if (band && band.top >= 0 && band.bottom <= vh && band.bottom - band.top >= pillH + 2) {
    return { at: "band", top: Math.round(band.top + (band.bottom - band.top - pillH) / 2), height: band.bottom - band.top };
  }
  return null;
}
