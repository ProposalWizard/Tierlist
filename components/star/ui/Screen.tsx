"use client";

/**
 * A WHOLE SCREEN IN THE HOME SCREEN'S LOOK — wave 2 of the reskin (Harry,
 * 28 Sep 2026: "all the pages should just be reskinned to fit the new home
 * screen vibe").
 *
 *   <Screen glow={theme.glow}>
 *     <ScreenHeader title="Trophy Cabinet" kicker="Your career" onBack={back} />
 *     <div className="kit-card p-3">…</div>
 *   </Screen>
 *
 * `Screen` is the night-stadium backdrop (the sky warming into the club
 * colour, a faint crowd, two floodlight halos) with the page on top in the
 * game's usual narrow column. It renders <KitStyles /> and the classes
 * below, so any screen that uses it gets the kit's motion too.
 *
 * The classes are for screens with many cards and buttons (the Boardroom,
 * the Rule Book) where swapping a class is safer than rewriting markup:
 *
 *   kit-card        the home card (club-colour glass, layered shadow)
 *   kit-row         a row inside a card (faint glass)
 *   kit-input       a dark inset field
 *   kit-btn + kit-btn-{green,blue,glass,red,gold,violet,amber}
 *                   the kit's buttons: gradient, a top highlight, presses in
 *   kit-tabs / kit-tab / kit-tab-on
 *                   a segmented tab bar (the home STATS/HOME/SHOP look)
 *
 * They read the club colour from `--kit-glow`, which <Screen> sets.
 */
import type React from "react";
import { useEffect, useState } from "react";
import { KitStyles, prefersReducedMotion } from "./motion";
import { rgba } from "./theme";
import PressButton from "./PressButton";

export const SCREEN_CSS = `
  .kit-card {
    border-radius: 1rem;
    background:
      radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--kit-glow, #2F6F4E) 26%, transparent) 0%, transparent 55%),
      linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px color-mix(in srgb, var(--kit-glow, #2F6F4E) 22%, transparent), 0 10px 24px -12px rgba(0,0,0,.8), 0 2px 6px rgba(0,0,0,.35);
  }
  .kit-row { background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025)); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.05); }
  .kit-input { background: rgba(3,7,18,.72); box-shadow: inset 0 2px 4px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.10); border: 0 !important; color: #fff; }
  .kit-input:focus { outline: none; box-shadow: inset 0 2px 4px rgba(0,0,0,.6), inset 0 0 0 1px color-mix(in srgb, var(--kit-glow, #34d399) 70%, white 10%); }
  .kit-btn { font-weight: 900; color: #fff; transition: transform 120ms ease, filter 120ms ease; }
  .kit-btn:active:not(:disabled) { transform: scale(.95); filter: brightness(.92); }
  .kit-btn:disabled { opacity: .42; }
  .kit-btn-green  { background: linear-gradient(180deg, #4ade80, #10b981 55%, #047857); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.18), 0 6px 14px -6px rgba(16,185,129,.75); }
  .kit-btn-blue   { background: linear-gradient(180deg, #7cb4ff, #3b82f6 55%, #1d4ed8); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.18), 0 6px 14px -6px rgba(59,130,246,.75); }
  .kit-btn-red    { background: linear-gradient(180deg, #f87171, #dc2626 55%, #991b1b); box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 6px 14px -6px rgba(220,38,38,.7); }
  .kit-btn-gold   { color: #111827; background: linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 6px 14px -6px rgba(245,158,11,.7); }
  .kit-btn-amber  { background: linear-gradient(180deg, #fbbf24, #d97706 55%, #92400e); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 6px 14px -6px rgba(217,119,6,.7); }
  .kit-btn-violet { background: linear-gradient(180deg, #c4b5fd, #8b5cf6 55%, #6d28d9); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 6px 14px -6px rgba(139,92,246,.7); }
  .kit-btn-glass  { background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05)); box-shadow: inset 0 1px 0 rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.12), 0 6px 14px -10px rgba(0,0,0,.9); }
  .kit-tabs { display: flex; gap: 2px; border-radius: .9rem; padding: 3px; background: rgba(3,7,18,.6); box-shadow: inset 0 1px 3px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.06); }
  .kit-tab { flex: 1; border-radius: .7rem; padding: .4rem .25rem; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: rgba(255,255,255,.55); transition: color 150ms, background 150ms; }
  .kit-tab-on { color: #fff; background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06)); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -2px 0 color-mix(in srgb, var(--kit-glow, #34d399) 85%, white 10%); }
  @media (prefers-reduced-motion: reduce) { .kit-btn:active:not(:disabled) { transform: none; } }
`;

/** The night-stadium backdrop: sky warming into the club colour, a faint
 *  crowd, floodlight halos in the two top corners and a vignette. Fixed, so
 *  it stays put while a long screen scrolls over it. */
