"use client";

/**
 * THE MATCH'S ACTION BANNER — "Arcade pop" (Harry, 14 Oct 2026, option B on
 * the "Banners & sounds" page). Redone the same day after "the goal banner
 * looks rlly bad": the word was small, dark and the burst looked like scratches.
 *
 * Now: a big game-title word in a chunky cartoon font (Luckiest Guy, Apache 2.0,
 * public/star/banners/), bright gradient letters, a thick dark outline, a solid
 * 3D drop and a shadow. GOAL! fills about 72 % of the pitch width on a solid
 * orange-and-yellow starburst; every other word fills about 54 % (long ones up
 * to 72 %), so GOAL is clearly the bigger moment. All drawn in code, so any
 * word gets the same look.
 *
 * It pops to 128 %, settles, floats up and fades. It sits in the half of the
 * pitch the ball is NOT in and follows the ball while it is up (`follow`).
 *
 * Fixes from the same page, all here:
 *   1. A new banner pops fresh (new key = the animation restarts), never an
 *      in-place word swap.
 *   2. One line only: no wrapping; the size is measured and fitted to the
 *      pitch, so even the 128 % peak stays off the edges.
 *   3. It runs its own clock: the match cutting away to the commentary does
 *      not cut it short. A banner is up for at least MIN_SHOW_MS before the
 *      next one may replace it (no 0.05 s flickers).
 *   6. It fades out instead of vanishing in one frame.
 *
 * Picture only. Taps go straight through it (pointer-events: none).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

/** Share of the pitch width the word fills at rest. At the 128 % peak: 0.72 → 0.92. */
export function bannerWidthShare(text: string): number {
  if (text === "GOAL") return 0.72;
  return shown(text).length > 7 ? 0.72 : 0.54;
}
/** The tallest the letters may be (px), so a short word is not a wall. */
const MAX_FONT = (text: string) => (text === "GOAL" ? 116 : 82);

/** Fill colours, top → middle → bottom of the letters. Bright, like option B. */
function colours(text: string): [string, string, string] {
  if (text === "GOAL") return ["#ffffff", "#fff35c", "#ffae00"];
  if (text === "ASSIST") return ["#ffffff", "#fff07a", "#ffc400"];
  if (text === "PASS" || text === "BACK TO YOU" || text === "TOUCH ON") return ["#ffffff", "#8ef6ff", "#22b8ff"];
  if (text.startsWith("SAVED") || text === "POST") return ["#ffffff", "#ffd36b", "#ff8a1f"];
  if (text === "SCORED" || text === "BLOCKED" || text === "INTERCEPTED") return ["#ffffff", "#ffa3a3", "#ff4040"];
  return ["#ffffff", "#f1f5fa", "#b9c7d8"];
}

const INK = "#10122b"; // the outline and the 3D drop

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

const FONT = "KibArcade";
const CSS = `
@font-face {
  font-family: "${FONT}";
  src: url("/star/banners/LuckiestGuy.woff2") format("woff2");
  font-display: block;
}
@keyframes kib-arcade {
  0%   { transform: translateY(0) scale(.3); opacity: 0; }
  13%  { transform: translateY(0) scale(1.28); opacity: 1; }
  23%  { transform: translateY(0) scale(.93); }
  31%  { transform: translateY(0) scale(1); }
  72%  { transform: translateY(-6px) scale(1); opacity: 1; }
  100% { transform: translateY(-26px) scale(1); opacity: 0; }
}
@keyframes kib-burst {
  0%   { transform: scale(.15) rotate(-12deg); }
  16%  { transform: scale(1.12) rotate(0deg); }
  26%  { transform: scale(.97) rotate(3deg); }
  100% { transform: scale(1.06) rotate(10deg); }
}
@media (prefers-reduced-motion: reduce) {
  .kib-arcade-pop, .kib-arcade-burst { animation-name: none !important; }
}
`;

