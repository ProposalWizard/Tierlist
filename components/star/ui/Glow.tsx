"use client";
import type React from "react";
import { rgba } from "./theme";

/**
 * A SOFT COLOURED GLOW behind something — a crest, a can, a figure.
 * Absolutely positioned: put it first inside a `relative` box and size it
 * with `className`.
 *
 *   <Glow color={theme.glow} alpha={0.55} className="inset-1 blur-md" />
 *   <Glow color="#60a5fa" className="bottom-0 left-1/2 h-10 w-12 -translate-x-1/2 blur-lg" />
 *   <Glow color="#fff" pulse className="…" />   (breathes, like the home spotlight)
 */
export default function Glow({ color, alpha = 0.55, pulse = false, className = "", style }: {
  color: string;
  alpha?: number;
  pulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`${pulse ? "kib-glow-pulse " : ""}pointer-events-none absolute rounded-full ${className}`}
      style={{ background: rgba(color, alpha), ...style }}
    />
  );
}
