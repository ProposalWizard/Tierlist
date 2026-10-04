"use client";

import type { Playstyle } from "@/lib/star/types";

/**
 * THE PLAYSTYLE ICONS (v0.26) — Defensive, Balanced, Attacking.
 *
 * Harry, 3 Oct 2026: "make them floating icons above the energy and use higgs
 * to make the icon." The pictures are Higgsfield renders (transparent,
 * 128px WebP, about 6-7 KB each) in public/star/playstyle/: a blue shield,
 * white two-way arrows, a pink arrow into the goal. Blue · white · pink, so
 * none of them reads as an energy level (those run green, amber, red).
 *
 * MatchCommentary floats them over the feed, just above the energy panel.
 */

export const PLAYSTYLE_ICON_SRC: Record<Playstyle, string> = {
  defensive: "/star/playstyle/defensive.webp",
  balanced: "/star/playstyle/balanced.webp",
  attacking: "/star/playstyle/attacking.webp",
};

/** Each icon's own colour, for the glow ring round the chosen one. */
export const PLAYSTYLE_GLOW: Record<Playstyle, string> = {
  defensive: "56,189,248", // sky
  balanced: "226,232,240", // slate-200
  attacking: "244,114,182", // pink
};

export const PLAYSTYLE_WORD: Record<Playstyle, string> = {
  defensive: "Defensive",
  balanced: "Balanced",
  attacking: "Attacking",
};

export default function PlaystyleIcon({ style, size = 32 }: {
  style: Playstyle;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PLAYSTYLE_ICON_SRC[style]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className="pointer-events-none select-none"
      style={{ width: size, height: size }}
    />
  );
}
