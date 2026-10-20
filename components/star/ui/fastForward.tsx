"use client";

/**
 * HOLD TO SPEED UP, DOUBLE-TAP TO SKIP (Harry, 20 Oct 2026: "speed up while
 * held is pretty cool. Maybe a skip bind as well … double-tapping skips").
 *
 * The screens after the whistle reveal things in beats: the score, the star
 * bar, the rating, the boss/team/fans bars, the pay, the cup round-up. On a
 * screen that mounts <FastForward />:
 *
 *   hold a finger (or the mouse) anywhere  everything plays 4× as fast
 *   let go                                  back to normal speed
 *   double-tap                              straight to the screen's end state
 *
 * How: one clock for these beats. `ffTimeout` and `useCountUp` (motion.tsx)
 * and `useLater` (Screen.tsx) run on it instead of the wall clock; CSS
 * animations and transitions get their playbackRate set (or are finished on
 * a skip) through the Web Animations API. With no <FastForward /> on screen
 * the clock runs at 1× and nothing is ever skipped, so every other screen
 * behaves exactly as before.
 *
 * It only ever changes what is SHOWN. Nothing is credited by an animation:
 * XP, objectives and history come from the result computed before this
 * screen opens (careerFlow.ts creditMatchResult), so skipping cannot lose
 * them. A skip never presses Continue.
 */
import { useEffect, useRef, useState } from "react";

/** How fast the beats run while held. */
export const FAST_SPEED = 4;
/** A press longer than this is a hold (a quick tap on a button is not). */
const HOLD_MS = 140;
/** Two taps closer than this (time and distance) are a double-tap. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 48;
/** The hint shows on the first few post-match screens only. */
const HINT_TIMES = 3;
const HINT_KEY = "star-ff-hint-seen";

// ── The clock ───────────────────────────────────────────────────────────────

const realNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

let scale = 1;
let vBase = 0;
let rBase = realNow();
let skipped = false;
let nextId = 1;

interface Pending { due: number; fn: () => void; skippable: boolean; real?: ReturnType<typeof setTimeout> }
const pending = new Map<number, Pending>();
const skipListeners = new Set<() => void>();

/** The beats' clock, in ms: runs FAST_SPEED× as fast while held. */
export function ffNow(): number {
  return vBase + (realNow() - rBase) * scale;
}

/** Has the current screen been skipped to its end? */
export function ffSkipped(): boolean {
  return skipped;
}

function arm(id: number, p: Pending): void {
  if (p.real) clearTimeout(p.real);
  const wait = skipped && p.skippable ? 0 : Math.max(0, (p.due - ffNow()) / scale);
  p.real = setTimeout(() => { pending.delete(id); p.fn(); }, wait);
}

/**
 * setTimeout on the beats' clock. `skippable: false` keeps its full length on
 * a skip (it still speeds up while held): the achievement pop-ups use it, so a
 * skip brings them in at once but still shows each one.
 */
export function ffTimeout(fn: () => void, ms: number, opts: { skippable?: boolean } = {}): () => void {
  const id = nextId++;
  const p: Pending = { due: ffNow() + ms, fn, skippable: opts.skippable !== false };
  pending.set(id, p);
  arm(id, p);
  return () => { const q = pending.get(id); if (q?.real) clearTimeout(q.real); pending.delete(id); };
}

function setScale(next: number): void {
  if (next === scale) return;
  const now = realNow();
  vBase += (now - rBase) * scale;
  rBase = now;
  scale = next;
  pending.forEach((p, id) => arm(id, p));
}

/** Hold on / off. */
export function setFastForward(on: boolean): void {
  setScale(on ? FAST_SPEED : 1);
}

/** Jump the current screen to its end state. */
export function ffSkip(): void {
  skipped = true;
  pending.forEach((p, id) => arm(id, p));
  skipListeners.forEach(l => l());
}

/** A new screen: normal speed, nothing skipped. */
export function ffReset(): void {
  skipped = false;
  setScale(1);
}

/** Called when the current screen is skipped (a count-up snapping to its value). */
export function onFfSkip(listener: () => void): () => void {
  skipListeners.add(listener);
  return () => { skipListeners.delete(listener); };
}

