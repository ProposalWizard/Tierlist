"use client";

/**
 * THE HOME SCREEN'S MOTION, IN ONE PLACE.
 *
 * Harry, 28 Sep 2026: "making this home screen looking incredible ... making
 * everything pop more but also feel fluid." Every keyframe the home screens,
 * the bottom bar and the swipe pages use lives here, so the whole set can be
 * turned off at once for anyone who has asked their phone for less motion
 * (prefers-reduced-motion) — nothing here is needed to read the screen.
 *
 * Plain CSS, no animation loop: the one-engine guard watches for canvas
 * loops, and none of this is football.
 */
import { useEffect, useRef, useState } from "react";

export function HomeFxStyles() {
  return (
    <style>{`
      @keyframes kib-rise { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
      [data-page-active="true"] .kib-rise { animation: kib-rise 520ms cubic-bezier(.2,.9,.25,1) both; }
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
      @media (prefers-reduced-motion: reduce) {
        [data-page-active="true"] .kib-rise, .kib-breathe, .kib-hop, .kib-confetti, .kib-play-pulse, .kib-shake,
        .kib-drop, .kib-minus, .kib-sheen, .kib-sheen-fast, .kib-glow-pulse, .kib-flood { animation: none !important; }
        .kib-press:active { transform: none; }
      }
    `}</style>
  );
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
