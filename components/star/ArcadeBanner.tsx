"use client";

/**
 * THE MATCH'S ACTION BANNER — "Arcade pop" (Harry, 14 Oct 2026, option B on
 * the "Banners & sounds" page: "Arcade pop is the best option").
 *
 * A big outlined word bounces in (pops to 128 %, settles), floats up and fades.
 * GOAL gets a starburst behind it. It sits in the half of the pitch the ball
 * is NOT in, so it never covers the shot. The words stay as they were.
 *
 * Fixes from the same page, all here:
 *   1. A new banner pops fresh (new key = the animation restarts), never an
 *      in-place word swap.
 *   2. One line only: no wrapping, shrunk to fit the pitch (useFitWidth),
 *      sized so even the 128 % peak stays off the edges.
 *   3. It runs its own clock: the match cutting away to the commentary does
 *      not cut it short. A banner is up for at least MIN_SHOW_MS before the
 *      next one may replace it (no 0.05 s flickers).
 *   6. It fades out instead of vanishing in one frame.
 *
 * Picture only. Taps go straight through it (pointer-events: none).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFitWidth } from "./useFitWidth";

export type BannerSide = "top" | "bottom" | "top3d";

interface Item {
  id: number;
  text: string;
  ms: number;
  side: BannerSide;
  at: number;
}

/** How long each word is up (ms). Harry's page: PASS 0.7, SAVED 0.9, ASSIST 1.1, GOAL 1.3. */
export function bannerMs(text: string): number {
  if (text === "GOAL") return 1300;
  if (text === "ASSIST" || text === "SCORED") return 1100;
  if (text === "PASS" || text === "BACK TO YOU") return 700;
  return 900; // SAVED, SAVED!, POST, MISCUED, OUT OF PLAY…
}

/** A banner is never replaced sooner than this: the pop has landed and been read. */
export const MIN_SHOW_MS = 400;

/** The word as drawn. Only GOAL gains its "!" (the page's picture). */
const shown = (t: string) => (t === "GOAL" ? "GOAL!" : t);

/** Fill colours, top → bottom of the letters. */
function colours(text: string): [string, string] {
  if (text === "GOAL") return ["#d9ffe9", "#3ddc84"];
  if (text === "PASS" || text === "BACK TO YOU" || text === "ASSIST" || text === "TOUCH ON") return ["#e6fdff", "#5fd8f0"];
  if (text.startsWith("SAVED")) return ["#fff4d6", "#f5b942"];
  if (text === "SCORED" || text === "BLOCKED" || text === "INTERCEPTED") return ["#ffe1e1", "#ff6b6b"];
  return ["#ffffff", "#d7dee6"];
}

/**
 * The banner's state and its `show`. `show` may be called from anywhere (a
 * timer, the frame loop): it never throws and never re-renders more than once.
 */
export function useArcadeBanner() {
  const [item, setItem] = useState<Item | null>(null);
  const cur = useRef<Item | null>(null);
  const idRef = useRef(0);
  const endTimer = useRef<number | null>(null);
  const waitTimer = useRef<number | null>(null);
  const pending = useRef<{ text: string; side: BannerSide } | null>(null);

  const put = useCallback((text: string, side: BannerSide) => {
    const it: Item = { id: ++idRef.current, text, ms: bannerMs(text), side, at: performance.now() };
    cur.current = it;
    setItem(it);
    if (endTimer.current) window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      if (cur.current?.id === it.id) { cur.current = null; setItem(null); }
    }, it.ms);
  }, []);

  const show = useCallback((text: string, side: BannerSide) => {
    const c = cur.current;
    const age = c ? performance.now() - c.at : Infinity;
    if (c && age < MIN_SHOW_MS) {
      // Too soon: the newest waits until the current one has been read.
      pending.current = { text, side };
      if (!waitTimer.current) {
        waitTimer.current = window.setTimeout(() => {
          waitTimer.current = null;
          const p = pending.current;
          pending.current = null;
          if (p) put(p.text, p.side);
        }, MIN_SHOW_MS - age);
      }
      return;
    }
    put(text, side);
  }, [put]);

  useEffect(() => () => {
    if (endTimer.current) window.clearTimeout(endTimer.current);
    if (waitTimer.current) window.clearTimeout(waitTimer.current);
  }, []);

  return { item, show };
}

