"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A NAME ON TAP (phone fix, 20 Oct 2026). A `title=` tooltip only shows on
 * a mouse hover, so on a phone a trophy or an icon had no name at all. Tap
 * it and a small label shows above it; it goes on the next tap anywhere or
 * after a few seconds. The `title` stays for a computer mouse.
 *
 * It is a span, not a button, so it can sit inside a button (a season row);
 * the tap does not reach the button under it.
 */
export function TapTip({ tip, children, className = "" }: { tip: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 2600);
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", away); };
  }, [open]);
  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={tip}
      title={tip}
      data-tap-tip
      className={`relative inline-flex cursor-pointer ${className}`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); } }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          data-tap-tip-open
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 w-max max-w-[180px] -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-center text-[10.5px] font-black leading-tight text-white shadow-lg ring-1 ring-white/20"
        >
          {tip}
        </span>
      )}
    </span>
  );
}
