"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import "./flat.css";

/**
 * NAVIGATION THE NSS WAY (Harry, 1 Oct 2026 review: P41 "your bottom should
 * always have everything on there", P47 "a little arrow here with an image,
 * arrow here, image, the little word", P85-P87 "a little question mark pop-up",
 * P88 "more like an actual phone"). Flat, square, no floating pills. Built on
 * the v0.23 look (flat.css): heavy font, square corners, hairline edges.
 *
 *   <EdgeArrows prev={{ icon: "📅", label: "Season", onClick }} next={{ icon: "🏅", label: "Records", onClick }}>All seasons</EdgeArrows>
 *   <BottomBar><BarButton icon="‹" label="Back" onClick={back} /><BarButton icon="👗" label="Drip" onClick={…} /><BarButton primary icon="★" label="Buy" onClick={…} /></BottomBar>
 *   <HelpDot text="A good relationship with the team means more chances in a match." />
 *   <HomeBar onActivate={close} label="Close phone" />
 */

/** A chevron drawn as a shape (the heavy font's ‹ › are tiny and uneven). */
export function Chev({ dir = "left", size = 14, className = "" }: { dir?: "left" | "right"; size?: number; className?: string }) {
  return (
    <svg width={size * 0.64} height={size} viewBox="0 0 9 14" aria-hidden className={`shrink-0 ${className}`}>
      <path d={dir === "left" ? "M8 1 1.5 7 8 13Z" : "M1 1 7.5 7 1 13Z"} fill="currentColor" />
    </svg>
  );
}

// ── Edge arrows ─────────────────────────────────────────────────────────────

export interface EdgeArrow { icon?: React.ReactNode; label: string; onClick: () => void; /** A dot on the arrow: something new there. */ dot?: boolean }

const ARROW_BG = "linear-gradient(180deg, rgba(var(--sk-flat-rgb),.78), rgba(var(--sk-flat-rgb),.55))";

function Arrow({ side, a }: { side: "left" | "right"; a: EdgeArrow }) {
  const tri = (
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden className="shrink-0">
      <path d={side === "left" ? "M8 1 1.5 7 8 13Z" : "M1 1 7.5 7 1 13Z"} fill="currentColor" />
    </svg>
  );
  return (
    <button
      onClick={a.onClick}
      aria-label={`${side === "left" ? "Previous" : "Next"}: ${a.label}`}
      className={`kib-press relative flex h-[30px] min-w-0 items-center gap-1 px-2 text-white ${side === "right" ? "flex-row-reverse text-right" : ""}`}
      style={{ background: ARROW_BG, borderRadius: 2, boxShadow: "inset 0 0 0 1px var(--sk-edge, rgba(255,255,255,.22))" }}
    >
      <span className="text-amber-300">{tri}</span>
      {a.icon != null && <span className="shrink-0 text-[14px] leading-none">{a.icon}</span>}
      <span className="min-w-0 truncate text-[12px] font-black uppercase leading-none tracking-wide">{a.label}</span>
      {a.dot && <span className="absolute -top-1 h-2.5 w-2.5 bg-red-500" style={{ [side === "left" ? "left" : "right"]: -2, borderRadius: 1 }} />}
    </button>
  );
}

/**
 * ONE ROW, ARROWS AT THE LEFT AND RIGHT EDGES — the whole of a screen's view
 * switching. The left arrow shows the view behind you (an image and a word),
 * the right one the view ahead; the middle says where you are. A missing side
 * leaves its edge empty. About 30px tall, against the 100px the three stacked
 * tab rows used to take.
 */