export function Backdrop({ glow, tone }: { glow: string; tone?: string }) {
  const low = tone ?? glow;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 55% at 50% -8%, ${rgba(glow, 0.42)} 0%, transparent 70%), radial-gradient(80% 45% at 50% 108%, ${rgba(low, 0.3)} 0%, transparent 70%), linear-gradient(180deg, #070b16 0%, #0a1020 50%, #05070d 100%)` }} />
      <div
        className="absolute inset-x-0 top-[3%] h-[34%]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,.26) 0.9px, transparent 1.4px), radial-gradient(circle, ${rgba(glow, 0.55)} 0.9px, transparent 1.4px)`,
          backgroundSize: "7px 6px, 11px 9px",
          backgroundPosition: "0 0, 3px 2px",
          maskImage: "linear-gradient(180deg, transparent, #000 30%, #000 50%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%, #000 50%, transparent)",
          opacity: 0.32,
        }}
      />
      <div className="kib-flood absolute -left-16 -top-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(220,235,255,.28), transparent)" }} />
      <div className="kib-flood absolute -right-16 -top-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(220,235,255,.28), transparent)", animationDelay: "1.6s" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 55%, rgba(0,0,0,.55) 100%)" }} />
    </div>
  );
}

/** The whole page: backdrop, kit styles, and a centred column. */
export function Screen({ glow, tone, className = "max-w-sm px-3 py-3", center = false, children }: {
  glow: string;
  /** A second colour for the bottom of the sky (the other club, a loss red). */
  tone?: string;
  /** The column's width and padding. */
  className?: string;
  /** Vertically centre a short screen. */
  center?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#05070d] text-white" style={{ ["--kit-glow" as string]: glow } as React.CSSProperties}>
      <KitStyles />
      <style>{SCREEN_CSS}</style>
      <Backdrop glow={glow} tone={tone} />
      <div className={`relative mx-auto w-full ${center ? "flex min-h-screen flex-col justify-center" : ""} ${className}`}>
        {children}
      </div>
    </div>
  );
}

/** A small caps label over a section. */
export function SectionLabel({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ${className}`}>{children}</div>;
}

/** The home screen's "NEXT MATCH" chip. */
export function Kicker({ children, color = "#6ee7b7", className = "" }: { children?: React.ReactNode; color?: string; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.2em] ${className}`} style={{ color, background: rgba(color, 0.14), boxShadow: `inset 0 0 0 1px ${rgba(color, 0.3)}` }}>
      {children}
    </span>
  );
}

/** A big title in the home screen's type: heavy caps, white fading down. */
export function Title({ children, className = "text-[22px]" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gradient-to-b from-white to-white/70 bg-clip-text font-black uppercase leading-tight tracking-tight text-transparent ${className}`} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}>
      {children}
    </div>
  );
}

/** Back button, a title (with a kicker above it) and an optional slot on
 *  the right. The back button is the kit's glass one. */
export function ScreenHeader({ title, kicker, kickerColor, onBack, right, backLabel = "← Back" }: {
  title: React.ReactNode;
  kicker?: React.ReactNode;
  kickerColor?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  backLabel?: string;
}) {
  return (
    <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
      {onBack ? <PressButton variant="secondary" size="sm" onClick={onBack} className="normal-case tracking-normal">{backLabel}</PressButton> : <span />}
      <div className="min-w-0 text-center">
        {kicker && <div className="truncate text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: kickerColor ?? "#fcd34d" }}>{kicker}</div>}
        <Title className="truncate text-[19px]">{title}</Title>
      </div>
      <div className="flex min-w-[3.5rem] justify-end">{right}</div>
    </div>
  );
}

/** Light rays turning slowly behind a trophy (put it first inside a
 *  `relative` box; it centres itself). Still for reduced motion. */
export function Rays({ color = "#fde68a", size = 220, className = "" }: { color?: string; size?: number; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`} style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}>
      <div
        className="kit-rays h-full w-full rounded-full"
        style={{
          background: `repeating-conic-gradient(${rgba(color, 0.22)} 0deg 9deg, transparent 9deg 24deg)`,
          maskImage: "radial-gradient(closest-side, #000 20%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(closest-side, #000 20%, transparent 100%)",
        }}
      />
    </div>
  );
}

/** Three bouncing dots — "counting…", "drawing…". */
export function Dots({ className = "" }: { className?: string }) {
  return <span className={`kit-dots ${className}`}><span>•</span><span>•</span><span>•</span></span>;
}

/**
 * True once `ms` have passed since the screen opened — for staging a reveal
 * (the score, then the rating, then the money). Straight away for a phone set
 * to reduce motion, so nothing is ever held back from someone who asked for
 * less movement. Every number is still the real one either way.
 */
export function useLater(ms: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion() || ms <= 0) { setOn(true); return; }
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return on;
}
