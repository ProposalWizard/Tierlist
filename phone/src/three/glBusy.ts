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

/**
 * GL VIEWS THAT ARE ALIVE (title and Home player, the Walk3D places). A view counts from the moment it is made until a short
 * grace after its scene was let go (the native side tears the view down a moment after the scene). Another place waits for none
 * to be alive before it makes its own: no two GL views are ever created or destroyed at the same time.
 */
export const GL_RELEASE_GRACE_MS = 300;
let views = 0;
/** A GL view is being made. Returns the function that says its scene was let go (the count drops GL_RELEASE_GRACE_MS later). */
export function glViewAlive(): () => void {
  views++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const t = setTimeout(() => { views = Math.max(0, views - 1); }, GL_RELEASE_GRACE_MS);
    (t as unknown as { unref?: () => void }).unref?.();
  };
}
/** How many GL views are alive now (for the checks). */
export function glViewsAlive(): number { return views; }
/** Resolves true when no GL view is alive (checked every 50 ms), false after `maxMs` (the caller goes on: a view that never lets go is not waited for forever). */
export async function waitNoGlView(maxMs = 3000): Promise<boolean> {
  const t0 = Date.now();
  while (views > 0) {
    if (Date.now() - t0 >= maxMs) return false;
    await new Promise<void>((res) => setTimeout(res, 50));
  }
  return true;
}
