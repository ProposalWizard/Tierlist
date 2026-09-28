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

export const KIT_CSS = `
  @keyframes kib-rise { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
  [data-page-active="true"] .kib-rise { animation: kib-rise 520ms cubic-bezier(.2,.9,.25,1) both; }
  .kit-rise { animation: kib-rise 560ms cubic-bezier(.2,.9,.25,1) both; }
  @keyframes kib-breathe { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-1.5px) scaleY(1.012); } }
  .kib-breathe { animation: kib-breathe 3.6s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes kib-hop { 0%,100% { transform: translateY(0); } 18% { transform: translateY(-16px); } 34% { transform: translateY(0); } 52% { transform: translateY(-10px); } 68% { transform: translateY(0); } }
  .kib-hop { animation: kib-hop 1.3s cubic-bezier(.3,.7,.4,1) 1 both; transform-origin: 50% 100%; }
  @keyframes kib-confetti { 0% { opacity: 0; transform: translate(0,0) rotate(0); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(540deg); } }
  .kib-confetti { animation: kib-confetti 1.6s cubic-bezier(.15,.6,.35,1) 1 both; }
  @keyframes kib-play-pulse { 0%,100% { box-shadow: 0 6px 18px -4px rgba(16,185,129,.65), 0 0 0 0 rgba(52,211,153,.55); } 50% { box-shadow: 0 6px 22px -4px rgba(16,185,129,.8), 0 0 0 9px rgba(52,211,153,0); } }
  .kib-play-pulse { animation: kib-play-pulse 2.6s ease-in-out infinite; }
  @keyframes kib-shake { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-14deg) translateY(-2px); } 30% { transform: rotate(12deg); } 45% { transform: rotate(-9deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-35deg) translate(-2px,-6px); } 90% { transform: rotate(-35deg) translate(-2px,-6px); } }
  .kib-shake { animation: kib-shake 1s ease-in-out 1 both; transform-origin: 50% 80%; }
  @keyframes kib-drop { 0% { opacity: 0; transform: translate(0,0) scale(.6); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), 34px) scale(1); } }
  .kib-drop { animation: kib-drop 900ms ease-in 1 both; }
  @keyframes kib-minus { 0% { opacity: 0; transform: translateY(4px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-22px); } }
  .kib-minus { animation: kib-minus 1.1s ease-out 1 both; }
  @keyframes kib-sheen { from { transform: translateX(-120%); } to { transform: translateX(320%); } }
  .kib-sheen { animation: kib-sheen 2.8s ease-in-out infinite; }
  .kib-sheen-fast { animation: kib-sheen 900ms ease-out 2; }
  @keyframes kib-glow-pulse { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
  .kib-glow-pulse { animation: kib-glow-pulse 3.2s ease-in-out infinite; }
  @keyframes kib-flood { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
  .kib-flood { animation: kib-flood 4s ease-in-out infinite; }
  .kib-press { transition: transform 120ms ease, filter 120ms ease; }
  .kib-press:active { transform: scale(.94); filter: brightness(.92); }

  @keyframes kit-float { 0% { opacity: 0; transform: translate(-50%, 6px) scale(.9); } 18% { opacity: 1; transform: translate(-50%, 0) scale(1.08); } 30% { transform: translate(-50%, -4px) scale(1); } 100% { opacity: 0; transform: translate(-50%, -34px) scale(1); } }
  .kit-float { animation: kit-float 1.2s cubic-bezier(.2,.8,.3,1) 1 both; }
  @keyframes kit-pop { 0% { transform: scale(1); } 35% { transform: scale(1.22); } 60% { transform: scale(.94); } 80% { transform: scale(1.04); } 100% { transform: scale(1); } }
  .kit-pop { animation: kit-pop 520ms cubic-bezier(.3,.7,.4,1) 1 both; display: inline-block; }
  @keyframes kit-shine { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(330%) skewX(-18deg); } }
  .kit-shine { animation: kit-shine 1.1s cubic-bezier(.4,0,.2,1) 1 both; }
  @keyframes kit-shine-idle { 0% { transform: translateX(-130%) skewX(-18deg); } 30%, 100% { transform: translateX(330%) skewX(-18deg); } }
  .kit-shine-loop { animation: kit-shine-idle 4s cubic-bezier(.4,0,.2,1) infinite; }
  @keyframes kit-flicker { 0% { opacity: 0; } 6% { opacity: .9; } 9% { opacity: .05; } 14% { opacity: 1; } 17% { opacity: .25; } 24% { opacity: 1; } 100% { opacity: 1; } }
  .kit-flicker { animation: kit-flicker 1.4s linear 1 both; }
  @keyframes kit-fade { from { opacity: 0; } to { opacity: 1; } }
  .kit-fade { animation: kit-fade 900ms ease-out 1 both; }
  @keyframes kit-text-shine { 0%, 55% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
  .kit-text-shine { background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: kit-text-shine 5s ease-in-out infinite; }
  @keyframes kit-drop-in { 0% { opacity: 0; transform: translateY(-18px) scale(1.12); filter: blur(6px); } 60% { opacity: 1; filter: blur(0); } 100% { opacity: 1; transform: none; filter: none; } }
  .kit-drop-in { animation: kit-drop-in 800ms cubic-bezier(.2,.9,.25,1) 1 both; }
  @keyframes kit-drift { 0% { transform: scale(1.06) translate3d(-1.2%, 0, 0); } 100% { transform: scale(1.1) translate3d(1.2%, -1%, 0); } }
  .kit-drift { animation: kit-drift 16s ease-in-out infinite alternate; }
  @keyframes kit-mote { 0% { opacity: 0; transform: translate(0, 0); } 20% { opacity: .9; } 100% { opacity: 0; transform: translate(var(--dx), -90px); } }
  .kit-mote { animation: kit-mote var(--dur, 6s) linear infinite; animation-delay: var(--delay, 0s); }
  @keyframes kit-gain { 0% { opacity: 0; transform: scaleY(.6); } 20% { opacity: 1; transform: scaleY(1.9); } 45% { transform: scaleY(1); } 100% { opacity: 0; transform: scaleY(1); } }
  .kit-gain { animation: kit-gain 1.3s cubic-bezier(.2,.8,.3,1) 1 both; transform-origin: 50% 50%; }

  @media (prefers-reduced-motion: reduce) {
    [data-page-active="true"] .kib-rise, .kit-rise, .kib-breathe, .kib-hop, .kib-confetti, .kib-play-pulse, .kib-shake,
    .kib-drop, .kib-minus, .kib-sheen, .kib-sheen-fast, .kib-glow-pulse, .kib-flood,
    .kit-pop, .kit-text-shine, .kit-flicker, .kit-fade, .kit-drop-in, .kit-drift { animation: none !important; }
    .kit-float, .kit-shine, .kit-shine-loop, .kit-mote, .kit-gain { animation: none !important; opacity: 0 !important; }
    .kib-press:active { transform: none; }
  }
`;

/** Render once anywhere above a screen that uses the kit. */
export function KitStyles() {
  return <style>{KIT_CSS}</style>;
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
    if (prefersReducedMotion()) { from.current = value; setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * e;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
