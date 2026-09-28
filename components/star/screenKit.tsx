"use client";

/**
 * SHARED BITS FOR THE RESKINNED SCREENS (League, Stats, Training, Relations).
 *
 * Harry, 28 Sep 2026: "all the pages should just be reskinned to fit the new
 * home screen vibe" and "that can animation is elite, we need stuff like
 * that all over". Everything here is built from the design kit
 * (components/star/ui) so these screens look like Home:
 *
 *   SegTabs      the Stats · Home · Shop tab strip's look, for a screen's own
 *                tabs (League's Table/Results/…, Stats' Season/All/Records).
 *   ChipTabs     a row of pills (the competition switcher).
 *   CardTitle    the small caps heading every Home card uses.
 *   useSeen      remembers a number between visits, so a screen that was
 *                away while it changed (a training level, a minigame) can
 *                still show the change when you come back.
 *   DeltaBar     a StatBar that glides from the old value to the new one
 *                with a floating "+3" and a spark burst: the can's juice,
 *                for any 0-100 bar.
 *
 * All motion is CSS from the kit and stops for a phone set to reduce motion;
 * the numbers themselves never depend on it.
 */
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { StatBar, FloatText, Burst, prefersReducedMotion, rgba, tint } from "./ui";

// ── Tabs ────────────────────────────────────────────────────────────────────

