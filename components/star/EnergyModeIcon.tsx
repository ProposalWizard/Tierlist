"use client";

import { useId } from "react";
import type { EnergyMode } from "@/lib/star/energy";

/**
 * THE ENERGY-MODE ICONS — Low, Medium, High, as pictures instead of words.
 *
 * Drawn from the owners' three concept images (23 Sep 2026): a split ring, a
 * lightning bolt cutting diagonally through the gaps, and little sparks
 * around it — red for Low, amber for Medium, green for High. Redrawn rather
 * than pasted in, for a dark match screen: a dark centre, a thick dark
 * sticker outline, a two-tone bolt. The number of sparks says the level on
 * its own (2 · 4 · 6), so the three read as less-to-more even without colour.
 *
 * Vector, so it stays sharp at any size and needs no image file.
 */

const PALETTE: Record<EnergyMode, { main: string; light: string; glow: string }> = {
  low: { main: "#ef4444", light: "#fca5a5", glow: "rgba(239,68,68,0.55)" },
  medium: { main: "#f59e0b", light: "#fde047", glow: "rgba(245,158,11,0.55)" },
  high: { main: "#22c55e", light: "#d9f99d", glow: "rgba(132,204,22,0.6)" },
};

/** Where the sparks sit, in degrees on screen (0 = right, 90 = down) — the
 *  bolt runs top-right to bottom-left, so they sit either side of it. */
const SPARKS: Record<EnergyMode, number[]> = {
  low: [180, 0],
  medium: [205, 155, 335, 25],
  high: [212, 180, 148, 328, 0, 32],
};

const OUTLINE = "#0b0f14";
const BOLT = "M60 5 L83 5 L64 38 L79 38 L34 96 L45 56 L27 56 Z";
const BOLT_LIT = "M60 5 L83 5 L64 38 L52 50 L45 56 L27 56 Z";

function spark(deg: number): string {
  const a = (deg * Math.PI) / 180;
  const r = 26; // distance of the spark's base from the centre
  const cx = 50 + Math.cos(a) * r, cy = 50 + Math.sin(a) * r;
  // Points toward the centre: tip inward, base outward.
  const tip = { x: 50 + Math.cos(a) * (r - 9), y: 50 + Math.sin(a) * (r - 9) };
  const px = -Math.sin(a) * 4.6, py = Math.cos(a) * 4.6;
  return `M${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${(cx + px).toFixed(1)} ${(cy + py).toFixed(1)} L${(cx - px).toFixed(1)} ${(cy - py).toFixed(1)} Z`;
}

export default function EnergyModeIcon({ mode, active = true, size = 32 }: {
  mode: EnergyMode;
  /** The mode in play — full colour and a glow. Otherwise dimmed and grey. */
  active?: boolean;
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const c = PALETTE[mode];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{
        filter: active ? `drop-shadow(0 0 6px ${c.glow})` : "grayscale(0.45) brightness(0.8)",
        opacity: active ? 1 : 0.75,
        transition: "filter 150ms, opacity 150ms",
      }}
    >
      <defs>
        <radialGradient id={`${id}d`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.main} />
        </linearGradient>
        {/* The ring is cut where the bolt passes through it. */}
        <mask id={`${id}m`}>
          <rect width="100" height="100" fill="white" />
          <path d={BOLT} fill="black" stroke="black" strokeWidth="13" strokeLinejoin="round" />
        </mask>
      </defs>

      {/* Split ring: dark edge, then colour, both cut by the bolt. */}
      <g mask={`url(#${id}m)`}>
        <circle cx="50" cy="50" r="40" fill="none" stroke={OUTLINE} strokeWidth="17" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={`url(#${id}r)`} strokeWidth="10" />
      </g>

      {/* Centre disc. */}
      <circle cx="50" cy="50" r="31" fill={`url(#${id}d)`} stroke={OUTLINE} strokeWidth="3" />

      {/* Sparks — 2, 4 or 6. */}
      {SPARKS[mode].map((d) => (
        <path key={d} d={spark(d)} fill={c.light} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      ))}

      {/* The bolt: thick dark edge, colour, then a lit facet. */}
      <path d={BOLT} fill={c.main} stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d={BOLT_LIT} fill={c.light} opacity="0.85" />
      <path d={BOLT} fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
