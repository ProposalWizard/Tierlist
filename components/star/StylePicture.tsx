"use client";

/**
 * A DRAWN PICTURE FOR EVERY LEVEL OF EVERY STYLE ITEM.
 *
 * Harry, 30 Sep 2026: "let's have actual images of each one, like a little
 * image on there instead of L1, L2, L3." 31 items × 5 levels, each drawn from
 * a small set of shapes (a car, a bike, a plane, a building, a gadget) whose
 * proportions and trim follow the level's own name in lib/star/lifestyleLevels.ts
 * — a Rusty Moped is a moped, a Six-Wheel SUV has six wheels. Generic on
 * purpose: no real brands, no logos.
 *
 * Every level has its own paint as well as its own shape, so two levels of
 * the same item never look alike: 1 faded and rusty, 2 blue, 3 red, 4 black
 * and chrome, 5 gold with sparkles.
 *
 * Drawn in a 100 × 64 box. Seeded by nothing — the same item and level always
 * draws the same picture.
 */
import { useId, useState, useEffect, cloneElement, isValidElement, Fragment } from "react";
import type React from "react";

type Lv = 1 | 2 | 3 | 4 | 5;

/** Paint per level. */
const PAINT: Record<Lv, { body: string; dark: string; trim: string; glass: string }> = {
  1: { body: "#a8957a", dark: "#6b5a45", trim: "#8b8f96", glass: "#7f95a8" },
  2: { body: "#3b82f6", dark: "#1d4ed8", trim: "#cbd5e1", glass: "#bfdbfe" },
  3: { body: "#ef4444", dark: "#b91c1c", trim: "#e5e7eb", glass: "#c7e3ff" },
  4: { body: "#1f2430", dark: "#0b0e14", trim: "#f1f5f9", glass: "#9fb7d4" },
  5: { body: "url(#GOLD)", dark: "#a16207", trim: "#fde68a", glass: "#fef3c7" },
};

/** True once we know the render at `src` could not be loaded (a missing file, a bad
 *  connection). An SVG <image> does not reliably report that itself, so ask a plain Image. */
export function useRenderFailed(src: string): boolean {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const im = new Image();
    im.onerror = () => { if (alive) setFailed(src); };
    im.src = src;
    return () => { alive = false; im.onerror = null; };
  }, [src]);
  return failed === src;
}

/**
 * A picture of one level of one style item.
 *
 * Harry, 1 Oct 2026, on the Blender test renders: "Oh damn, you have done it.
 * That's so much better ... Do them all like this ... Don't do an in-between."
 * Every level is now a Blender render (public/shop/<base>-L<n>.webp, made by
 * tools/blender-shop). The drawing below stays as the fallback for a picture
 * that fails to load or an item with no render. The level-5 sparkles are still
 * drawn here, over the render, so they keep clear of the corner badges.
 */
