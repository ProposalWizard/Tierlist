/**
 * ONE GL AT A TIME (26 Nov 2026). The headshot maker (./headshotMaker.ts) keeps its own GL context with no view while it has pictures to
 * make, and destroys it a few seconds after the last one (GLView.destroyContextAsync). A Walk3D place makes a GLView of its own.
 * Creating one native GL while another is being destroyed is the kind of overlap a native crash needs, and we cannot rule it out
 * (the signing closed the app at "mounted (view being made)", before its GL existed). So, while a Walk3D place is open:
 *  - no headshot is shot (the drawn head stays; the picture is made the next time it is wanted, once the place has closed), and
 *  - before the place makes its GLView it waits for the headshot maker to finish and let its GL go (settleHeadshots).
 * No imports: both sides load this, and the headshot maker (three.js, the people models) is not loaded unless it is used.
 */
let open = 0;
let settler: (() => Promise<void>) | null = null;

/** A Walk3D place opened; returns the function that says it closed. */
export function placeOpened(): () => void {
  open++;
  let done = false;
  return () => { if (!done) { done = true; open = Math.max(0, open - 1); } };
}
/** True while any Walk3D place is open: the headshot maker makes nothing then. */
export function headshotsPaused(): boolean { return open > 0; }
/** The headshot maker says how to wait for it to be idle with its GL let go. */
export function registerHeadshotSettler(f: () => Promise<void>) { settler = f; }
/** Resolves when the headshot maker has no job running and no GL (at once if it was never used). Never rejects. */
export async function settleHeadshots(): Promise<void> {
  try { await settler?.(); } catch { /* the place starts anyway */ }
}
