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

  /* ── Money screens (shop, store, casino) and the phone — added with the reskin (28 Sep 2026) ── */
  @keyframes kit-shake-x { 0%,100% { transform: translateX(0); } 12% { transform: translateX(-10px) rotate(-1deg); } 26% { transform: translateX(9px) rotate(1deg); } 40% { transform: translateX(-7px); } 54% { transform: translateX(5px); } 68% { transform: translateX(-3px); } 82% { transform: translateX(2px); } }
  .kit-shake-x { animation: kit-shake-x 560ms cubic-bezier(.36,.07,.19,.97) 1 both; }
  @keyframes kit-loss-flash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
  .kit-loss-flash { animation: kit-loss-flash 700ms ease-out 1 both; }
  @keyframes kit-badge-pop { 0% { opacity: 0; transform: scale(0); } 55% { opacity: 1; transform: scale(1.35); } 75% { transform: scale(.88); } 100% { opacity: 1; transform: scale(1); } }
  .kit-badge-pop { animation: kit-badge-pop 520ms cubic-bezier(.3,.7,.4,1.4) 1 both; }
  @keyframes kit-app-open { 0% { opacity: 0; transform: scale(.14); border-radius: 40%; } 60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
  .kit-app-open { animation: kit-app-open 380ms cubic-bezier(.2,.9,.25,1) 1 both; }
  @keyframes kit-app-close { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: scale(.14); } }
  .kit-app-close { animation: kit-app-close 230ms cubic-bezier(.5,0,.75,.2) 1 both; }
  @keyframes kit-icon-in { 0% { opacity: 0; transform: scale(.55) translateY(8px); } 70% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: none; } }
  .kit-icon-in { animation: kit-icon-in 420ms cubic-bezier(.3,.8,.35,1.2) 1 both; }
  @keyframes kit-fly-x { from { transform: translateX(0); } to { transform: translateX(var(--tx)); } }
  .kit-fly-x { animation: kit-fly-x 780ms cubic-bezier(.35,0,.65,1) 1 both; }
  @keyframes kit-fly-y { from { transform: translateY(0); } to { transform: translateY(var(--ty)); } }
  .kit-fly-y { animation: kit-fly-y 780ms cubic-bezier(.4,-.9,.7,1) 1 both; }
  @keyframes kit-fly-s { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.6); } 14% { opacity: 1; transform: translate(-50%,-50%) scale(1.25); } 80% { opacity: 1; } 100% { opacity: .2; transform: translate(-50%,-50%) scale(.42); } }
  .kit-fly-s { animation: kit-fly-s 780ms cubic-bezier(.3,.6,.4,1) 1 both; }
  @keyframes kit-win-overlay { 0% { opacity: 0; } 8% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
  .kit-win-overlay { animation: kit-win-overlay 2.6s ease-out 1 both; }
  @keyframes kit-win-pop { 0% { opacity: 0; transform: scale(.3); } 55% { opacity: 1; transform: scale(1.14); } 75% { transform: scale(.96); } 100% { opacity: 1; transform: scale(1); } }
  .kit-win-pop { animation: kit-win-pop 560ms cubic-bezier(.3,.7,.4,1.3) 1 both; }
  @keyframes kit-rays { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
  .kit-rays { animation: kit-rays 9s linear infinite; }
  @keyframes kit-deal { 0% { opacity: 0; transform: translate(40px,-60px) rotate(18deg) scale(.8); } 100% { opacity: 1; transform: none; } }
  .kit-deal { animation: kit-deal 420ms cubic-bezier(.2,.8,.3,1) 1 both; }
  @keyframes kit-reel-spin { 0% { transform: translateY(-40%); filter: blur(3px); opacity: .6; } 100% { transform: translateY(40%); filter: blur(3px); opacity: .6; } }
  .kit-reel-spin { display: inline-block; animation: kit-reel-spin 90ms linear infinite; }
  /* ── Wave 2 (C): the moments on the after-match, transfer, ownership and
     build-up screens. A result slams in, a loss shakes, a trophy rises into
     light rays, a vote bar grows, a cup-draw ball drops out of the pot. ── */
  @keyframes kit-slam { 0% { opacity: 0; transform: scale(1.9); filter: blur(4px); } 55% { opacity: 1; transform: scale(.92); filter: blur(0); } 75% { transform: scale(1.06); } 100% { opacity: 1; transform: none; } }
  .kit-slam { animation: kit-slam 620ms cubic-bezier(.2,.9,.25,1) 1 both; }
  @keyframes kit-trophy-in { 0% { opacity: 0; transform: translateY(26px) scale(.6); } 60% { opacity: 1; transform: translateY(-6px) scale(1.08); } 80% { transform: translateY(0) scale(.98); } 100% { opacity: 1; transform: none; } }
  .kit-trophy-in { animation: kit-trophy-in 900ms cubic-bezier(.2,.9,.25,1) 1 both; }
  @keyframes kit-rays-c { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .kit-rays-c { animation: kit-rays-c 22s linear infinite; }
  @keyframes kit-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .kit-grow-x { animation: kit-grow-x 900ms cubic-bezier(.2,.8,.2,1) 1 both; transform-origin: 0 50%; }
  @keyframes kit-ball-drop { 0% { opacity: 0; transform: translateY(-34px) scale(.5) rotate(-120deg); } 55% { opacity: 1; transform: translateY(3px) scale(1.05) rotate(10deg); } 75% { transform: translateY(-3px) scale(.98) rotate(0); } 100% { opacity: 1; transform: none; } }
  .kit-ball-drop { animation: kit-ball-drop 520ms cubic-bezier(.3,.7,.4,1) 1 both; }
  @keyframes kit-unfold { 0% { opacity: 0; clip-path: inset(0 100% 0 0); } 100% { opacity: 1; clip-path: inset(0 0 0 0); } }
  .kit-unfold { animation: kit-unfold 420ms cubic-bezier(.3,.7,.3,1) 1 both; }
  @keyframes kit-pot-jiggle { 0%,100% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-2px,-3px) rotate(-12deg); } 50% { transform: translate(2px,1px) rotate(8deg); } 75% { transform: translate(-1px,2px) rotate(-6deg); } }
  .kit-pot-jiggle { animation: kit-pot-jiggle 520ms ease-in-out infinite; }
  @keyframes kit-camera-flash { 0%, 90%, 100% { opacity: .15; } 94% { opacity: 1; } }
  .kit-camera-flash { animation: kit-camera-flash 2.4s linear infinite; }
  @keyframes kit-write { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }
  .kit-write { animation: kit-write 1.4s ease-in-out infinite; }
  @keyframes kit-stamp { 0% { opacity: 0; transform: scale(2.3) rotate(-14deg); } 60% { opacity: 1; transform: scale(.94) rotate(-6deg); } 100% { opacity: 1; transform: scale(1) rotate(-6deg); } }
  .kit-stamp { animation: kit-stamp 560ms cubic-bezier(.2,.9,.25,1) 1 both; }
  @keyframes kit-ring { 0% { opacity: .7; transform: translate(-50%,-50%) scale(.4); } 100% { opacity: 0; transform: translate(-50%,-50%) scale(2.2); } }
  .kit-ring { animation: kit-ring 1.1s ease-out 1 both; }
  @keyframes kit-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .kit-marquee { animation: kit-marquee 18s linear infinite; }
  @keyframes kit-flip-in { 0% { opacity: 0; transform: perspective(500px) rotateY(90deg); } 100% { opacity: 1; transform: perspective(500px) rotateY(0); } }
  .kit-flip-in { animation: kit-flip-in 420ms cubic-bezier(.2,.8,.3,1) 1 both; }
  @keyframes kit-dots { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
  .kit-dots > span { animation: kit-dots 1.1s ease-in-out infinite; display: inline-block; }
  .kit-dots > span:nth-child(2) { animation-delay: 160ms; } .kit-dots > span:nth-child(3) { animation-delay: 320ms; }
  @media (prefers-reduced-motion: reduce) {
    .kit-slam, .kit-trophy-in, .kit-rays-c, .kit-grow-x, .kit-ball-drop, .kit-unfold, .kit-pot-jiggle,
    .kit-camera-flash, .kit-write, .kit-stamp, .kit-marquee, .kit-flip-in, .kit-dots > span { animation: none !important; }
    .kit-ring { animation: none !important; opacity: 0 !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-shake-x, .kit-badge-pop, .kit-app-open, .kit-app-close, .kit-icon-in, .kit-win-pop, .kit-deal, .kit-reel-spin { animation: none !important; }
    .kit-loss-flash, .kit-win-overlay, .kit-fly-x, .kit-fly-y, .kit-fly-s, .kit-rays { animation: none !important; display: none !important; }
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
