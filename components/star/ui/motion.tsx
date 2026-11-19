"use client";

/**
 * EVERY KEYFRAME THE DESIGN KIT USES, IN ONE PLACE.
 *
 * Moved here from HomeFx.tsx (which now re-exports it, so nothing that
 * already imported HomeFxStyles changes) so any screen can get the home
 * screen's motion by rendering <KitStyles /> once. Rendering it twice is
 * harmless — the rules are identical.
 *
 * Two families:
 *   kib-*  the home screen's own (rise-in, breathe, hop, the can's shake,
 *          drip and "−1", the energy sheen, the floodlights, press-in).
 *   kit-*  the reusable "juice" added with the kit (burst, float text, pop,
 *          shine sweep, a rise-in that is not tied to the swipe pages, the
 *          title screen's floodlight flicker and camera drift).
 *
 * Everything stops for a phone set to reduce motion — nothing here is
 * needed to read a screen. Plain CSS, no animation loop: the one-engine
 * guard watches for canvas loops, and none of this is football.
 */
import { useEffect, useRef, useState } from "react";
import { ffNow, ffSkipped, onFfSkip } from "./fastForward";
import "./kit.css";

/* The kit's classes and keyframes now live in ./kit.css, loaded once with the
   page (19 Nov 2026: a <style> tag added per screen made the browser re-check
   every style on every tap). */

/** Kept so old call sites still compile: the styles are global now (./kit.css). */
export function KitStyles() {
  return null;
}

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/**
 * A number that counts to its new value instead of jumping — money going up
 * after a match, the star rating ticking, a can count going down. Starts at
 * the real value (no count-up from zero on every open), and snaps straight
 * there for anyone who asked for less motion.
 */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (prefersReducedMotion() || ffSkipped()) { from.current = value; setShown(value); return; }
    // The post-match clock (fastForward.tsx): 4x while held, the end on a
    // double-tap; the wall clock everywhere else.
    const t0 = ffNow();
    let raf = 0;
    const offSkip = onFfSkip(() => { cancelAnimationFrame(raf); from.current = value; setShown(value); });
    const tick = () => {
      const k = ffSkipped() ? 1 : Math.min(1, (ffNow() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * e;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); offSkip(); };
  }, [value, ms]);
  return shown;
}
