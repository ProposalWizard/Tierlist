/**
 * BRING SOMETHING FULLY ON SCREEN — below whatever is pinned to the top.
 *
 * Found by a phone audit (26 Sep 2026): the pitch on the test screens sat
 * mostly below the fold, and because a pitch swallows swipes (it is a drag
 * surface) the player could not even scroll to it by swiping on it. On
 * Infinite Match the strike ball was drawn at 635–838 px on a 664 px screen;
 * in training the page stayed 344 px scrolled past the goal after "Let's go".
 *
 * This scrolls the page by the least amount that shows the whole element:
 *   - already fully visible → nothing moves (no yanking while you read);
 *   - fits on screen → its top lands just under the sticky/fixed bars pinned
 *     to the top of the screen (the site nav, a sticky Save/Commit bar);
 *   - taller than the room left → its BOTTOM lands on the bottom of the
 *     screen, because that is where the ball and the strike screen sit.
 *
 * Pure scrolling: nothing is resized, so a drag reads exactly as it did.
 */

/** How much of the top of the screen is covered by pinned bars right now. */
export function pinnedTopHeight(ignore?: Element | null): number {
  if (typeof window === "undefined") return 0;
  const vh = window.innerHeight;
  let bottom = 0;
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    const cs = getComputedStyle(el);
    if (cs.position !== "sticky" && cs.position !== "fixed") continue;
    if (ignore && (el === ignore || el.contains(ignore) || ignore.contains(el))) continue;
    if (el.closest("[data-page-guide]")) continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0 || cs.visibility === "hidden" || cs.display === "none") continue;
    // Only bars along the TOP: a full-screen fixed overlay or a bottom bar
    // is not something to scroll under.
    if (r.height > vh * 0.4) continue;
    const topCss = parseFloat(cs.top);
    if (!Number.isFinite(topCss) || topCss > 12) continue;
    bottom = Math.max(bottom, topCss + r.height);
  }
  return bottom;
}

export function revealOnScreen(el: Element | null | undefined, opts: { margin?: number; smooth?: boolean } = {}): void {
  if (!el || typeof window === "undefined") return;
  const margin = opts.margin ?? 6;
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return;
  const vh = window.innerHeight;
  const top = pinnedTopHeight(el) + margin;
  const bottom = vh - margin;
  if (r.top >= top - 1 && r.bottom <= bottom + 1) return;
  const delta = r.height <= bottom - top ? r.top - top : r.bottom - bottom;
  if (Math.abs(delta) < 2) return;
  window.scrollBy({ top: delta, behavior: opts.smooth === false ? "auto" : "smooth" });
}