// ── CSS animations and transitions ──────────────────────────────────────────

function finiteAnimations(): Animation[] {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") return [];
  return document.getAnimations().filter(a => {
    try {
      const end = a.effect?.getComputedTiming().endTime;
      return typeof end === "number" && Number.isFinite(end);
    } catch { return false; }
  });
}

/** Run every frame while a <FastForward /> is mounted. */
function syncCss(): void {
  const rate = scale;
  for (const a of finiteAnimations()) {
    try {
      if (skipped) { if (a.playState !== "finished") a.finish(); }
      else if (a.playbackRate !== rate) a.playbackRate = rate;
    } catch { /* an animation that cannot finish (no end) is left alone */ }
  }
}

function resetCss(): void {
  for (const a of finiteAnimations()) {
    try { if (a.playbackRate !== 1) a.playbackRate = 1; } catch { /* left alone */ }
  }
}

// ── The component ───────────────────────────────────────────────────────────

/**
 * Mount on a post-match screen. Listens on the whole window (a press on a
 * button still presses the button), shows a small "4×" while held and, the
 * first few times, the hint.
 */
export default function FastForward({ hint = true }: { hint?: boolean }) {
  const [fast, setFast] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const last = useRef<{ t: number; x: number; y: number } | null>(null);

  useEffect(() => {
    ffReset();
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;
    const loop = () => { syncCss(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    const stopHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (scale !== 1) { setFastForward(false); setFast(false); }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 0) return;
      const now = realNow();
      const prev = last.current;
      if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_PX) {
        last.current = null;
        stopHold();
        ffSkip();
        setShowHint(false);
        return;
      }
      last.current = { t: now, x: e.clientX, y: e.clientY };
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (skipped) return;
        setFastForward(true);
        setFast(true);
        setShowHint(false);
      }, HOLD_MS);
    };
    // A long press on a phone opens the text/image menu: not here.
    const menu = (e: Event) => e.preventDefault();
    window.addEventListener("pointerdown", down, { capture: true, passive: true });
    window.addEventListener("pointerup", stopHold, { capture: true, passive: true });
    window.addEventListener("pointercancel", stopHold, { capture: true, passive: true });
    window.addEventListener("blur", stopHold);
    window.addEventListener("contextmenu", menu);
    const body = typeof document !== "undefined" ? document.body : null;
    const prevSelect = body?.style.userSelect ?? "";
    if (body) body.style.userSelect = "none";
    return () => {
      cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
      window.removeEventListener("pointerdown", down, { capture: true } as EventListenerOptions);
      window.removeEventListener("pointerup", stopHold, { capture: true } as EventListenerOptions);
      window.removeEventListener("pointercancel", stopHold, { capture: true } as EventListenerOptions);
      window.removeEventListener("blur", stopHold);
      window.removeEventListener("contextmenu", menu);
      if (body) body.style.userSelect = prevSelect;
      ffReset();
      resetCss();
    };
  }, []);

  // The hint: the first HINT_TIMES screens on this device (a convenience only).
  useEffect(() => {
    if (!hint) return;
    let seen = HINT_TIMES;
    try { seen = Number(window.localStorage.getItem(HINT_KEY) ?? "0") || 0; } catch { /* no storage: no hint */ }
    if (seen >= HINT_TIMES) return;
    try { window.localStorage.setItem(HINT_KEY, String(seen + 1)); } catch { /* fine */ }
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [hint]);

  return (
    <>
      {showHint && (
        <div
          data-ff-hint
          className="pointer-events-none fixed inset-x-0 bottom-5 z-[96] flex justify-center px-6"
          aria-live="polite"
        >
          <div className="rounded-full bg-black/80 px-3.5 py-1.5 text-[12px] font-black text-white ring-1 ring-white/25">
            Hold to speed up · double-tap to skip
          </div>
        </div>
      )}
      {fast && (
        <div data-ff-fast className="pointer-events-none fixed right-3 top-3 z-[96] rounded-md bg-black/75 px-2 py-0.5 text-[12px] font-black text-amber-300 ring-1 ring-amber-300/50">
          ⏩ {FAST_SPEED}×
        </div>
      )}
    </>
  );
}