export default function StylePicture({ base, level, className = "" }: { base: string; level: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const lv = Math.max(1, Math.min(5, Math.round(level || 1))) as Lv;
  // The phone is one item at one level (W5): one picture whatever level is asked for.
  const src = base in DRAW ? `/shop/${base}-L${base === "phone" ? 1 : lv}.webp` : "";
  const failed = useRenderFailed(src);
  if (src && !failed) {
    return (
      <svg viewBox="0 0 100 64" className={className} role="img" aria-hidden>
        <image href={src} x="0" y="0" width="100" height="64" preserveAspectRatio="xMidYMid slice" />
        {lv === 5 && <Sparkles />}
      </svg>
    );
  }
  const draw = DRAW[base] ?? DRAW.phone;
  // Gradient ids must be unique per picture or a list of them shares one.
  const svg = draw(lv);
  return (
    <svg viewBox="0 0 100 64" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={`${uid}GOLD`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#f5c542" />
          <stop offset="1" stopColor="#b7791f" />
        </linearGradient>
        <linearGradient id={`${uid}SKY`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      {rewriteIds(svg, uid)}
      {lv === 5 && <Sparkles />}
    </svg>
  );
}

/** Walk the drawn tree and swap url(#GOLD)/url(#SKY) for this picture's own
 *  ids, so a list of pictures never leans on one shared (maybe hidden) gradient. */
function rewriteIds(node: React.ReactNode, uid: string): React.ReactNode {
  if (Array.isArray(node)) return node.map((n) => rewriteIds(n, uid));
  if (!isValidElement(node)) return node;
  const el = node as React.ReactElement<Record<string, unknown>>;
  const p = el.props;
  const next: Record<string, unknown> = {};
  for (const k of ["fill", "stroke"]) {
    const v = p[k];
    if (typeof v === "string" && v.startsWith("url(#")) next[k] = v.replace("url(#", `url(#${uid}`);
  }
  if (typeof el.type !== "string" && el.type !== Fragment) return el;
  const kids = p.children as React.ReactNode;
  if (kids === undefined) return cloneElement(el, next);
  const list = Array.isArray(kids) ? kids : [kids];
  return cloneElement(el, next, ...list.map((k) => rewriteIds(k, uid)));
}

// Kept to the top middle and the right edge below the corner: the top-left
// corner holds "Level 5 of 5" (and "✓ YOURS" on a grid card), the top-right
// "✓ YOURS" on the item sheet. Harry, 1 Oct 2026: a sparkle sat on the badge.
export const Sparkles = () => (
  <g fill="#fffbe6">
    {[[50, 5, 1.5], [59, 11, 2.4], [67, 4, 1.3], [94, 24, 1.9]].map(([x, y, r], i) => (
      <path key={i} d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`} />
    ))}
  </g>
);

const Shadow = ({ w = 70, y = 58 }: { w?: number; y?: number }) => <ellipse cx="50" cy={y} rx={w / 2} ry="3" fill="rgba(0,0,0,.35)" />;
const Rust = ({ x, y }: { x: number; y: number }) => (
  <g fill="#8a4a24" opacity=".85"><circle cx={x} cy={y} r="2.2" /><circle cx={x + 3} cy={y + 1.5} r="1.3" /><circle cx={x - 2.5} cy={y + 1.8} r="1" /></g>
);

// ═══════════════════════════════════════════════════════════════════════
//  CARS
// ═══════════════════════════════════════════════════════════════════════

interface CarSpec {
  len: number; // half-length of the body, in units
  h: number; // body height below the windows
  roofH: number; // cabin height
  cabin: [number, number, number, number]; // windscreen base, windscreen top, rear top, rear base (x offsets from centre)
  ride?: number; // ground clearance
  wheelR?: number;
  wheels?: number[]; // x offsets from centre
  spoiler?: boolean;
  open?: boolean; // no roof
  stretch?: boolean; // extra window
  whitewall?: boolean;
  bolt?: boolean; // electric
  number?: boolean; // racing roundel
  bumper?: boolean; // chrome bumper
  wedge?: boolean; // low pointed nose
}

function Car(lv: Lv, s: CarSpec) {
  const P = PAINT[lv];
  const wr = s.wheelR ?? 6;
  const ride = s.ride ?? 2;
  const ground = 56;
  const wcy = ground - wr;
  const bottom = wcy + 1 - ride;
  const belt = bottom - s.h;
  const L = 50 - s.len, R = 50 + s.len;
  const [ws0, ws1, rr1, rr0] = s.cabin;
  const roofY = belt - s.roofH;
  // A wedge (sports cars) drops the bonnet to a low pointed nose.
  const nose = s.wedge
    ? `L${R + 3} ${bottom - 1} L${R + 3} ${bottom - s.h * 0.4} Q${R - 6} ${belt + 1} ${R - 16} ${belt}`
    : `Q${R + 1} ${bottom} ${R + 1} ${bottom - 3} L${R + 1} ${belt + 4} Q${R} ${belt} ${R - 6} ${belt}`;
  const body = `M${L + 2} ${bottom} L${R - 2} ${bottom} ${nose} L${L + 4} ${belt} Q${L - 1} ${belt + 1} ${L - 1} ${belt + 5} L${L - 1} ${bottom - 3} Q${L - 1} ${bottom} ${L + 2} ${bottom} Z`;
  const cabin = `M${50 + ws0} ${belt} L${50 + ws1} ${roofY} L${50 + rr1} ${roofY} L${50 + rr0} ${belt} Z`;
  const wheels = s.wheels ?? [-s.len + wr + 3, s.len - wr - 3];
  const rim = lv === 1 ? "#6b7280" : lv === 5 ? "#fde68a" : lv === 4 ? "#e5e7eb" : "#cbd5e1";
  return (
    <>
      <Shadow w={s.len * 2 + 12} />
      {!s.open && <path d={cabin} fill={P.body} stroke={P.dark} strokeWidth="1" />}
      {!s.open && (
        <path d={`M${50 + ws0 + 2.5} ${belt - 0.5} L${50 + ws1 + 1} ${roofY + 2} L${50 + rr1 - 1} ${roofY + 2} L${50 + rr0 - 2.5} ${belt - 0.5} Z`} fill={P.glass} opacity=".9" />
      )}
      {!s.open && <line x1={50 + (ws1 + rr1) / 2 + (s.stretch ? 6 : 0)} y1={roofY + 2} x2={50 + (ws0 + rr0) / 2 + (s.stretch ? 6 : 0)} y2={belt} stroke={P.body} strokeWidth="1.6" />}
      {s.stretch && !s.open && <line x1={50 + (ws1 + rr1) / 2 - 8} y1={roofY + 2} x2={50 + (ws0 + rr0) / 2 - 8} y2={belt} stroke={P.body} strokeWidth="1.6" />}
      {s.open && <path d={`M${50 + ws0} ${belt} L${50 + ws0 - 3} ${belt - 5}`} stroke={P.glass} strokeWidth="2" strokeLinecap="round" />}
      {s.open && <circle cx={50 + ws0 - 9} cy={belt - 4} r="2.6" fill="#f2c9a0" />}
      <path d={body} fill={P.body} stroke={P.dark} strokeWidth="1" />
      <path d={`M${L + 3} ${belt + 3} L${R - 2} ${belt + 3}`} stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      {s.spoiler && <path d={`M${L - 2} ${belt - 4} L${L + 7} ${belt - 4} M${L + 3} ${belt - 4} L${L + 4} ${belt}`} stroke={P.dark} strokeWidth="2" />}
      {s.bumper && <path d={`M${L - 2} ${bottom - 2} L${L + 3} ${bottom - 2} M${R - 3} ${bottom - 2} L${R + 2} ${bottom - 2}`} stroke="#e5e7eb" strokeWidth="2.2" strokeLinecap="round" />}
      {s.bolt && <path d="M51 38 L47 45 L50 45 L48 51 L54 43 L51 43 Z" transform={`translate(0 ${belt - 40})`} fill="#a3e635" />}
      {s.number && <g><circle cx="50" cy={(belt + bottom) / 2} r="4.2" fill="#fff" /><text x="50" y={(belt + bottom) / 2 + 2.6} textAnchor="middle" fontSize="7" fontWeight="900" fill="#111">9</text></g>}
      <rect x={s.wedge ? R - 1 : R - 2} y={s.wedge ? bottom - s.h * 0.4 - 1 : belt + 3} width="3" height="2.4" rx="1" fill="#fef9c3" />
      <rect x={L - 1.5} y={belt + 3} width="2.6" height="2.2" rx="1" fill="#f87171" />
      {wheels.map((x, i) => (
        <g key={i}>
          <circle cx={50 + x} cy={wcy} r={wr} fill="#111" />
          <circle cx={50 + x} cy={wcy} r={wr * (s.whitewall ? 0.72 : 0.5)} fill={s.whitewall ? "#f3f4f6" : rim} />
          {s.whitewall && <circle cx={50 + x} cy={wcy} r={wr * 0.4} fill={rim} />}
        </g>
      ))}
      {lv === 1 && <Rust x={L + 8} y={bottom - 4} />}
      {lv === 1 && <Rust x={R - 10} y={belt + 5} />}
    </>
  );
}

const CARS: Record<string, CarSpec[]> = {
  "car-1": [
    { len: 30, h: 11, roofH: 10, cabin: [16, 10, -20, -26], bumper: true },
    { len: 34, h: 11, roofH: 10, cabin: [18, 12, -30, -32] },
    { len: 34, h: 10, roofH: 10, cabin: [16, 9, -14, -22], bolt: true },
    { len: 36, h: 10, roofH: 10, cabin: [16, 9, -16, -24] },
    { len: 44, h: 9, roofH: 9, cabin: [26, 20, -26, -32], stretch: true, ride: 1 },
  ],
  "car-2": [
    { len: 26, h: 11, roofH: 11, cabin: [12, 6, -22, -24] },
    { len: 26, h: 11, roofH: 11, cabin: [12, 6, -22, -24] },
    { len: 27, h: 11, roofH: 10, cabin: [12, 5, -22, -24], bolt: true },
    { len: 27, h: 10, roofH: 10, cabin: [12, 5, -21, -24], spoiler: true, ride: 1 },
    { len: 28, h: 10, roofH: 10, cabin: [12, 5, -21, -24], spoiler: true, number: true, wheelR: 6.6 },
  ],
  suv: [
    { len: 30, h: 13, roofH: 11, cabin: [16, 12, -26, -28], ride: 5, wheelR: 7 },
    { len: 32, h: 13, roofH: 11, cabin: [18, 13, -28, -30], ride: 4, wheelR: 7 },
    { len: 32, h: 13, roofH: 10, cabin: [17, 12, -27, -30], ride: 4, wheelR: 7, bolt: true },
    { len: 34, h: 14, roofH: 11, cabin: [19, 14, -29, -31], ride: 4, wheelR: 7.5 },
    { len: 40, h: 14, roofH: 11, cabin: [22, 17, -35, -37], ride: 5, wheelR: 6.5, wheels: [-29, -14, 31] },
  ],
  "car-3": [
    { len: 26, h: 9, roofH: 8, cabin: [8, 2, -12, -18], ride: 2 },
    { wedge: true, len: 32, h: 9, roofH: 9, cabin: [10, 2, -12, -22] },
    { wedge: true, len: 34, h: 8, roofH: 8, cabin: [10, 1, -12, -22], ride: 1 },
    { wedge: true, len: 36, h: 8, roofH: 8, cabin: [10, 0, -14, -24], spoiler: true, ride: 1 },
    { wedge: true, len: 38, h: 7, roofH: 6, cabin: [6, -2, -10, -18], spoiler: true, number: true, ride: 0.5, wheelR: 6.5 },
  ],
  classic: [
    { len: 30, h: 11, roofH: 10, cabin: [12, 8, -16, -20], bumper: true, whitewall: true },
    { len: 34, h: 11, roofH: 10, cabin: [14, 9, -16, -22], bumper: true, whitewall: true },
    { len: 32, h: 9, roofH: 0, cabin: [8, 0, 0, 0], open: true, bumper: true, whitewall: true },
    { len: 32, h: 9, roofH: 0, cabin: [6, 0, 0, 0], open: true, number: true, whitewall: true },
    { len: 36, h: 11, roofH: 10, cabin: [14, 10, -18, -24], bumper: true, whitewall: true },
  ],
  "car-4": [
    { wedge: true, len: 36, h: 7, roofH: 7, cabin: [12, 2, -10, -20], ride: 0.5 },
    { wedge: true, len: 38, h: 7, roofH: 7, cabin: [12, 1, -10, -20], ride: 0.5 },
    { wedge: true, len: 38, h: 7, roofH: 0, cabin: [10, 0, 0, 0], open: true, ride: 0.5 },
    { wedge: true, len: 40, h: 7, roofH: 6, cabin: [10, -1, -9, -18], spoiler: true, ride: 0.5 },
    { wedge: true, len: 42, h: 6, roofH: 6, cabin: [8, -2, -8, -16], spoiler: true, ride: 0.3, wheelR: 6.4 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
//  BIKES
// ═══════════════════════════════════════════════════════════════════════

function Bike(lv: Lv, kind: "moped" | "scooter" | "road" | "super" | "chopper") {
  const P = PAINT[lv];
  const wr = kind === "moped" || kind === "scooter" ? 7 : 9;
  const back = kind === "chopper" ? 30 : 24, front = kind === "chopper" ? 70 : 74;
  const wy = 56 - wr;
  return (
    <>
      <Shadow w={60} />
      {[back, front].map((x, i) => (
        <g key={i}><circle cx={x} cy={wy} r={wr} fill="#111" /><circle cx={x} cy={wy} r={wr * 0.55} fill={lv === 5 ? "#fde68a" : lv === 1 ? "#6b7280" : "#d1d5db"} /></g>
      ))}
      {kind === "moped" || kind === "scooter" ? (
        <>
          <path d={`M${back - 4} ${wy - 4} Q${back + 6} ${wy - 14} ${back + 18} ${wy - 6} L${front - 8} ${wy - 6} L${front - 4} ${wy - 24}`} fill="none" stroke={P.body} strokeWidth="5" strokeLinecap="round" />
          <rect x={back - 4} y={wy - 15} width="16" height="5" rx="2.5" fill="#1f2937" />
          <path d={`M${front - 8} ${wy - 26} L${front + 2} ${wy - 26}`} stroke="#374151" strokeWidth="2.4" strokeLinecap="round" />
          {kind === "scooter" && <rect x={front - 10} y={wy - 20} width="8" height="10" rx="2" fill={P.body} />}
        </>
      ) : kind === "chopper" ? (
        <>
          <path d={`M${back} ${wy} L${back + 16} ${wy - 12} L${front - 10} ${wy - 12}`} fill="none" stroke={P.trim} strokeWidth="2.4" />
          <path d={`M${front} ${wy} L${front - 14} ${wy - 26}`} stroke={P.trim} strokeWidth="2.4" />
          <ellipse cx={back + 26} cy={wy - 15} rx="10" ry="5" fill={P.body} stroke={P.dark} />
          <path d={`M${back + 4} ${wy - 12} Q${back + 8} ${wy - 22} ${back + 14} ${wy - 13}`} fill="#1f2937" />
          <path d={`M${front - 18} ${wy - 32} L${front - 8} ${wy - 28}`} stroke={P.trim} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M${back} ${wy} L${back + 18} ${wy - 12} L${front - 6} ${wy - 12} L${front} ${wy}`} fill="none" stroke="#374151" strokeWidth="2.4" />
          <path d={kind === "super"
            ? `M${back + 6} ${wy - 12} L${back + 20} ${wy - 22} L${front - 8} ${wy - 24} L${front + 2} ${wy - 14} L${front - 6} ${wy - 6} L${back + 20} ${wy - 6} Z`
            : `M${back + 14} ${wy - 12} L${back + 22} ${wy - 20} L${front - 14} ${wy - 20} L${front - 10} ${wy - 12} Z`}
            fill={P.body} stroke={P.dark} />
          <rect x={back + 4} y={wy - 20} width="14" height="4" rx="2" fill="#1f2937" />
          {kind === "super" && <path d={`M${front - 8} ${wy - 24} L${front - 2} ${wy - 30}`} stroke={P.glass} strokeWidth="3" strokeLinecap="round" />}
        </>
      )}
      {lv === 1 && <Rust x={back + 14} y={wy - 9} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  AIRCRAFT
// ═══════════════════════════════════════════════════════════════════════

function Plane(lv: Lv, kind: "light" | "heli" | "jetS" | "jetM" | "liner") {
  const P = PAINT[lv];
  const body = lv === 1 ? "#e5e7eb" : lv === 4 ? "#1f2430" : lv === 5 ? "url(#GOLD)" : "#f8fafc";
  const stripe = lv === 5 ? "#a16207" : P.body;
  if (kind === "heli") {
    return (
      <>
        <Shadow w={50} />
        <path d="M18 18 L82 18" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
        <rect x="48" y="18" width="3" height="7" fill="#374151" />
        <path d="M30 40 Q30 24 50 24 Q66 24 68 36 L68 42 Q60 46 40 46 Q30 46 30 40 Z" fill={body} stroke="#334155" />
        <path d="M50 27 Q62 27 64 37 L52 37 Z" fill={P.glass} />
        <path d="M30 36 L8 32 L8 28 L4 26" stroke={stripe} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M36 50 L68 50 M42 46 L40 50 M60 46 L62 50" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
      </>
    );
  }
  const len = kind === "light" ? 28 : kind === "jetS" ? 34 : kind === "jetM" ? 40 : 44;
  const h = kind === "liner" ? 12 : kind === "light" ? 8 : 9;
  const y = 34;
  const L = 50 - len, R = 50 + len;
  return (
    <>
      <Shadow w={len * 1.6} y={60} />
      <path d={`M${L + 4} ${y - h / 2} L${L - 2} ${y - h / 2 - 12} L${L + 6} ${y - h / 2 - 12} L${L + 14} ${y - h / 2}`} fill={stripe} />
      <path d={`M${L} ${y} Q${L} ${y - h / 2} ${L + 8} ${y - h / 2} L${R - 10} ${y - h / 2} Q${R + 2} ${y - h / 2} ${R + 4} ${y + 1} Q${R + 2} ${y + h / 2} ${R - 10} ${y + h / 2} L${L + 8} ${y + h / 2} Q${L} ${y + h / 2} ${L} ${y} Z`} fill={body} stroke="#334155" />
      <path d={`M${R - 9} ${y - h / 2 + 2} L${R - 2} ${y - 1} L${R - 9} ${y - 1} Z`} fill={P.glass} />
      <path d={`M${L + 6} ${y + 2} L${R - 6} ${y + 2}`} stroke={stripe} strokeWidth="2" />
      {Array.from({ length: kind === "light" ? 2 : kind === "liner" ? 10 : kind === "jetM" ? 6 : 4 }, (_, i) => (
        <circle key={i} cx={R - 16 - i * (kind === "liner" ? 5.2 : 6)} cy={y - 2} r="1.3" fill="#334155" />
      ))}
      {kind === "light" ? (
        <>
          <path d={`M${50 - 2} ${y - h / 2 - 1} L${50 + 18} ${y - h / 2 - 1}`} stroke={stripe} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${R + 4} ${y - 8} L${R + 4} ${y + 9}`} stroke="#334155" strokeWidth="1.6" />
          <path d={`M${50} ${y + h / 2} L${48} ${y + 16} M${R - 10} ${y + h / 2} L${R - 9} ${y + 16}`} stroke="#334155" strokeWidth="1.4" />
          <circle cx="48" cy={y + 17} r="2" fill="#111" /><circle cx={R - 9} cy={y + 17} r="2" fill="#111" />
        </>
      ) : (
        <>
          <path d={`M${45} ${y + 2} L${30} ${y + 16} L${38} ${y + 16} L${60} ${y + 3}`} fill={lv === 4 ? "#374151" : "#cbd5e1"} stroke="#334155" strokeWidth=".8" />
          {kind === "liner" && <ellipse cx="40" cy={y + 12} rx="5" ry="2.6" fill="#64748b" />}
          <ellipse cx={L + 14} cy={y - h / 2 - 1} rx="6" ry="2.4" fill="#64748b" />
        </>
      )}
      {lv === 1 && <Rust x={L + 18} y={y + 2} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  BUILDINGS
// ═══════════════════════════════════════════════════════════════════════

const WALL: Record<Lv, string> = { 1: "#b8a58a", 2: "#e7e0d3", 3: "#f5f5f4", 4: "#e2e8f0", 5: "#fff7d6" };
const ROOF: Record<Lv, string> = { 1: "#7c5a3c", 2: "#9a3412", 3: "#475569", 4: "#1f2937", 5: "url(#GOLD)" };

function Windows({ x, y, cols, rows, w = 4, h = 4.5, gx = 7, gy = 7, lit = true }: { x: number; y: number; cols: number; rows: number; w?: number; h?: number; gx?: number; gy?: number; lit?: boolean }) {
  const out: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push(<rect key={`${r}-${c}`} x={x + c * gx} y={y + r * gy} width={w} height={h} rx=".6" fill={lit && (r + c) % 3 === 0 ? "#fde68a" : "#7aa7d6"} />);
  }
  return <>{out}</>;
}

const Grass = ({ sand = false }: { sand?: boolean }) => <rect x="0" y="54" width="100" height="10" fill={sand ? "#f4d79a" : "#3f8f4a"} opacity=".9" />;
const Tree = ({ x, s = 1 }: { x: number; s?: number }) => (
  <g><rect x={x - 1} y={54 - 8 * s} width="2" height={8 * s} fill="#6b4423" /><circle cx={x} cy={54 - 11 * s} r={6 * s} fill="#2f7d3a" /></g>
);
const Palm = ({ x, s = 1 }: { x: number; s?: number }) => (
  <g transform={`translate(${x} 0)`}>
    <path d={`M0 54 Q${2 * s} ${54 - 10 * s} ${4 * s} ${54 - 20 * s}`} stroke="#8b5a2b" strokeWidth={2 * s} fill="none" />
    {[-60, -20, 20, 60, 100].map((a, i) => (
      <path key={i} d={`M${4 * s} ${54 - 20 * s} q${Math.cos((a * Math.PI) / 180) * 9 * s} ${-Math.sin((a * Math.PI) / 180) * 5 * s - 2} ${Math.cos((a * Math.PI) / 180) * 12 * s} ${4 * s}`} stroke="#22a046" strokeWidth={2.2 * s} fill="none" strokeLinecap="round" />
    ))}
  </g>
);
const Pool = ({ x, w }: { x: number; w: number }) => <rect x={x} y="53" width={w} height="4" rx="2" fill="#38bdf8" stroke="#e0f2fe" strokeWidth=".8" />;

function House(lv: Lv, o: { w: number; h: number; floors: number; roof: "gable" | "flat" | "hip"; wings?: boolean; gate?: boolean; pool?: boolean; trees?: number; turrets?: boolean; dome?: boolean; door?: boolean; terrace?: boolean }) {
  const x = 50 - o.w / 2, top = 54 - o.h;
  const wall = WALL[lv], roof = ROOF[lv];
  return (
    <>
      <Grass />
      {o.trees ? Array.from({ length: o.trees }, (_, i) => <Tree key={i} x={i % 2 ? 92 - i * 2 : 8 + i * 2} s={0.9} />) : null}
      {o.wings && <><rect x={x - 14} y={top + o.h * 0.35} width="16" height={o.h * 0.65} fill={wall} stroke="#64748b" strokeWidth=".8" /><rect x={x + o.w - 2} y={top + o.h * 0.35} width="16" height={o.h * 0.65} fill={wall} stroke="#64748b" strokeWidth=".8" />
        <Windows x={x - 11} y={top + o.h * 0.45} cols={2} rows={o.floors > 2 ? 2 : 1} gx={6} /><Windows x={x + o.w + 1} y={top + o.h * 0.45} cols={2} rows={o.floors > 2 ? 2 : 1} gx={6} /></>}
      {o.turrets && <><rect x={x - 6} y={top - 8} width="10" height={o.h + 8} fill={wall} stroke="#64748b" strokeWidth=".8" /><rect x={x + o.w - 4} y={top - 8} width="10" height={o.h + 8} fill={wall} stroke="#64748b" strokeWidth=".8" />
        <path d={`M${x - 7} ${top - 8} L${x - 1} ${top - 18} L${x + 5} ${top - 8} Z M${x + o.w - 5} ${top - 8} L${x + o.w + 1} ${top - 18} L${x + o.w + 7} ${top - 8} Z`} fill={roof} /></>}
      <rect x={x} y={top} width={o.w} height={o.h} fill={wall} stroke="#64748b" strokeWidth=".8" />
      {o.roof === "gable" && <path d={`M${x - 3} ${top} L50 ${top - o.w * 0.32} L${x + o.w + 3} ${top} Z`} fill={roof} />}
      {o.roof === "hip" && <path d={`M${x - 3} ${top} L${x + o.w * 0.22} ${top - 9} L${x + o.w * 0.78} ${top - 9} L${x + o.w + 3} ${top} Z`} fill={roof} />}
      {o.roof === "flat" && <rect x={x - 1.5} y={top - 2} width={o.w + 3} height="2.5" fill={roof} />}
      {o.dome && <path d={`M${50 - 9} ${top - 1} Q50 ${top - 18} ${50 + 9} ${top - 1} Z`} fill={roof} />}
      {o.terrace && <path d={`M${x - 3} ${top + 1} L${x + o.w + 3} ${top + 1}`} stroke="#e5e7eb" strokeWidth="1.2" strokeDasharray="1.5 1.5" />}
      <Windows x={x + 3} y={top + 4} cols={Math.max(1, Math.floor((o.w - 4) / 7))} rows={o.floors} gy={Math.max(6, (o.h - 10) / o.floors)} />
      {o.door !== false && <rect x={48} y={46} width="5" height="8" rx="1" fill={lv === 5 ? "#a16207" : "#5b3a1f"} />}
      {o.gate && <path d="M4 54 L4 48 M10 54 L10 48 M16 54 L16 48 M84 54 L84 48 M90 54 L90 48 M96 54 L96 48 M2 49 L18 49 M82 49 L98 49" stroke={lv === 5 ? "#fbbf24" : "#1f2937"} strokeWidth="1.2" />}
      {o.pool && <Pool x={70} w={22} />}
      {lv === 1 && <path d={`M${x + 4} ${top + o.h - 4} l3 -3 l2 3 l3 -4`} stroke="#6b5a45" strokeWidth=".9" fill="none" />}
    </>
  );
}

function Tower(lv: Lv, o: { floors: number; w: number; top?: "flat" | "glass" | "spire"; terrace?: boolean; highlight?: "top" | "mid" | "low" }) {
  const h = 6 + o.floors * 5.6;
  const x = 50 - o.w / 2, top = 54 - h;
  const wall = lv === 1 ? "#a8a29e" : lv === 4 ? "#334155" : lv === 5 ? "#fef3c7" : "#cbd5e1";
  const hiRow = o.highlight === "top" ? 0 : o.highlight === "mid" ? Math.floor(o.floors / 2) : o.floors - 1;
  return (
    <>
      <Grass />
      <rect x={x - 16} y={54 - h * 0.45} width="12" height={h * 0.45} fill="#94a3b8" opacity=".7" />
      <rect x={x + o.w + 4} y={54 - h * 0.6} width="12" height={h * 0.6} fill="#94a3b8" opacity=".7" />
      <rect x={x} y={top} width={o.w} height={h} fill={wall} stroke="#475569" strokeWidth=".8" />
      {Array.from({ length: o.floors }, (_, r) => (
        <g key={r}>
          {Array.from({ length: Math.floor((o.w - 3) / 5) }, (_, c) => (
            <rect key={c} x={x + 2 + c * 5} y={top + 4 + r * 5.6} width="3" height="3.4" fill={r === hiRow ? (lv === 5 ? "#fbbf24" : "#fde68a") : "#7aa7d6"} />
          ))}
        </g>
      ))}
      {o.top === "glass" && <rect x={x + 1} y={top - 6} width={o.w - 2} height="6" fill="#bae6fd" stroke="#475569" strokeWidth=".6" />}
      {o.top === "spire" && <path d={`M50 ${top - 16} L${50 - 3} ${top} L${50 + 3} ${top} Z`} fill={lv === 5 ? "url(#GOLD)" : "#94a3b8"} />}
      {o.terrace && <><path d={`M${x - 3} ${top} L${x + o.w + 3} ${top}`} stroke="#e5e7eb" strokeWidth="1.2" /><circle cx={x + 2} cy={top - 3} r="2.4" fill="#22a046" /><circle cx={x + o.w - 2} cy={top - 3} r="2.4" fill="#22a046" /></>}
      {lv === 1 && <Rust x={x + 3} y={54 - 4} />}
    </>
  );
}

function Island(lv: Lv, size: number, palms: number, extra?: "resort" | "chain" | "hut") {
  return (
    <>
      <rect x="0" y="40" width="100" height="24" fill="#0ea5e9" />
      <path d="M0 44 Q25 41 50 44 T100 44" stroke="#7dd3fc" strokeWidth="1" fill="none" />
      {extra === "chain" && <><ellipse cx="14" cy="50" rx="10" ry="4" fill="#f4d79a" /><ellipse cx="86" cy="52" rx="9" ry="3.5" fill="#f4d79a" /><Palm x={12} s={0.5} /><Palm x={84} s={0.5} /></>}
      <ellipse cx="50" cy="52" rx={size} ry={size * 0.28} fill="#f4d79a" />
      {size > 14 && <ellipse cx="50" cy="50" rx={size * 0.7} ry={size * 0.18} fill="#4ea85a" />}
      {Array.from({ length: palms }, (_, i) => <Palm key={i} x={50 - size * 0.5 + (i * size) / Math.max(1, palms - 1 || 1)} s={0.6 + (i % 2) * 0.15} />)}
      {extra === "hut" && <path d="M54 52 L54 46 L62 46 L62 52 M52 46 L58 41 L64 46" stroke="#7c5a3c" strokeWidth="1.4" fill="#d6b07a" />}
      {extra === "resort" && <><rect x="55" y="40" width="16" height="9" fill={WALL[lv]} stroke="#64748b" strokeWidth=".6" /><rect x="55" y="38" width="16" height="2" fill={ROOF[lv]} /><Windows x={57} y={42} cols={2} rows={1} gx={6} /><Pool x={30} w={12} /></>}
      {lv >= 4 && <path d="M80 40 L80 31 M80 31 L86 34 L80 36" stroke="#e5e7eb" strokeWidth="1" fill={lv === 5 ? "#fbbf24" : "#ef4444"} />}
    </>
  );
}

function Villa(lv: Lv, kind: "hut" | "cottage" | "villa" | "cliff" | "infinity") {
  if (kind === "hut") {
    return (
      <>
        <rect x="0" y="44" width="100" height="20" fill="#f4d79a" />
        <rect x="0" y="56" width="100" height="8" fill="#0ea5e9" />
        <rect x="36" y="30" width="28" height="16" fill="#60a5fa" stroke="#1e3a8a" strokeWidth=".8" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={36 + i * 7} y="30" width="3.5" height="16" fill="#f8fafc" />)}
        <path d="M33 30 L50 20 L67 30 Z" fill="#dc2626" />
        <rect x="47" y="37" width="6" height="9" fill="#78350f" />
        <Palm x={78} s={0.8} />
      </>
    );
  }
  if (kind === "cottage") return <>{House(lv, { w: 34, h: 18, floors: 1, roof: "gable", trees: 2 })}<rect x="0" y="58" width="100" height="6" fill="#0ea5e9" /></>;
  const cliff = kind === "cliff";
  return (
    <>
      <rect x="0" y="50" width="100" height="14" fill="#0ea5e9" />
      {cliff && <path d="M0 50 L0 30 L60 30 L74 50 Z" fill="#78716c" />}
      {!cliff && <rect x="0" y="48" width="100" height="5" fill="#f4d79a" />}
      <rect x={cliff ? 10 : 24} y={cliff ? 16 : 30} width={kind === "infinity" ? 46 : 38} height="14" fill={WALL[lv]} stroke="#64748b" strokeWidth=".8" />
      <rect x={cliff ? 8 : 22} y={cliff ? 14 : 28} width={(kind === "infinity" ? 46 : 38) + 4} height="2.6" fill={ROOF[lv]} />
      <Windows x={(cliff ? 10 : 24) + 3} y={(cliff ? 16 : 30) + 4} cols={kind === "infinity" ? 6 : 5} rows={1} w={5} h={6} />
      {kind === "infinity" && <rect x="20" y="44" width="56" height="4" fill="#38bdf8" stroke="#e0f2fe" strokeWidth=".8" />}
      {kind === "villa" && <Pool x={66} w={18} />}
      <Palm x={cliff ? 66 : 86} s={0.8} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GADGETS AND DRIP
// ═══════════════════════════════════════════════════════════════════════

/** Case colour for a gadget at a level. */
const CASE: Record<Lv, string> = { 1: "#6b7280", 2: "#e5e7eb", 3: "#3b82f6", 4: "#111827", 5: "url(#GOLD)" };
const Screen = ({ x, y, w, h, on = true }: { x: number; y: number; w: number; h: number; on?: boolean }) => (
  <rect x={x} y={y} width={w} height={h} rx="1.2" fill={on ? "#1e3a8a" : "#334155"} stroke="#0b1220" strokeWidth=".6" />
);
const Glare = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <path d={`M${x + w * 0.2} ${y + 1} L${x + w * 0.55} ${y + 1} L${x + w * 0.1} ${y + h * 0.6} L${x + 0.5} ${y + h * 0.6} Z`} fill="rgba(255,255,255,.18)" />
);

function Phone(lv: Lv) {
  const c = CASE[lv];
  if (lv === 1) return (<><Shadow w={22} /><rect x="42" y="12" width="16" height="42" rx="3" fill={c} stroke="#374151" /><rect x="52" y="4" width="2.5" height="9" fill="#374151" /><Screen x={44} y={15} w={12} h={10} on={false} />{Array.from({ length: 12 }, (_, i) => <rect key={i} x={44 + (i % 3) * 4.2} y={29 + Math.floor(i / 3) * 5.6} width="3" height="3.6" rx=".6" fill="#d1d5db" />)}<Rust x={45} y={50} /></>);
  if (lv === 2) return (<><Shadow w={26} /><rect x="40" y="8" width="20" height="22" rx="3" fill={c} stroke="#64748b" /><Screen x={42} y={11} w={16} h={14} /><rect x="40" y="31" width="20" height="24" rx="3" fill={c} stroke="#64748b" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={43 + (i % 3) * 5} y={35 + Math.floor(i / 3) * 5.5} width="4" height="3.6" rx=".8" fill="#94a3b8" />)}</>);
  const w = lv === 3 ? 22 : 25, h = lv === 3 ? 44 : 48;
  const x = 50 - w / 2, y = 56 - h;
  return (<><Shadow w={w + 8} /><rect x={x} y={y} width={w} height={h} rx="4" fill={c} stroke={lv === 4 ? "#94a3b8" : "#64748b"} /><Screen x={x + 1.6} y={y + 3} w={w - 3.2} h={h - 6} /><Glare x={x + 1.6} y={y + 3} w={w - 3.2} h={h - 6} /><rect x={48} y={y + 1} width="4" height="1" rx=".5" fill="#0b1220" />{lv >= 4 && <><circle cx={x + 5} cy={y + 8} r="1.8" fill="#38bdf8" /><circle cx={x + 5} cy={y + 13} r="1.8" fill="#a78bfa" /></>}</>);
}

function Console(lv: Lv) {
  const c = CASE[lv];
  if (lv === 1) return (<><Shadow w={40} /><rect x="28" y="20" width="44" height="28" rx="8" fill={c} stroke="#374151" /><Screen x={40} y={24} w={20} h={14} on={false} /><path d="M33 32 h6 M36 29 v6" stroke="#111" strokeWidth="2" /><circle cx="64" cy="30" r="2" fill="#b91c1c" /><circle cx="67" cy="34" r="2" fill="#b91c1c" /><Rust x={31} y={44} /></>);
  return (
    <>
      <Shadow w={70} />
      <rect x="14" y={lv >= 4 ? 18 : 24} width="30" height={lv >= 4 ? 34 : 28} rx="3" fill={c} stroke="#475569" />
      <rect x="17" y={lv >= 4 ? 22 : 28} width="24" height="1.6" fill={lv === 5 ? "#fde68a" : "#38bdf8"} />
      <path d={`M52 40 Q52 30 62 30 L80 30 Q90 30 90 40 Q90 52 82 52 Q76 52 74 46 L68 46 Q66 52 60 52 Q52 52 52 40 Z`} fill={c} stroke="#475569" />
      <path d="M58 39 h7 M61.5 35.5 v7" stroke={lv === 2 ? "#334155" : "#e5e7eb"} strokeWidth="2" />
      {[[80, 36, "#22c55e"], [84, 40, "#ef4444"], [76, 40, "#3b82f6"], [80, 44, "#eab308"]].map(([x, y, f], i) => <circle key={i} cx={x as number} cy={y as number} r="1.8" fill={f as string} />)}
      {lv >= 3 && <rect x="16" y="46" width="26" height="1.2" fill={lv === 5 ? "#fde68a" : "#a78bfa"} />}
    </>
  );
}

function Headphones(lv: Lv) {
  const c = CASE[lv];
  if (lv === 1) return (<><Shadow w={34} /><path d="M38 20 Q44 44 50 46 Q56 44 62 20" stroke="#e5e7eb" strokeWidth="1.4" fill="none" /><circle cx="38" cy="18" r="5" fill="#f3f4f6" stroke="#9ca3af" /><circle cx="62" cy="18" r="5" fill="#f3f4f6" stroke="#9ca3af" /><rect x="48" y="44" width="4" height="6" fill="#9ca3af" /></>);
  const cup = lv >= 4 ? 11 : 9;
  return (
    <>
      <Shadow w={50} />
      <path d={`M${30} 40 Q30 8 50 8 Q70 8 70 40`} stroke={c} strokeWidth={lv >= 4 ? 5 : 4} fill="none" />
      <rect x={30 - cup / 2 - 2} y={34} width={cup + 2} height={cup * 1.6} rx={cup / 2} fill={c} stroke="#334155" />
      <rect x={70 - cup / 2} y={34} width={cup + 2} height={cup * 1.6} rx={cup / 2} fill={c} stroke="#334155" />
      {lv === 2 && <path d="M32 50 Q40 60 50 56" stroke="#334155" strokeWidth="1.4" fill="none" />}
      {lv === 5 && [36, 44, 50, 56, 64].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 9 : 11} r="1.4" fill="#e0f2fe" stroke="#fff" strokeWidth=".4" />)}
    </>
  );
}

function Music(lv: Lv) {
  const c = CASE[lv];
  if (lv === 1) return (<><Shadow w={40} /><rect x="28" y="22" width="44" height="30" rx="4" fill="#8b6b4a" stroke="#4b3621" /><path d="M64 22 L76 6" stroke="#9ca3af" strokeWidth="1.4" /><circle cx="40" cy="38" r="9" fill="#3f2f20" />{[0, 1, 2].map((i) => <circle key={i} cx="40" cy="38" r={7 - i * 2.4} fill="none" stroke="#6b5a45" />)}<rect x="54" y="28" width="14" height="6" fill="#d6c7a1" /><circle cx="58" cy="44" r="2.4" fill="#d1d5db" /><circle cx="65" cy="44" r="2.4" fill="#d1d5db" /></>);
  if (lv === 2) return (<><Shadow w={24} /><rect x="40" y="10" width="20" height="44" rx="4" fill={c} stroke="#64748b" /><Screen x={42.5} y={13} w={15} h={14} /><circle cx="50" cy="42" r="7.5" fill="#cbd5e1" stroke="#64748b" /><circle cx="50" cy="42" r="2.6" fill={c} stroke="#64748b" /></>);
  if (lv === 3) return (<><Shadow w={34} /><rect x="34" y="16" width="32" height="40" rx="15" fill={c} stroke="#1e3a8a" /><circle cx="50" cy="30" r="8" fill="#0b1220" /><circle cx="50" cy="46" r="5" fill="#0b1220" /><circle cx="50" cy="30" r="3" fill="#475569" /></>);
  const sp = (x: number, h: number) => (<g><rect x={x} y={56 - h} width="16" height={h} rx="2" fill={c} stroke="#334155" /><circle cx={x + 8} cy={56 - h + 8} r="4" fill="#0b1220" /><circle cx={x + 8} cy={56 - h * 0.35} r="5.5" fill="#0b1220" /></g>);
  return (
    <>
      <Shadow w={84} />
      {sp(8, lv === 5 ? 44 : 36)}
      {sp(76, lv === 5 ? 44 : 36)}
      {lv === 4 ? (
        <>{[0, 1, 2].map((i) => <g key={i}><rect x="32" y={30 + i * 9} width="36" height="8" rx="1" fill="#1f2937" stroke="#475569" /><rect x="36" y={33 + i * 9} width="10" height="2" fill="#38bdf8" /><circle cx="60" cy={34 + i * 9} r="2" fill="#94a3b8" /></g>)}</>
      ) : (
        <>
          <path d="M28 44 L72 44 L76 54 L24 54 Z" fill="#1f2937" stroke="#fbbf24" strokeWidth=".8" />
          {Array.from({ length: 8 }, (_, i) => <rect key={i} x={30 + i * 5.2} y={46} width="1.4" height="6" fill="#94a3b8" />)}
          <rect x="40" y="18" width="20" height="18" rx="2" fill="#1f2937" stroke="#fbbf24" strokeWidth=".8" /><circle cx="50" cy="24" r="3.4" fill="#475569" /><path d="M50 27.4 L50 36" stroke="#475569" strokeWidth="1.4" />
        </>
      )}
    </>
  );
}

function Tablet(lv: Lv) {
  const c = CASE[lv];
  const w = [26, 30, 36, 36, 36][lv - 1], h = [34, 38, 44, 44, 44][lv - 1];
  const x = 50 - w / 2, y = 56 - h;
  return (
    <>
      <Shadow w={w + 10} />
      <rect x={x} y={y} width={w} height={h} rx="3" fill={c} stroke="#475569" />
      <Screen x={x + 2.5} y={y + 2.5} w={w - 5} h={h - 5} on={lv !== 1} />
      {lv !== 1 && <Glare x={x + 2.5} y={y + 2.5} w={w - 5} h={h - 5} />}
      {lv === 1 && <path d={`M${x + 6} ${y + 8} l6 6 l-3 4 l7 6`} stroke="#cbd5e1" strokeWidth=".8" fill="none" />}
      {lv >= 4 && <path d={`M${x + w + 6} ${y + 4} L${x + w + 3} ${y + h - 2}`} stroke={lv === 5 ? "#fde68a" : "#e5e7eb"} strokeWidth="2.4" strokeLinecap="round" />}
    </>
  );
}

function SmartWatch(lv: Lv) {
  const c = CASE[lv];
  const strap = lv === 1 ? "#111827" : lv === 2 ? "#22c55e" : lv === 3 ? "#f97316" : lv === 4 ? "#334155" : "#a16207";
  const w = lv === 2 ? 12 : lv >= 4 ? 22 : 20, h = lv === 2 ? 22 : lv >= 4 ? 26 : 24;
  return (
    <>
      <Shadow w={30} />
      <rect x={50 - 6} y="2" width="12" height="60" rx="5" fill={strap} />
      <rect x={50 - w / 2} y={32 - h / 2} width={w} height={h} rx={lv === 1 ? 2 : 6} fill={c} stroke="#475569" />
      <rect x={50 - w / 2 + 2} y={32 - h / 2 + 2.5} width={w - 4} height={h - 5} rx={lv === 1 ? 1 : 4} fill={lv === 1 ? "#9fb19a" : "#0b1220"} />
      {lv === 1 ? <text x="50" y="35" textAnchor="middle" fontSize="7" fontWeight="900" fill="#1f2937">12:00</text> : (
        <>
          <circle cx="50" cy="32" r={lv === 2 ? 3 : 6} fill="none" stroke="#22c55e" strokeWidth="1.6" strokeDasharray="20 8" />
          {lv >= 3 && <circle cx="50" cy="32" r="3.4" fill="none" stroke="#ef4444" strokeWidth="1.4" strokeDasharray="12 10" />}
        </>
      )}
      {lv >= 3 && <rect x={50 + w / 2} y="28" width="1.8" height="5" rx=".8" fill="#94a3b8" />}
    </>
  );
}

function Tv(lv: Lv) {
  if (lv === 1) return (<><Shadow w={44} /><rect x="28" y="14" width="44" height="36" rx="5" fill="#8b6b4a" stroke="#4b3621" /><rect x="32" y="18" width="30" height="26" rx="5" fill="#334155" /><circle cx="67" cy="22" r="2" fill="#d1d5db" /><circle cx="67" cy="29" r="2" fill="#d1d5db" /><path d="M42 14 L36 4 M50 14 L58 4" stroke="#6b7280" strokeWidth="1.2" /><path d="M36 50 L34 56 M64 50 L66 56" stroke="#4b3621" strokeWidth="2" /></>);
  const w = [0, 40, 56, 76, 64][lv - 1], h = w * 0.56;
  const x = 50 - w / 2, y = (lv === 5 ? 44 : 50) - h;
  return (
    <>
      <Shadow w={w + 6} />
      <rect x={x} y={y} width={w} height={h} rx="1.6" fill={lv === 5 ? "url(#GOLD)" : "#0b0f19"} stroke="#334155" />
      <rect x={x + 1.6} y={y + 1.6} width={w - 3.2} height={h - 3.2} fill="#1e40af" />
      <path d={`M${x + 1.6} ${y + h - 1.6} L${x + w * 0.4} ${y + h * 0.4} L${x + w * 0.6} ${y + h * 0.65} L${x + w * 0.8} ${y + h * 0.35} L${x + w - 1.6} ${y + h - 1.6} Z`} fill="#22c55e" opacity=".8" />
      <circle cx={x + w * 0.75} cy={y + h * 0.28} r={h * 0.1} fill="#fde68a" />
      {lv < 4 && <path d={`M${50 - 6} 56 L50 ${y + h} L${50 + 6} 56`} stroke="#334155" strokeWidth="2" fill="none" />}
      {lv === 5 && <><rect x="14" y="46" width="72" height="8" rx="4" fill="#7f1d1d" /><rect x="6" y="20" width="6" height="34" rx="2" fill="#111827" /><rect x="88" y="20" width="6" height="34" rx="2" fill="#111827" /></>}
    </>
  );
}

function GamingPc(lv: Lv) {
  const c = CASE[lv];
  if (lv <= 2) return (
    <>
      <Shadow w={56} />
      <path d="M24 50 L76 50 L82 56 L18 56 Z" fill={lv === 1 ? "#9ca3af" : "#1f2937"} stroke="#475569" />
      <rect x="28" y="16" width="44" height="32" rx="2" fill={lv === 1 ? "#9ca3af" : "#111827"} stroke="#475569" />
      <Screen x={30.5} y={18.5} w={39} h={27} on={lv === 2} />
      {lv === 2 && Array.from({ length: 8 }, (_, i) => <rect key={i} x={26 + i * 6.2} y="52" width="4.6" height="1.6" fill="#ef4444" />)}
      {lv === 1 && <Rust x={32} y={53} />}
    </>
  );
  const rgb = lv === 5 ? "#fbbf24" : "#a855f7";
  return (
    <>
      <Shadow w={84} />
      <rect x={lv >= 4 ? 18 : 26} y="14" width="40" height="26" rx="1.6" fill="#0b0f19" stroke="#334155" />
      <rect x={(lv >= 4 ? 18 : 26) + 2} y="16" width="36" height="22" fill="#1e3a8a" />
      {lv >= 4 && <><rect x="2" y="18" width="16" height="22" rx="1.4" fill="#0b0f19" stroke="#334155" /><rect x="3.5" y="19.5" width="13" height="19" fill="#312e81" /></>}
      <path d={`M${lv >= 4 ? 38 : 46} 40 L${lv >= 4 ? 38 : 46} 46 M${lv >= 4 ? 30 : 38} 46 L${lv >= 4 ? 46 : 54} 46`} stroke="#334155" strokeWidth="2" />
      <rect x="66" y="12" width="20" height="42" rx="2" fill={c} stroke="#475569" />
      <rect x="68.5" y="16" width="15" height="24" rx="1" fill="#0b0f19" />
      <circle cx="76" cy="23" r="4" fill="none" stroke={rgb} strokeWidth="1.6" />
      <circle cx="76" cy="34" r="4" fill="none" stroke={rgb} strokeWidth="1.6" />
      <rect x="66" y="12" width="1.4" height="42" fill={rgb} />
      <rect x="16" y="50" width="44" height="5" rx="1" fill="#1f2937" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={18 + i * 5.8} y="51.5" width="4" height="1.6" fill={rgb} />)}
      {lv === 5 && <><path d="M8 54 L8 46 Q8 40 12 40" stroke="#94a3b8" strokeWidth="1.4" fill="none" /><rect x="10" y="34" width="5" height="9" rx="2.5" fill="#111827" /><circle cx="38" cy="10" r="2.4" fill="#111827" stroke="#fbbf24" strokeWidth=".6" /></>}
    </>
  );
}

function Suit(lv: Lv) {
  const cloth = ["#8b6b4a", "#1e3a8a", "#6b7280", "#0b0f19", "#1f2937"][lv - 1];
  const thread = lv === 5 ? "#fbbf24" : "rgba(255,255,255,.15)";
  return (
    <>
      <path d="M50 4 L50 9" stroke="#9ca3af" strokeWidth="1.4" />
      <path d="M38 12 Q50 6 62 12" stroke="#9ca3af" strokeWidth="1.6" fill="none" />
      <path d={`M36 12 L64 12 L${lv === 1 ? 80 : 74} 24 L${lv === 1 ? 76 : 70} 60 L${lv === 1 ? 24 : 30} 60 L${lv === 1 ? 20 : 26} 24 Z`} fill={cloth} stroke={thread} strokeWidth={lv === 5 ? 1.2 : 0.8} />
      <path d="M44 12 L50 30 L56 12 Z" fill="#f8fafc" />
      <path d="M48 16 L50 30 L52 16 L50 14 Z" fill={lv >= 3 ? "#b91c1c" : "#1e293b"} />
      <path d="M44 12 L50 34 L40 26 Z M56 12 L50 34 L60 26 Z" fill={cloth} stroke={thread} strokeWidth=".8" />
      <circle cx="50" cy="40" r="1.2" fill={lv === 5 ? "#fbbf24" : "#cbd5e1"} />
      <circle cx="50" cy="47" r="1.2" fill={lv === 5 ? "#fbbf24" : "#cbd5e1"} />
      {lv >= 4 && <path d="M57 30 L63 30 L62 33 L58 33 Z" fill={lv === 5 ? "#fbbf24" : "#f8fafc"} />}
      {lv === 1 && <circle cx="38" cy="46" r="2.2" fill="#6b5a45" />}
    </>
  );
}

function Chain(lv: Lv) {
  const metal = lv === 5 ? "#e0f2fe" : lv === 1 ? "#9ca3af" : "#e5e7eb";
  const t = [1.2, 1.8, 2.6, 3.4, 3.6][lv - 1];
  const links = 13;
  return (
    <>
      {Array.from({ length: links }, (_, i) => {
        const a = Math.PI * (0.08 + (0.84 * i) / (links - 1));
        const x = 50 - Math.cos(a) * 34, y = 8 + Math.sin(a) * 40;
        return <ellipse key={i} cx={x} cy={y} rx={t * 1.4} ry={t} fill="none" stroke={metal} strokeWidth={t * 0.55} transform={`rotate(${(a * 180) / Math.PI - 90} ${x} ${y})`} />;
      })}
      {lv >= 4 && <path d="M50 46 L56 54 L50 62 L44 54 Z" fill={lv === 5 ? "#e0f2fe" : "#e5e7eb"} stroke="#94a3b8" />}
      {lv === 5 && [[30, 26], [70, 26], [50, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" />)}
    </>
  );
}

function Watch(lv: Lv, iced = false) {
  const metal = lv === 1 ? "#9ca3af" : lv === 2 ? "#e9c46a" : lv === 3 || lv === 4 ? "url(#GOLD)" : "url(#GOLD)";
  const strap = iced ? (lv >= 3 ? "#e5e7eb" : "#111827") : lv === 1 ? "#cbd5e1" : lv === 2 ? "#78350f" : "url(#GOLD)";
  const stones = iced ? [6, 10, 16, 24, 32][lv - 1] : lv === 5 ? 16 : 0;
  return (
    <>
      <Shadow w={30} />
      <rect x="43" y="2" width="14" height="60" rx="4" fill={strap} stroke="#475569" strokeWidth=".5" />
      <circle cx="50" cy="32" r="15" fill={metal} stroke="#78350f" strokeWidth=".8" />
      <circle cx="50" cy="32" r="11.5" fill={iced && lv >= 4 ? "#e0f2fe" : lv === 4 && !iced ? "#0b1220" : "#f8fafc"} />
      {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <rect key={i} x={50 + Math.sin(a) * 9.4 - 0.5} y={32 - Math.cos(a) * 9.4 - 1} width="1" height="2" fill="#334155" transform={`rotate(${i * 30} ${50 + Math.sin(a) * 9.4} ${32 - Math.cos(a) * 9.4})`} />; })}
      {Array.from({ length: stones }, (_, i) => { const a = (i * 2 * Math.PI) / stones; return <circle key={i} cx={50 + Math.sin(a) * 13.2} cy={32 - Math.cos(a) * 13.2} r="1.1" fill="#fff" stroke="#bae6fd" strokeWidth=".3" />; })}
      {lv === 4 && !iced && <><circle cx="45" cy="34" r="2.4" fill="none" stroke="#94a3b8" strokeWidth=".6" /><circle cx="55" cy="34" r="2.4" fill="none" stroke="#94a3b8" strokeWidth=".6" /></>}
      <path d="M50 32 L50 24 M50 32 L55 34" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="64" y="30" width="3" height="4" rx="1" fill={metal} />
    </>
  );
}

function Necklace(lv: Lv) {
  const stones = [1, 1, 5, 9, 1][lv - 1];
  const big = lv === 5 ? 7 : lv === 1 ? 3.4 : 4;
  const gem = lv === 5 ? "#f9a8d4" : lv === 1 ? "#cbd5e1" : "#e0f2fe";
  return (
    <>
      <path d="M18 6 Q50 66 82 6" stroke={lv === 1 ? "#9ca3af" : "#e5e7eb"} strokeWidth={lv >= 4 ? 2.2 : 1.2} fill="none" />
      {Array.from({ length: stones }, (_, i) => {
        const tt = stones === 1 ? 0.5 : 0.25 + (0.5 * i) / (stones - 1);
        const x = (1 - tt) * (1 - tt) * 18 + 2 * (1 - tt) * tt * 50 + tt * tt * 82;
        const y = (1 - tt) * (1 - tt) * 6 + 2 * (1 - tt) * tt * 66 + tt * tt * 6;
        const r = stones === 1 ? big : i === Math.floor(stones / 2) ? 4.4 : 2.6;
        return <path key={i} d={`M${x} ${y - r + 3} L${x + r} ${y + 3} L${x} ${y + r * 1.4 + 3} L${x - r} ${y + 3} Z`} fill={gem} stroke="#fff" strokeWidth=".6" />;
      })}
    </>
  );
}

function Art(lv: Lv) {
  const frame = [null, "#111827", "#78350f", "#b45309", "url(#GOLD)"][lv - 1];
  const fw = lv >= 4 ? 5 : 3;
  return (
    <>
      <rect x="0" y="54" width="100" height="10" fill="#57534e" opacity=".5" />
      {frame && <rect x={24 - fw} y={6 - fw} width={52 + fw * 2} height={42 + fw * 2} fill={frame} stroke="#422006" strokeWidth=".6" />}
      <rect x="24" y="6" width="52" height="42" fill={lv === 1 ? "#e7e5e4" : "#fef3c7"} />
      {lv === 1 ? (
        <><circle cx="50" cy="22" r="8" fill="#f97316" /><rect x="34" y="34" width="32" height="6" fill="#0ea5e9" /><path d="M24 6 l6 0 M70 6 l6 0" stroke="#d6d3d1" strokeWidth="3" /></>
      ) : lv === 2 ? (
        <><rect x="24" y="30" width="52" height="18" fill="#65a30d" /><circle cx="62" cy="18" r="5" fill="#facc15" /><path d="M24 30 L38 18 L52 30 Z" fill="#475569" /></>
      ) : (
        <>
          <rect x="24" y="6" width="52" height="42" fill={lv === 5 ? "#1e1b4b" : "#1e3a8a"} />
          <circle cx={lv === 5 ? 60 : 40} cy="20" r={lv === 5 ? 7 : 6} fill="#fde68a" />
          {lv === 5 && Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${28 + i * 5} ${36 - (i % 3) * 3} q3 -4 6 0`} stroke="#93c5fd" strokeWidth="1.2" fill="none" />)}
          {lv !== 5 && <path d="M24 48 L36 30 L46 40 L58 24 L76 48 Z" fill={lv === 4 ? "#be123c" : "#0f766e"} />}
          {lv === 3 && <rect x="24" y="6" width="52" height="42" fill="none" stroke="#e5e7eb" strokeWidth="1" />}
        </>
      )}
      {lv >= 4 && <rect x="44" y={50 + fw} width="12" height="3" fill={lv === 5 ? "#fbbf24" : "#d6d3d1"} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  WHICH DRAWING FOR WHICH ITEM
// ═══════════════════════════════════════════════════════════════════════

const DRAW: Record<string, (lv: Lv) => JSX.Element> = {
  phone: (lv) => Phone(lv),
  console: (lv) => Console(lv),
  headphones: (lv) => Headphones(lv),
  music: (lv) => Music(lv),
  tablet: (lv) => Tablet(lv),
  smartwatch: (lv) => SmartWatch(lv),
  tv: (lv) => Tv(lv),
  "gaming-pc": (lv) => GamingPc(lv),
  suit: (lv) => Suit(lv),
  silver: (lv) => Chain(lv),
  gold: (lv) => Watch(lv),
  rolex: (lv) => Watch(lv, true),
  diamond: (lv) => Necklace(lv),
  art: (lv) => Art(lv),
  bike: (lv) => Bike(lv, (["moped", "scooter", "road", "super", "chopper"] as const)[lv - 1]),
  "car-1": (lv) => Car(lv, CARS["car-1"][lv - 1]),
  "car-2": (lv) => Car(lv, CARS["car-2"][lv - 1]),
  suv: (lv) => Car(lv, CARS.suv[lv - 1]),
  "car-3": (lv) => Car(lv, CARS["car-3"][lv - 1]),
  classic: (lv) => Car(lv, CARS.classic[lv - 1]),
  "car-4": (lv) => Car(lv, CARS["car-4"][lv - 1]),
  jet: (lv) => Plane(lv, (["light", "heli", "jetS", "jetM", "liner"] as const)[lv - 1]),
  "flat-1": (lv) => Tower(lv, { floors: [3, 4, 5, 5, 6][lv - 1], w: 20, top: lv >= 4 ? "flat" : undefined, highlight: "low" }),
  "flat-2": (lv) => Tower(lv, { floors: [4, 5, 6, 7, 8][lv - 1], w: 26, highlight: "mid", top: lv === 5 ? "glass" : undefined }),
  penthouse: (lv) => Tower(lv, { floors: [5, 6, 7, 8, 8][lv - 1], w: 24, top: lv >= 2 ? "glass" : undefined, terrace: lv >= 3, highlight: "top", ...(lv === 5 ? { top: "spire" as const } : {}) }),
  stable: (lv) => (
    <>
      {House(lv, { w: [20, 28, 36, 44, 50][lv - 1], h: [12, 14, 16, 18, 20][lv - 1], floors: 1, roof: "gable", door: false, trees: lv >= 3 ? 2 : 0 })}
      {[0, 1, 2].slice(0, lv === 1 ? 1 : lv < 4 ? 2 : 3).map((i) => <rect key={i} x={40 + i * 8} y="44" width="6" height="10" fill="#7c2d12" />)}
      <path d="M2 50 L98 50 M2 47 L98 47" stroke="#f8fafc" strokeWidth=".9" opacity={lv >= 2 ? 1 : 0} />
      <g transform="translate(80 40)"><ellipse cx="0" cy="6" rx="6" ry="3" fill="#7c4a24" /><path d="M5 5 L9 0 L10 2" stroke="#7c4a24" strokeWidth="2.6" /><path d="M-4 8 L-4 13 M4 8 L4 13" stroke="#7c4a24" strokeWidth="1.4" /></g>
    </>
  ),
  "house-1": (lv) => House(lv, [
    { w: 22, h: 22, floors: 2, roof: "gable" as const },
    { w: 32, h: 22, floors: 2, roof: "gable" as const, trees: 1 },
    { w: 38, h: 24, floors: 2, roof: "hip" as const, trees: 2 },
    { w: 40, h: 24, floors: 2, roof: "hip" as const, gate: true, trees: 2 },
    { w: 46, h: 24, floors: 2, roof: "flat" as const, gate: true, pool: true },
  ][lv - 1]),
  "house-2": (lv) => House(lv, [
    { w: 40, h: 26, floors: 2, roof: "gable" as const, trees: 2 },
    { w: 44, h: 26, floors: 2, roof: "hip" as const, wings: true },
    { w: 44, h: 26, floors: 2, roof: "hip" as const, wings: true, gate: true },
    { w: 46, h: 28, floors: 3, roof: "flat" as const, wings: true, gate: true, pool: true },
    { w: 40, h: 30, floors: 3, roof: "flat" as const, wings: true, dome: true, gate: true },
  ][lv - 1]),
  estate: (lv) => House(lv, [
    { w: 28, h: 18, floors: 1, roof: "gable" as const, trees: 3 },
    { w: 36, h: 22, floors: 2, roof: "gable" as const, trees: 3 },
    { w: 40, h: 24, floors: 2, roof: "hip" as const, wings: true, trees: 4 },
    { w: 44, h: 26, floors: 2, roof: "hip" as const, wings: true, trees: 4, gate: true },
    { w: 40, h: 26, floors: 2, roof: "flat" as const, turrets: true, wings: true, trees: 2 },
  ][lv - 1]),
  villa: (lv) => Villa(lv, (["hut", "cottage", "villa", "cliff", "infinity"] as const)[lv - 1]),
  island: (lv) => [
    Island(lv, 10, 0),
    Island(lv, 14, 1, "hut"),
    Island(lv, 22, 3),
    Island(lv, 28, 3, "resort"),
    Island(lv, 24, 2, "chain"),
  ][lv - 1],
};

/** Tile behind a picture, per level: grey → teal → blue → purple → gold. */
export const LEVEL_TILE: Record<number, [string, string]> = {
  1: ["#3a3f4a", "#1c2029"],
  2: ["#155e75", "#0b2b36"],
  3: ["#1e40af", "#111a3d"],
  4: ["#6b21a8", "#2a0f45"],
  5: ["#b7791f", "#4a2a06"],
};
