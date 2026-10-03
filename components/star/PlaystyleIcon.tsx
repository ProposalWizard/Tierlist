"use client";

import type { Playstyle } from "@/lib/star/types";

/**
 * THE PLAYSTYLE ICONS (v0.26) — Defensive, Balanced, Attacking.
 *
 * Drawn to sit beside the energy-mode icons (EnergyModeIcon.tsx): the same
 * dark sticker disc with a thick outline, a glow when chosen, dimmed when not.
 * A shield for Defensive, two-way arrows for Balanced, an arrow into the goal
 * for Attacking. Blue · white · pink, so none of them reads as an energy level
 * (those run yellow, orange, red). Vector, no image file.
 */

const COLOUR: Record<Playstyle, { main: string; glow: string }> = {
  defensive: { main: "#38bdf8", glow: "rgba(56,189,248,0.6)" },
  balanced: { main: "#e2e8f0", glow: "rgba(226,232,240,0.5)" },
  attacking: { main: "#f472b6", glow: "rgba(244,114,182,0.6)" },
};

const OUTLINE = "#0b0f14";

export default function PlaystyleIcon({ style, active = true, size = 32 }: {
  style: Playstyle;
  active?: boolean;
  size?: number;
}) {
  const c = COLOUR[style];
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
      <circle cx="50" cy="50" r="44" fill="#1e293b" stroke={OUTLINE} strokeWidth="8" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={c.main} strokeWidth="3" opacity="0.55" />
      {style === "defensive" && (
        <path
          d="M50 20 L74 29 L74 50 C74 66 63 76 50 82 C37 76 26 66 26 50 L26 29 Z"
          fill={c.main} stroke={OUTLINE} strokeWidth="6" strokeLinejoin="round"
        />
      )}
      {style === "balanced" && (
        <g fill={c.main} stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round">
          <path d="M20 40 L38 26 L38 34 L62 34 L62 26 L80 40 L62 54 L62 46 L38 46 L38 54 Z" transform="translate(0 -4)" />
          <path d="M20 60 L38 46 L38 54 L62 54 L62 46 L80 60 L62 74 L62 66 L38 66 L38 74 Z" transform="translate(0 6)" opacity="0.55" />
        </g>
      )}
      {style === "attacking" && (
        <g stroke={OUTLINE} strokeLinejoin="round">
          {/* the goal */}
          <path d="M26 30 L26 22 L74 22 L74 30" fill="none" stroke={c.main} strokeWidth="6" strokeLinecap="round" />
          {/* the arrow driving into it */}
          <path d="M50 26 L70 50 L58 50 L58 80 L42 80 L42 50 L30 50 Z" fill={c.main} strokeWidth="6" />
        </g>
      )}
    </svg>
  );
}
