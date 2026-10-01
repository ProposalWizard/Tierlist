"use client";
import LiquidBar from "./LiquidBar";

/** Green when healthy, amber when low, red when nearly empty — the energy
 *  bar's colours, for any 0-100 bar that means "how much is left". */
export function levelColors(value: number): [string, string] {
  return value >= 60 ? ["#34d399", "#a3e635"] : value >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
}

/**
 * THE BAR EVERY SCREEN USES — the liquid bar (ui/LiquidBar.tsx) since v0.23.1:
 * one smooth glowing fill with rounded ends, no tick marks, a light that
 * keeps drifting along it, a fill that glides to its new value and a flash
 * when it goes UP (a can was drunk). Same thing as SquareBar.
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
  return <LiquidBar value={v} colors={colors ?? levelColors(v)} className={className} sheen={sheen} />;
}