export function EdgeArrows({ prev, next, children, className = "" }: {
  prev?: EdgeArrow; next?: EdgeArrow; children?: React.ReactNode; className?: string;
}) {
  return (
    <div data-edge-arrows className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 ${className}`}>
      <div className="flex justify-start">{prev ? <Arrow side="left" a={prev} /> : null}</div>
      <div className="max-w-[40vw] truncate text-center text-[13px] font-black uppercase leading-none tracking-wider text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>{children}</div>
      <div className="flex justify-end">{next ? <Arrow side="right" a={next} /> : null}</div>
    </div>
  );
}

// ── Bottom bar ──────────────────────────────────────────────────────────────

/**
 * THE BOTTOM BAR — Back, the page's own switch, the page's action (NSS:
 * Back / Lifestyle / Buy). Fixed to the bottom of the screen, full width,
 * flat, with a hairline on top. Give the page `pb-[76px]` so nothing hides
 * behind it.
 */
export function BottomBar({ children, className = "", cols }: { children: React.ReactNode; className?: string; /** Custom grid columns, e.g. "1fr 1.6fr 1fr". */ cols?: string }) {
  const n = Array.isArray(children) ? children.filter(Boolean).length : 1;
  return (
    <div
      data-bottom-bar
      className={`fixed inset-x-0 bottom-0 z-40 ${className}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)", background: "linear-gradient(180deg, rgba(var(--sk-flat-rgb,0,0,0),.82), rgba(var(--sk-flat-rgb,0,0,0),.96))", boxShadow: "inset 0 1px 0 var(--sk-edge, rgba(255,255,255,.22)), 0 -8px 18px -10px rgba(0,0,0,.8)" }}
    >
      <div className="mx-auto grid w-full max-w-md gap-px" style={{ gridTemplateColumns: cols ?? `repeat(${Math.max(1, n)}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </div>
  );
}

export function BarButton({ icon, label, onClick, primary = false, disabled = false, dot = false, ariaLabel }: {
  icon?: React.ReactNode; label: string; onClick: () => void; primary?: boolean; disabled?: boolean; dot?: boolean; ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={`kib-press relative flex h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 disabled:opacity-40 ${primary ? "text-gray-950" : "text-white"}`}
      style={primary ? { background: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" } : { background: "rgba(255,255,255,.04)" }}
    >
      {icon != null && <span className="text-[18px] leading-none">{icon}</span>}
      <span className="max-w-full truncate text-[12px] font-black uppercase leading-none tracking-wide">{label}</span>
      {dot && <span className="absolute right-[28%] top-1.5 h-2.5 w-2.5 bg-red-500" style={{ borderRadius: 1 }} />}
    </button>
  );
}

// ── Help "?" ────────────────────────────────────────────────────────────────

/**
 * A SMALL "?" THAT SAYS ONE LINE (Harry, P85-P87: "all that's needed is those
 * help pop-ups one time, and then maybe like a little question mark … where you
 * can just click if they're confused"). Tap to open, tap again or anywhere
 * else to close. The bubble opens under the "?" and keeps inside the screen.
 */
export function HelpDot({ text, className = "" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="What is this?"
        aria-expanded={open}
        className="kib-press grid h-[22px] w-[22px] place-items-center text-[13px] font-black leading-none text-white"
        style={{ background: open ? "rgba(251,191,36,.9)" : "rgba(255,255,255,.14)", color: open ? "#111827" : "#fff", borderRadius: 2, boxShadow: "inset 0 0 0 1px var(--sk-edge, rgba(255,255,255,.3))" }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-40 mt-1 w-[210px] bg-gray-950 px-2.5 py-2 text-left text-[12px] font-semibold leading-snug text-white"
          style={{ borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(251,191,36,.7), 0 8px 18px -6px rgba(0,0,0,.9)" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── Phone home bar ──────────────────────────────────────────────────────────

/**
 * THE PHONE'S HOME BAR — the thin white bar at the bottom of a real phone
 * (Harry, P88: "more like an actual phone"). Tap it, or swipe up from it, to
 * go home / put the phone down. Replaces the "✕ CLOSE PHONE" pill.
 */
export function HomeBar({ onActivate, label = "Home" }: { onActivate: () => void; label?: string }) {
  const start = useRef<number | null>(null);
  const swiped = useRef(false);
  const [lift, setLift] = useState(0);
  return (
    <div className="flex shrink-0 justify-center pb-1 pt-0.5">
      <button
        aria-label={label}
        onClick={() => { if (swiped.current) { swiped.current = false; return; } onActivate(); }}
        onPointerDown={(e) => { swiped.current = false; start.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (start.current !== null) setLift(Math.max(0, Math.min(14, start.current - e.clientY))); }}
        onPointerUp={(e) => {
          const up = start.current !== null ? start.current - e.clientY : 0;
          start.current = null; setLift(0);
          // A swipe up closes; a tap is the click above.
          if (up > 22) { swiped.current = true; onActivate(); }
        }}
        className="grid h-[22px] w-[150px] touch-none place-items-center"
      >
        <span className="block h-[5px] w-[112px] rounded-full bg-white/85" style={{ transform: `translateY(${-lift}px)`, boxShadow: "0 0 6px rgba(255,255,255,.35)" }} />
      </button>
    </div>
  );
}

// ── Empty pages ─────────────────────────────────────────────────────────────

/**
 * AN EMPTY PAGE IS NOT A BLANK ONE (Harry, P90: "this page now is super
 * empty … you see how the girlfriend and sponsors are just blacked out? You
 * don't have any at the moment"). A few blacked-out slots in the shape of the
 * things that will be here, with an icon over them. No words.
 */
export function EmptySlots({ rows = 3, icon = "🔔", className = "" }: { rows?: number; icon?: React.ReactNode; className?: string }) {
  return (
    <div role="img" aria-label="Nothing here yet" data-empty-slots className={`relative px-3 pt-3 ${className}`}>
      <div className="space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5 opacity-90" style={{ opacity: 1 - i * 0.18 }}>
            <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: "linear-gradient(160deg, #0b0f17, #020304)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }} />
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="block h-2.5 w-2/5 bg-black/70" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }} />
              <span className="block h-2.5 w-4/5 bg-black/55" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)" }} />
            </span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-[34px]" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.7))", opacity: 0.55 }}>{icon}</div>
    </div>
  );
}