const CSS = `
@keyframes kib-arcade {
  0%   { transform: translateY(0) scale(.35) rotate(-4deg); opacity: 0; }
  14%  { transform: translateY(0) scale(1.28) rotate(-4deg); opacity: 1; }
  24%  { transform: translateY(0) scale(.94) rotate(-4deg); }
  32%  { transform: translateY(0) scale(1) rotate(-4deg); }
  72%  { transform: translateY(-6px) scale(1) rotate(-4deg); opacity: 1; }
  100% { transform: translateY(-22px) scale(1) rotate(-4deg); opacity: 0; }
}
@keyframes kib-burst {
  0%   { transform: scale(.2) rotate(0deg); opacity: 0; }
  18%  { transform: scale(1.1) rotate(8deg); opacity: .9; }
  70%  { transform: scale(1.18) rotate(16deg); opacity: .7; }
  100% { transform: scale(1.3) rotate(22deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .kib-arcade-word, .kib-arcade-burst { animation-name: none !important; }
}
`;

const BURST = (() => {
  // 20 tapered rays, drawn once.
  const rays: string[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r0 = 34, r1 = i % 2 ? 78 : 96, w = 0.07;
    const p = (r: number, d: number) => `${(100 + r * Math.cos(a + d)).toFixed(1)},${(100 + r * Math.sin(a + d)).toFixed(1)}`;
    rays.push(`M${p(r0, -w)}L${p(r1, -w * 0.25)}L${p(r1, w * 0.25)}L${p(r0, w)}Z`);
  }
  return rays.join("");
})();

/** Where the word's middle sits, as a share of the pitch height. */
const TOP: Record<BannerSide, string> = { top: "24%", bottom: "68%", top3d: "15%" };

export default function ArcadeBanner({ item }: { item: { id: number; text: string; ms: number; side: BannerSide } | null }) {
  const wordRef = useRef<HTMLDivElement>(null);
  // 0.72 of the width: at the 128 % peak it is still inside the pitch.
  useFitWidth(wordRef, item?.id, 0.72, 14);
  if (!item) return <style>{CSS}</style>;
  const [hi, lo] = colours(item.text);
  const dur = `${item.ms}ms`;
  return (
    <>
      <style>{CSS}</style>
      <div
        key={item.id}
        data-arcade-banner={item.text}
        className="pointer-events-none absolute inset-x-0 z-40 flex items-center justify-center"
        style={{ top: TOP[item.side], transform: "translateY(-50%)" }}
      >
        {item.text === "GOAL" && (
          <svg
            className="kib-arcade-burst absolute"
            viewBox="0 0 200 200"
            width="230" height="230"
            style={{ animation: `kib-burst ${dur} ease-out both` }}
            aria-hidden
          >
            <path d={BURST} fill="#c8ffd9" opacity="0.55" />
          </svg>
        )}
        <div
          ref={wordRef}
          className="kib-arcade-word relative whitespace-nowrap px-2 font-black italic leading-none"
          style={{
            fontSize: 54,
            letterSpacing: "0.02em",
            fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
            backgroundImage: `linear-gradient(180deg, ${hi} 18%, ${lo} 82%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextStroke: "2.5px #08121a",
            filter: "drop-shadow(0 4px 0 #08121a) drop-shadow(0 6px 8px rgba(0,0,0,0.55))",
            animation: `kib-arcade ${dur} cubic-bezier(.2,.8,.3,1) both`,
          }}
        >
          {shown(item.text)}
        </div>
      </div>
    </>
  );
}
