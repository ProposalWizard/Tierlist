/**
 * LEAVING A 3D PLACE WHILE IT IS STILL STARTING (Skip or Back tapped during the load).
 *
 * The GL view must not be taken off the screen while `startWalkScene` is still using its GL context (the scene's
 * files loading, its first draws): on a phone that is a possible native crash (the app has been closing natively around
 * GL view creation). So a screen's Skip / Back / Continue never leaves directly: it says `whenWalkSafe(go)`, and
 *
 *   - no place is up: `go()` now;
 *   - a place is up and running: the scene is disposed first, `go()` is called a frame later (the view goes after the scene);
 *   - a place is still starting (its GL view made or being made, the scene not yet up): the leave WAITS ("Leaving…" is
 *     shown), the start is let finish (or fail), the scene is disposed, and only then `go()` runs.
 *   - a start that never settles is not waited for forever: after LEAVE_WAIT_MAX_MS the scene is let go (a late finish
 *     disposes itself, Walk3D's `me.dead`) and `go()` runs.
 *
 * Pure (no React, no phone imports): tools/live3d-check.mjs runs this same file.
 */

export const LEAVE_WAIT_MAX_MS = 8000;

export interface LeaveGateOps {
  /** Dispose the scene (if there is one) and make every later GL call a no-op. Safe to call twice. */
  dispose(): void;
  /** Run `fn` after the next frames (so the disposal reaches the native side before the view is removed). */
  after(fn: () => void): void;
  /** "Leaving…" on or off. */
  leaving?(on: boolean): void;
  /** A timer: returns its cancel. */
  timer(fn: () => void, ms: number): () => void;
}

export class LeaveGate {
  private phase: "idle" | "starting" | "up" | "gone" = "idle";
  private waiting: (() => void)[] = [];
  private cancel: (() => void) | null = null;
  constructor(private ops: LeaveGateOps) {}

  /** A GL view exists or is being made and the scene is not up yet (also after a restart). */
  starting(): void { if (this.phase !== "gone") this.phase = "starting"; }
  /** The start is over: the scene is up, or it failed, or the context never came. */
  settled(): void {
    if (this.phase === "gone") return;
    this.phase = "up";
    if (this.waiting.length) this.finish();
  }
  /** True while a leave is waiting for the start (the start must not hand the scene to the screen). */
  get wantsLeave(): boolean { return this.waiting.length > 0 || this.phase === "gone"; }
  get isStarting(): boolean { return this.phase === "starting"; }

  /** Leave: `go` runs once it is safe. */
  leave(go: () => void): void {
    if (this.phase === "gone") { this.ops.after(go); return; }
    if (this.phase === "starting") {
      this.waiting.push(go);
      if (this.waiting.length === 1) {
        this.ops.leaving?.(true);
        this.cancel = this.ops.timer(() => this.finish(), LEAVE_WAIT_MAX_MS);
      }
      return;
    }
    this.waiting.push(go);
    this.finish();
  }

  private finish(): void {
    this.cancel?.(); this.cancel = null;
    this.phase = "gone";
    const list = this.waiting; this.waiting = [];
    try { this.ops.dispose(); } catch { /* disposal never stops the leave */ }
    for (const go of list) this.ops.after(go);
  }
}

// ── the places mounted now ──
const gates = new Set<LeaveGate>();
export function registerWalkGate(g: LeaveGate): () => void { gates.add(g); return () => { gates.delete(g); }; }
/** How many 3D places are mounted (for the checks). */
export function walkGatesMounted(): number { return gates.size; }

/** Leave a screen with a 3D place on it: `go` runs when the place has been let go in the right order (see above). */
export function whenWalkSafe(go: () => void): void {
  const list = Array.from(gates);
  if (!list.length) { go(); return; }
  // a second tap on Skip while the first is still waiting does not leave twice
  if (inFlight) return;
  inFlight = true;
  let left = list.length, called = false;
  const one = () => { left--; if (left <= 0 && !called) { called = true; inFlight = false; go(); } };
  for (const g of list) g.leave(one);
}
let inFlight = false;

/**
 * Like whenWalkSafe, but only waits when a place is STILL STARTING (its GL view being made, the scene not up yet). With nothing
 * starting, `go` runs at once, exactly as before. Used by nav.go / nav.replace, so opening a screen over the title or Home
 * while their 3D player is starting does not take the GL view away under its start.
 */
export function whenStartSafe(go: () => void): void {
  for (const g of gates) if (g.isStarting) { whenWalkSafe(go); return; }
  go();
}
