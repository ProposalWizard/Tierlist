"use client";
import { useEffect, useRef, useState } from "react";
import { rgba } from "@/components/star/legacy/ui/theme";
import { prefersReducedMotion } from "@/components/star/legacy/ui/motion";

/** Green when healthy, amber when low, red when nearly empty — the energy
 *  bar's colours, for any 0-100 bar that means "how much is left". */
export function levelColors(value: number): [string, string] {
  return value >= 60 ? ["#34d399", "#a3e635"] : value >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
}

/**
 * A GLOSSY BAR: gradient fill, a highlight on the top half, a sheen that
 * keeps sweeping along it, and a fill that glides to its new value. When the
 * value goes UP the sheen races across twice (a can was drunk).
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
    <div className={`relative overflow-hidden rounded-full bg-black/55 ${className}`} style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
      <div
        className="relative h-full overflow-hidden rounded-full"
        style={{ width: `${v}%`, background: `linear-gradient(90deg, ${fill[0]}, ${fill[1]})`, boxShadow: `0 0 14px ${rgba(fill[0], 0.7)}`, transition: still ? "none" : "width 900ms cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/35" />
        {sheen && <div key={boost} className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent ${boost ? "kib-sheen-fast" : "kib-sheen"}`} />}
      </div>
    </div>
  );
}
