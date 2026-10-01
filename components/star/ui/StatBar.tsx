"use client";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

/** Green when healthy, amber when low, red when nearly empty — the energy
 *  bar's colours, for any 0-100 bar that means "how much is left". */
export function levelColors(value: number): [string, string] {
  return value >= 60 ? ["#34d399", "#a3e635"] : value >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
}

/**
 * THE BAR EVERY SCREEN USES — SQUARE since v0.23 (Harry, P85/P107: "squares
 * with very clear, maybe even animated, progress"): square corners, a clear
 * outline, ten ruler ticks, a gradient fill, a sheen that keeps sweeping along
 * it, and a fill that glides to its new value. When the value goes UP the
 * sheen races across twice (a can was drunk). (ui/Flat.tsx's SquareBar is the
 * same look without the sheen, for a bar with a number on it.)
 *
 *   <StatBar value={energy} className="mt-1.5 h-4" />
 *   <StatBar value={62} colors={["#60a5fa", "#a5f3fc"]} className="h-2.5" />
 *
 * `className` sets the height (h-4 by default) and any margin.
 */
export default function StatBar({ value, colors, className = "h-4", sheen = true }: {
  /** 0-100. */
  value: number;
  /** Two colours for the gradient; by default levelColors(value). */
  colors?: [string, string];
  className?: string;
  sheen?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const fill = colors ?? levelColors(v);
  const prev = useRef(v);
  const [boost, setBoost] = useState(0);
  useEffect(() => {
    if (v > prev.current) setBoost((b) => b + 1);
    prev.current = v;
  }, [v]);
  const still = typeof window !== "undefined" && prefersReducedMotion();
  return (
    <div className={`sk-sqbar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div
        className="relative h-full overflow-hidden"
        style={{ width: `${v}%`, background: `linear-gradient(180deg, ${fill[1]}, ${fill[0]} 70%)`, transition: still ? "none" : "width 900ms cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="absolute inset-x-0 top-0 h-1/3 bg-white/25" />
        {sheen && <div key={boost} className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent ${boost ? "kib-sheen-fast" : "kib-sheen"}`} />}
      </div>
      <div className="sk-sqbar-ticks" />
    </div>
  );
}
