"use client";

/**
 * JUICE — little reward animations, in the spirit of the KIB can
 * (Harry, 28 Sep 2026: "that can animation is elite, we need stuff like
 * that all over").
 *
 * Each one is fired by a number that goes up: pass `trigger` a counter and
 * bump it (useTrigger gives you one). A trigger of 0 shows nothing, so
 * nothing plays when a screen first opens unless you want it to.
 *
 *   const [won, fireWon] = useTrigger();
 *   <div className="relative">
 *     <Burst trigger={won} colors={[theme.shirt, theme.trim, "#fde047"]} />
 *     <FloatText trigger={won} text="+★500" color="#fde047" />
 *   </div>
 *   <Shake trigger={used}><KibCanIcon … /></Shake>
 *   <Pop value={count}>×{count}</Pop>              bounces whenever count changes
 *   <div className="relative overflow-hidden …"><Shine trigger={levelUp} /></div>
 *
 * All CSS (motion.tsx), all switched off for a phone set to reduce motion.
 */
import type React from "react";
import { useCallback, useState } from "react";

/** A counter to fire juice with: `const [n, fire] = useTrigger(); fire();` */
export function useTrigger(): [number, () => void] {
  const [n, setN] = useState(0);
  const fire = useCallback(() => setN((v) => v + 1), []);
  return [n, fire];
}

/**
 * A BURST of confetti or particles from a point. `className` places the
 * origin inside a `relative` parent (the centre by default). `count` bits,
 * thrown `spread` px or so; `trigger` 0 = nothing. With `always` it bursts
 * on mount (the home screen's win celebration mounts it when it starts).
 */
export function Burst({ trigger = 1, colors, count = 22, spread = 1, className = "left-1/2 top-1/2", round = false }: {
  trigger?: number;
  colors: string[];
  count?: number;
  spread?: number;
  className?: string;
  /** Round particles (sparks) instead of paper confetti. */
  round?: boolean;
}) {
  if (!trigger) return null;
  const bits = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const d = (70 + (i * 37) % 60) * spread;
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 + 40 * spread, c: colors[i % colors.length], w: 4 + (i % 3) * 2, delay: (i % 5) * 40 };
  });
  return (
    <div key={trigger} className={`pointer-events-none absolute ${className}`}>
      {bits.map((b, i) => (
        <span
          key={i}
          className={`kib-confetti absolute block ${round ? "rounded-full" : "rounded-[1px]"}`}
          style={{ width: b.w, height: round ? b.w : b.w * 0.5, background: b.c, animationDelay: `${b.delay}ms`, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/**
 * A FLOATING LABEL — "+★500", "−1", "+3 PWR" — that pops up and drifts
 * away. Centred on `className`'s point inside a `relative` parent.
 * `motion="tick"` is the can's small "−1": a short rise from `className`'s
 * point, not centred.
 */
export function FloatText({ trigger, text, color, className = "left-1/2 top-0", size, motion = "float", style }: {
  trigger: number;
  text: string;
  /** Text colour; also lights a glow round it. */
  color?: string;
  className?: string;
  /** px; 14 for "float" unless given. */
  size?: number;
  motion?: "float" | "tick";
  style?: React.CSSProperties;
}) {
  if (!trigger) return null;
  const fontSize = size ?? (motion === "float" ? 14 : undefined);
  return (
    <span
      key={trigger}
      className={`${motion === "float" ? "kit-float pointer-events-none whitespace-nowrap tabular-nums " : "kib-minus "}absolute font-black ${className}`}
      style={{ ...(color ? { color, textShadow: `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,.7)` } : {}), ...(fontSize ? { fontSize } : {}), ...style }}
    >
      {text}
    </span>
  );
}

/**
 * SHAKE whatever is inside — the can's wobble-and-tip. Plays once per
 * trigger. `className`/`style` go on the wrapper (keep your layout on it).
 */
export function Shake({ trigger, className = "", style, children }: {
  trigger: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div key={trigger} className={`${className}${trigger ? " kib-shake" : ""}`} style={style}>
      {children}
    </div>
  );
}

/**
 * POP: a scale bounce every time `value` changes — a count, a score, a
 * price. Wraps inline content.
 */
export function Pop({ value, className = "", children }: {
  value: string | number;
  className?: string;
  children?: React.ReactNode;
}) {
  const [first] = useState(value);
  return (
    <span key={String(value)} className={`${value === first ? "inline-block" : "kit-pop"}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}

/**
 * SHINE: a bright sweep across a card or button. Put it inside an element
 * with `relative overflow-hidden`. Once per trigger, or forever with `loop`
 * (`every` seconds between sweeps).
 */
export function Shine({ trigger = 0, loop = false, every = 4, className = "" }: {
  trigger?: number;
  loop?: boolean;
  every?: number;
  className?: string;
}) {
  if (!loop && !trigger) return null;
  return (
    <span
      key={trigger}
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent ${loop ? "kit-shine-loop" : "kit-shine"} ${className}`}
      style={loop ? ({ animationDuration: `${every}s` } as React.CSSProperties) : undefined}
    />
  );
}

/**
 * DRIPS: a few drops falling from a point — the can emptying. Once per
 * trigger. `className` places the source inside a `relative` parent.
 */
export function Drips({ trigger, color, className = "left-[38%] top-[10%]", offsets = [-10, -3, 4], delay = 250 }: {
  trigger: number;
  color: string;
  className?: string;
  offsets?: number[];
  delay?: number;
}) {
  if (!trigger) return null;
  return (
    <>
      {offsets.map((dx, i) => (
        <span key={`${trigger}-${i}`} className={`kib-drop absolute block h-2 w-1.5 rounded-full ${className}`} style={{ background: color, animationDelay: `${delay + i * 90}ms`, ["--dx" as string]: `${dx}px` } as React.CSSProperties} />
      ))}
    </>
  );
}