export function SegTabs<T extends string>({ tabs, value, onChange, small = false, className = "" }: {
  tabs: readonly (readonly [T, string])[];
  value: T;
  onChange: (t: T) => void;
  /** Tighter type for five tabs on a narrow screen (the phone's League app). */
  small?: boolean;
  className?: string;
}) {
  const i = Math.max(0, tabs.findIndex(([t]) => t === value));
  const n = tabs.length;
  if (small) {
    // The phone's League app is ~200 px wide: equal fifths cut "Fixtures"
    // off, so each tab takes the width its word needs and is lit itself.
    return (
      <div className={`flex gap-0.5 rounded-xl bg-black/30 p-1 ${className}`} style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`kib-press relative flex-auto rounded-lg px-1 py-1.5 text-[8.5px] font-black uppercase tracking-tight transition-colors ${t === value ? "bg-white/15 text-white" : "text-white/55"}`}
            style={t === value ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 2px 6px rgba(0,0,0,.35)" } : undefined}
          >
            {label}
            {t === value && <span className="absolute inset-x-2 -bottom-[3px] h-[3px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,.8)" }} />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={`relative grid rounded-xl bg-black/30 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>
      {/* The lit tab slides to the one you pick, like the home tabs. */}
      <div
        aria-hidden
        className="absolute bottom-1 top-1 rounded-lg bg-white/15"
        style={{
          width: `calc((100% - 0.5rem) / ${n})`, left: "0.25rem",
          transform: `translateX(${i * 100}%)`,
          transition: "transform 380ms cubic-bezier(.2,.9,.25,1.15)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 2px 6px rgba(0,0,0,.35)",
        }}
      >
        <div className="absolute inset-x-3 -bottom-[3px] h-[3px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,.8)" }} />
      </div>
      {tabs.map(([t, label]) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`kib-press relative z-10 min-w-0 truncate py-1.5 font-black uppercase transition-colors ${small ? "px-0.5 text-[8.5px] tracking-normal" : "text-[10px] tracking-wider min-[380px]:text-[11px]"} ${t === value ? "text-white" : "text-white/55"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ChipTabs({ items, index, onChange, glow }: {
  items: { key: string; label: string }[];
  index: number;
  onChange: (i: number) => void;
  glow: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c, i) => {
        const on = i === index;
        return (
          <button
            key={c.key}
            onClick={() => onChange(i)}
            className={`kib-press rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${on ? "text-white" : "text-white/70"}`}
            style={on
              ? { background: `linear-gradient(180deg, ${rgba(glow, 0.55)}, ${rgba(glow, 0.3)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px ${rgba(glow, 0.8)}, 0 4px 12px -4px ${rgba(glow, 0.8)}` }
              : { background: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.08)" }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function CardTitle({ children, className = "", tone = "text-white/70" }: { children: React.ReactNode; className?: string; tone?: string }) {
  return <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${tone} ${className}`}>{children}</div>;
}

/**
 * YOUR row, in any list or table: lit in your club's colours, bright enough
 * to find at a glance even for a dark kit (Chelsea navy read as "slightly
 * bluer" at the first strength, so the colour is lifted toward white).
 */
export function youRowStyle(glow: string): React.CSSProperties {
  const lit = tint(glow, 0.22);
  return {
    background: `linear-gradient(90deg, ${rgba(lit, 0.85)}, ${rgba(glow, 0.5)} 55%, ${rgba(glow, 0.3)})`,
    boxShadow: `inset 0 0 0 1.5px ${rgba(tint(glow, 0.5), 0.95)}, inset 0 1px 0 rgba(255,255,255,.25), 0 0 18px -2px ${rgba(lit, 0.9)}`,
  };
}

// ── Remembering a value between visits ─────────────────────────────────────

/** Whose numbers these are: one save is not another. */
export function seenScope(career: CareerState): string {
  return `${career.player.firstName}|${career.player.lastName}|${career.player.startYear}`;
}

const memory = new Map<string, string>();
function readSeen(key: string): string | undefined {
  if (memory.has(key)) return memory.get(key);
  try { const v = sessionStorage.getItem(`kib-seen:${key}`); if (v !== null) { memory.set(key, v); return v; } } catch { /* private window */ }
  return undefined;
}
function writeSeen(key: string, v: string) {
  memory.set(key, v);
  try { sessionStorage.setItem(`kib-seen:${key}`, v); } catch { /* ignore */ }
}

/**
 * A number that remembers what it was the last time you looked.
 *
 * Training a skill and playing a relationship minigame both happen on
 * another screen, so the bar that should move has been unmounted by the
 * time the number changes. This keeps the last value seen (this tab's
 * session), and when the screen comes back with a different one it shows
 * the old value for a beat, then moves to the new one and fires `trigger`
 * with the difference. A change while the screen is open (Rest) plays at
 * once. Marked as seen only when it actually plays, so React's dev
 * double-mount does not use it up.
 */
export function useSeen(key: string, value: number, { delay = 420 }: { delay?: number } = {}): { shown: number; delta: number; trigger: number } {
  const [state, setState] = useState(() => {
    const prev = typeof window === "undefined" ? undefined : readSeen(key);
    const p = prev === undefined ? NaN : Number(prev);
    return { shown: Number.isFinite(p) ? p : value, delta: 0, trigger: 0 };
  });
  const live = useRef(false);
  useEffect(() => {
    const prev = readSeen(key);
    const p = prev === undefined ? NaN : Number(prev);
    if (!Number.isFinite(p) || p === value) {
      writeSeen(key, String(value));
      setState((s) => (s.shown === value ? s : { ...s, shown: value }));
      live.current = true;
      return;
    }
    const wait = live.current || prefersReducedMotion() ? 0 : delay;
    const t = setTimeout(() => {
      writeSeen(key, String(value));
      live.current = true;
      setState((s) => ({ shown: value, delta: value - p, trigger: s.trigger + 1 }));
    }, wait);
    return () => clearTimeout(t);
  }, [key, value, delay]);
  return state;
}

// ── A bar that shows its change ────────────────────────────────────────────

const fmtDelta = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d * 10) / 10)}`;

/**
 * StatBar + the can's juice. Pass the remembered state from useSeen: the
 * bar glides from the old value, the piece it gained flashes white (so even
 * a +1 is seen), a "+3" floats up off the end (a red "−2" going down) and a
 * small spark burst goes off there, in the bar's colour.
 */
export function DeltaBar({ seen, colors, className = "h-3", label, burst = true, sheen = true }: {
  seen: { shown: number; delta: number; trigger: number };
  colors?: [string, string];
  className?: string;
  /** What the float says after the number ("+3 PACE"); number only if unset. */
  label?: string;
  burst?: boolean;
  sheen?: boolean;
}) {
  const up = seen.delta > 0;
  const tipV = Math.max(0, Math.min(100, seen.shown));
  const tip = `${Math.max(8, Math.min(88, tipV))}%`;
  const c = up ? (colors?.[0] ?? "#34d399") : "#fb7185";
  // The gained piece: from the old value to the new, at least a sliver wide.
  const from = Math.max(0, Math.min(tipV, tipV - Math.abs(seen.delta)));
  const gainW = Math.max(3, tipV - from);
  const played = seen.trigger > 0 && seen.delta !== 0;
  return (
    <div className="relative">
      <StatBar value={seen.shown} colors={colors} className={className} sheen={sheen} />
      {played && up && (
        <span
          key={`g${seen.trigger}`}
          aria-hidden
          className="kit-gain pointer-events-none absolute inset-y-0 rounded-full bg-white"
          style={{ left: `${Math.min(from, 100 - gainW)}%`, width: `${gainW}%`, boxShadow: `0 0 10px 2px ${rgba(c, 0.95)}, 0 0 4px #fff`, animationDelay: "250ms" }}
        />
      )}
      {played && (
        // Sparks and the float both come off the end of the bar.
        <div className="pointer-events-none absolute inset-y-0" style={{ left: tip }}>
          {up && burst && <Burst trigger={seen.trigger} colors={[c, "#ffffff", "#fde047"]} count={16} spread={0.5} round className="left-0 top-1/2" />}
          <FloatText
            trigger={seen.trigger}
            text={`${fmtDelta(seen.delta)}${label ? ` ${label}` : ""}`}
            color={c}
            size={17}
            className="left-0 -top-6"
            style={{ color: up ? "#ffffff" : "#fecdd3", textShadow: `0 0 10px ${c}, 0 0 3px ${c}, 0 2px 4px rgba(0,0,0,.8)` }}
          />
        </div>
      )}
    </div>
  );
}
