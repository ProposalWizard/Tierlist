"use client";
import type React from "react";
import { rgba } from "./theme";
import LiquidBar from "./LiquidBar";

/**
 * THE FLAT PANEL — the replacement for the floating rounded card (Harry,
 * 1 Oct 2026: "I don't like the floating pill effect of everything … so AI").
 * Full width, square edges, and it FADES into the page behind it instead of
 * sitting on it. Put it in a `px-3` column with `bleed` and it runs edge to
 * edge of the phone.
 *
 *   <FlatPanel bleed glow={theme.glow} edge>…</FlatPanel>
 *   <FlatPanel bleed fade="bottom">…</FlatPanel>
 *
 * `fade`: "both" (default, soft top and bottom), "top", "bottom" or "none"
 * (a solid wash). `edge` adds a hairline top and bottom. `glow` tints the
 * wash a little in your club colour. The Pitch look recolours it to grass.
 */
export function FlatPanel({ glow, fade = "both", edge = false, bleed = false, className = "", style, children, ...rest }: {
  glow?: string;
  fade?: "both" | "top" | "bottom" | "none";
  edge?: boolean;
  /** Cancel the page's 12px side padding so the panel touches both edges. */
  bleed?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">) {
  const tint = glow ? { boxShadow: `inset 0 0 40px -10px ${rgba(glow, 0.35)}` } : null;
  return (
    <div data-fade={fade} data-edge={edge ? "true" : undefined} className={`sk-flat ${bleed ? "-mx-3" : ""} ${className}`} style={{ ...tint, ...style }} {...rest}>
      {children}
    </div>
  );
}

/**
 * THE BAR (kept under its v0.23 name). Since v0.23.1 it is the LIQUID bar
 * (ui/LiquidBar.tsx): one smooth glowing fill, rounded ends, no ticks, glides
 * to a new value (Harry and Mikey, P8/P15/P96). `animate` keeps the light
 * drifting along the fill; `ticks` is accepted and ignored. Give it a height
 * with `className` (h-3 by default). A number over it goes in `children`.
 *
 *   <SquareBar value={energy} colors={["#34d399", "#a3e635"]} className="h-4" animate>85</SquareBar>
 *
 * `square` (v0.24) gives it square ends and a white edge: use it for any bar
 * at the top of a screen, or use TopMeter (ui/TopMeter.tsx), which adds the
 * icon sitting on top of the bar.
 */
export function SquareBar({ value, colors = ["#fbbf24", "#fde68a"], className = "h-3", animate = false, square = false, duration, children }: {
  /** 0-100. */
  value: number;
  colors?: [string, string];
  className?: string;
  animate?: boolean;
  /** Ignored: the liquid bar has no tick marks. */
  ticks?: boolean;
  /** Square ends and a white edge — every bar at the TOP of a screen (Harry,
   *  2 Oct 2026, P1-35: "everything that's at the top should be a square bar"). */
  square?: boolean;
  /** Glide time in ms (900 by default); 0 jumps. */
  duration?: number;
  /** Over the bar, centred (a number). */
  children?: React.ReactNode;
}) {
  return <LiquidBar value={value} colors={colors} className={className} sheen={animate} square={square} duration={duration}>{children}</LiquidBar>;
}
