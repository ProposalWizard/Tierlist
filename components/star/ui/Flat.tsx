"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { rgba } from "./theme";

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
 * THE SQUARE BAR — a square-cornered, clearly outlined progress bar with ten
 * ruler ticks (Harry, P85/P107: "squares with very clear, maybe even
 * animated, progress"). `animate` marches stripes along the fill; going UP
 * flashes it once. Give it a height with `className` (h-3 by default). Put a
 * number or label over it with `children`.
 *
 *   <SquareBar value={energy} colors={["#34d399", "#a3e635"]} className="h-4" animate>85</SquareBar>
 */
export function SquareBar({ value, colors = ["#fbbf24", "#fde68a"], className = "h-3", animate = false, ticks = true, children }: {
  /** 0-100. */
  value: number;
  colors?: [string, string];
  className?: string;
  animate?: boolean;
  ticks?: boolean;
  /** Over the bar, centred (a number). */
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(100, value));
  const prev = useRef(v);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (v > prev.current) setPop((n) => n + 1);
    prev.current = v;
  }, [v]);
  return (
    <div className={`sk-sqbar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div key={pop} className={`sk-sqbar-fill ${pop ? "sk-sqbar-pop" : ""}`} style={{ width: `${v}%`, background: `linear-gradient(180deg, ${colors[1]}, ${colors[0]} 70%)` }}>
        {animate && v > 0 && <div className="sk-sqbar-anim" />}
      </div>
      {ticks && <div className="sk-sqbar-ticks" />}
      {children != null && <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black leading-none tabular-nums text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.8)" }}>{children}</div>}
    </div>
  );
}
