/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A FROZEN CLOCK FOR FILMING THE REAL MATCH — dev only, never in the game.
 *
 * Frame-stepped filming (lib/star/frameStep.ts) needs "be at second t, draw
 * once". A three.js screen can step its own world; the real match cannot be
 * stepped from outside (and must not be changed to allow it: one engine). So
 * instead the page's CLOCK is stepped: `performance.now`, `Date.now`,
 * `requestAnimationFrame` and timers are wrapped so that, once filming
 * starts, time only moves when the filming tool asks. The match runs its own
 * loop exactly as always; it just sees time pass in exact 1/60 s steps.
 *
 * Installed only by a page that asks for it (`?clock=virtual` on the Style
 * Testing page). Until the first seek everything runs in real time, so the
 * page loads, fetches and settles as normal. `Math.random` is seeded too, so
 * a film is the same every time.
 *
 * While stepping, `window.__view3dSkipDraw` is true on every step but the
 * last, so a slow 3D picture is drawn once per filmed frame, not 60 times.
 */
import { publishFrameStep } from "./frameStep";

const STEP_MS = 1000 / 60;
const RAF_BASE = 1e9, TIMER_BASE = 2e9;

export function installVirtualClock(seed = 1): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__vclock) return;
  const nRaf = window.requestAnimationFrame.bind(window);
  const nCaf = window.cancelAnimationFrame.bind(window);
  const nNow = performance.now.bind(performance);
  const nDate = Date.now.bind(Date);
  const nST = window.setTimeout.bind(window);
  const nCT = window.clearTimeout.bind(window);

  // seeded Math.random (mulberry32)
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let frozen = false;
  let vnow = 0, vbase = 0, dateBase = 0;
  let rafId = RAF_BASE, timerId = TIMER_BASE;
  let queue = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, { at: number; fn: () => void }>();
  let pumpPending = false;

  performance.now = () => (frozen ? vnow : nNow());
  Date.now = () => (frozen ? Math.round(dateBase + (vnow - vbase)) : nDate());

  const runFrame = () => {
    const q = queue;
    queue = new Map();
    q.forEach((cb) => { try { cb(vnow); } catch (e) { console.error(e); } });
  };
  // While frozen, a requested frame still arrives (so a page keeps redrawing),
  // with the clock standing still: nothing moves, nothing is skipped.
  const pump = () => {
    if (pumpPending) return;
    pumpPending = true;
    nRaf(() => { pumpPending = false; if (!stepping) runFrame(); });
  };
  let stepping = false;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    // a frame asked for before the freeze but arriving after it still sees the frozen time
    if (!frozen) return nRaf((ts) => cb(frozen ? vnow : ts));
    const id = ++rafId;
    queue.set(id, cb);
    if (!stepping) pump();
    return id;
  };
  window.cancelAnimationFrame = (id: number) => { if (id > RAF_BASE) queue.delete(id); else nCaf(id); };
  (window as any).setTimeout = (fn: any, ms?: number, ...args: any[]) => {
    if (!frozen || !(Number(ms) > 0) || typeof fn !== "function") return nST(fn, ms, ...args);
    const id = ++timerId;
    timers.set(id, { at: vnow + Number(ms), fn: () => fn(...args) });
    return id;
  };
  (window as any).clearTimeout = (id: any) => { if (typeof id === "number" && id > TIMER_BASE) timers.delete(id); else nCT(id); };

  const fireTimers = () => {
    for (;;) {
      let best: [number, { at: number; fn: () => void }] | null = null;
      timers.forEach((t, id) => { if (t.at <= vnow + 1e-6 && (!best || t.at < best[1].at)) best = [id, t]; });
      if (!best) return;
      const [id, t] = best as [number, { at: number; fn: () => void }];
      timers.delete(id);
      try { t.fn(); } catch (e) { console.error(e); }
    }
  };
  // let React and the browser catch up between steps (a native macrotask)
  const settle = () => new Promise<void>((r) => nST(r, 0));

  const seek = async (t: number) => {
    // from now on a frame the page asks for itself redraws only the cheap 2D; the 3D waits for a filmed frame
    if (!frozen) { frozen = true; vnow = nNow(); vbase = vnow; dateBase = nDate(); w.__view3dSkipDraw = true; }
    const target = vbase + t * 1000;
    if (target < vnow - 1e-3) throw new Error(`virtual clock: only runs forward (asked ${t}s, at ${((vnow - vbase) / 1000).toFixed(3)}s)`);
    stepping = true;
    try {
      if (target - vnow < 1e-3) { w.__view3dSkipDraw = false; runFrame(); await settle(); return; }
      while (target - vnow > 1e-3) {
        vnow = Math.min(target, vnow + STEP_MS);
        fireTimers();
        await settle();
        w.__view3dSkipDraw = target - vnow > 1e-3;
        runFrame();
        await settle();
      }
    } finally {
      stepping = false;
      w.__view3dSkipDraw = true;
    }
  };
  w.__vclock = { seek, now: () => (frozen ? (vnow - vbase) / 1000 : 0) };
  publishFrameStep({ duration: 0, seek });
}
