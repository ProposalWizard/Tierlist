"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * THE LIQUID BAR — the one bar the game draws (Harry and Mikey, 1 Oct 2026,
 * v0.23 review, P8/P15/P96: "a smooth, glowing … one big bar … it's almost like
 * a liquid", "I could see it without the lines, it makes it seem like 10 bars
 * of energy, which it isn't").
 *
 * A rounded track with ONE smooth fill: a colour gradient, a glossy top, a
 * soft glow that spills past the edges, a light that keeps drifting along it
 * and a bright rim where the liquid ends. No tick marks. The fill glides to
 * its new value, and when it goes UP it flashes and the light races across.
 * Stills (reduced motion) keep every colour and the glow, only the movement
 * stops.
 *
 * StatBar and SquareBar both draw this, so star rating, energy and every
 * other bar in the game are the same thing. Give it a height with `className`
 * (`h-[14px]`, `h-3`); put a number over it with `children`.
 *
 *   <LiquidBar value={energy} colors={["#34d399", "#a3e635"]} className="h-4">85</LiquidBar>
 */
export default function LiquidBar({ value, colors, className = "h-3", sheen = true, children }: {
  /** 0-100. */
  value: number;
  /** [deep, light] — the fill runs deep → light. */
  colors: [string, string];
  className?: string;
  /** The drifting light. Off for a bar that should sit still. */
  sheen?: boolean;
  /** Over the bar, centred (a number). */
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(100, value));
  const prev = useRef(v);
  const [boost, setBoost] = useState(0);
  useEffect(() => {
    if (v > prev.current) setBoost((b) => b + 1);
    prev.current = v;
  }, [v]);
  const still = typeof window !== "undefined" && prefersReducedMotion();
  const w = `${v}%`;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      data-liquid-bar
      className={`sk-liq ${className}`}
      style={{ ["--liq-a" as string]: colors[0], ["--liq-b" as string]: colors[1] } as React.CSSProperties}
    >
      {/* The glow behind the fill: outside the track, so it is not clipped. */}
      <div aria-hidden className="sk-liq-glow" style={{ width: w, transition: still ? "none" : undefined }} />
      <div className="sk-liq-track">
        <div key={boost} className={`sk-liq-fill ${boost ? "sk-liq-pop" : ""}`} style={{ width: w, transition: still ? "none" : undefined }}>
          <div className="sk-liq-gloss" />
          {sheen && !still && <div key={`s${boost}`} className={`sk-liq-flow ${boost ? "sk-liq-flow-fast" : ""}`} />}
          <div className="sk-liq-rim" />
        </div>
      </div>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black leading-none tabular-nums text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.8)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