/** A solid starburst: `n` points, outer radius 1 and inner `inner`, squashed to `sy`. */
function starPath(n: number, inner: number, sy: number, jag = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    // every other tip a touch shorter, so it reads hand-made, not a cog
    const r = i % 2 === 0 ? (Math.floor(i / 2) % 2 ? 1 - jag : 1) : inner;
    pts.push(`${(100 + 100 * r * Math.cos(a)).toFixed(1)},${(100 + 100 * sy * r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}
const BURST_OUT = starPath(14, 0.66, 0.62, 0.12);
const BURST_IN = starPath(14, 0.7, 0.62, 0.12);

/** Where the word's middle sits, as a share of the pitch height. */
const TOP: Record<BannerSide, string> = { top: "25%", bottom: "70%", top3d: "16%" };

export default function ArcadeBanner({ item, follow }: {
  item: { id: number; text: string; ms: number; side: BannerSide } | null;
  /** Where the banner should be right now. Polled while it is up, so it keeps
   *  out of the ball's half as the ball moves (a team-mate holding the ball
   *  after your pass is never covered). */
  follow?: (current?: BannerSide) => BannerSide;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const [font, setFont] = useState(60);
  const [side, setSide] = useState<BannerSide | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;

  // Follow the ball while up.
  useEffect(() => {
    setSide(item ? item.side : null);
    if (!item) return;
    const id = window.setInterval(() => {
      const f = followRef.current;
      if (!f) return;
      try { setSide((prev) => { const s = f(prev ?? undefined); return prev === s ? prev : s; }); } catch { /* keep it where it is */ }
    }, 100);
    return () => window.clearInterval(id);
  }, [item]);

  // Fit the word: measure it, then size it to its share of the pitch width.
  // Re-measured once the font has loaded (the first banner of a match).
  useLayoutEffect(() => {
    if (!item) return;
    const fit = () => {
      const box = boxRef.current, w = wordRef.current;
      if (!box || !w) return;
      const W = box.clientWidth, cur = font, ww = w.offsetWidth;
      if (!(W > 0 && ww > 0)) return;
      const next = Math.max(14, Math.min(MAX_FONT(item.text), (cur * bannerWidthShare(item.text) * W) / ww));
      if (Math.abs(next - cur) > 0.5) setFont(next);
    };
    fit();
    let alive = true;
    document.fonts?.load(`60px "${FONT}"`).then(() => { if (alive) requestAnimationFrame(fit); }).catch(() => {});
    return () => { alive = false; };
  }, [item, font]);

  // Ask for the font as soon as the match mounts, so the first GOAL is not drawn in a stand-in.
  useEffect(() => { document.fonts?.load(`60px "${FONT}"`).catch(() => {}); }, []);

  if (!item) return <style>{CSS}</style>;
  const [c0, c1, c2] = colours(item.text);
  const dur = `${item.ms}ms`;
  const isGoal = item.text === "GOAL";
  const stroke = Math.max(3, font * 0.15); // drawn centred: about half shows outside the letters
  const drop = Math.max(3, font * 0.085);
  const word = shown(item.text);
  const layer: React.CSSProperties = { position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" };
  return (
    <>
      <style>{CSS}</style>
      <div
        ref={boxRef}
        key={item.id}
        data-arcade-banner={item.text}
        data-arcade-id={item.id}
        className="pointer-events-none absolute inset-x-0 z-40 flex items-center justify-center"
        style={{ top: TOP[side ?? item.side], transform: "translateY(-50%)", transition: "top 220ms ease-out" }}
      >
        <div
          className="kib-arcade-pop relative flex items-center justify-center"
          style={{ animation: `kib-arcade ${dur} cubic-bezier(.2,.8,.3,1) both` }}
        >
          <span
            className="relative inline-block"
            style={{
              fontFamily: `"${FONT}", "Arial Black", Impact, sans-serif`,
              fontSize: `${font}px`, lineHeight: 1, letterSpacing: "0.02em",
              transform: "rotate(-5deg)", padding: `${stroke}px ${stroke}px ${stroke + drop}px`,
            }}
          >
            {isGoal && (
              <svg
                className="kib-arcade-burst"
                viewBox="-6 32 212 136"
                aria-hidden
                style={{
                  position: "absolute", left: "-11%", width: "122%", top: "50%", height: "auto",
                  transform: "translateY(-50%)", overflow: "visible",
                }}
              >
                <g style={{ transformOrigin: "100px 100px", animation: `kib-burst ${dur} cubic-bezier(.2,.8,.3,1) both` }}>
                  <path d={BURST_OUT} fill="#ff5b1f" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
                  <path d={BURST_IN} transform="translate(100 100) scale(0.72) translate(-100 -100)" fill="#ffd23a" />
                </g>
              </svg>
            )}
            {/* Three copies of the word: the 3D drop, the dark outline, then the
                bright letters on top, so the outline never eats the fill. */}
            <span aria-hidden style={{ ...layer, padding: "inherit", color: INK, WebkitTextStroke: `${stroke}px ${INK}`, transform: `translateY(${drop}px)`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}>{word}</span>
            <span aria-hidden style={{ ...layer, padding: "inherit", color: INK, WebkitTextStroke: `${stroke}px ${INK}` }}>{word}</span>
            <span
              ref={wordRef}
              style={{
                position: "relative", whiteSpace: "nowrap", display: "inline-block",
                backgroundImage: `linear-gradient(180deg, ${c0} 8%, ${c1} 46%, ${c2} 88%)`,
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              }}
            >
              {word}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}
