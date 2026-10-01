"use client";

/**
 * A DETAIL SHEET THAT SLIDES UP FROM THE BOTTOM — the "hover over it and it
 * actually shows something" of the Style shop and the boots shelf (Harry,
 * 30 Sep 2026). Tap a card on a phone, click it on a computer; tap outside,
 * press Esc or the × to close.
 */
import { useEffect } from "react";
import type React from "react";

export function weeksText(weeks: number): string {
  if (!Number.isFinite(weeks)) return "";
  if (weeks >= 100) return `${Math.round(weeks)} wks`;
  if (weeks >= 10) return `${weeks.toFixed(0)} wks`;
  if (weeks >= 1) return `${weeks.toFixed(1)} wks`;
  return `${weeks.toFixed(2)} wks`;
}

export default function ShopSheet({ open, onClose, title, children, accent = "#e879f9" }: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <style>{`@keyframes kibSheetUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@keyframes kibSheetFade{from{opacity:0}to{opacity:1}}`}</style>
      <button aria-label="Close" data-sheet-close onClick={onClose} className="absolute inset-0 bg-black/65" style={{ animation: "kibSheetFade .18s ease-out" }} />
      <div
        className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-t-3xl px-3 pb-6 pt-2"
        style={{
          background: "var(--sk-card, linear-gradient(180deg, #141b2b 0%, #0a0f1a 100%))",
          boxShadow: `0 -10px 40px -10px ${accent}88, inset 0 1px 0 rgba(255,255,255,.12)`,
          animation: "kibSheetUp .22s cubic-bezier(.2,.9,.3,1.1)",
        }}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/25" />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.2em] text-white/70">{title}</div>
          <button onClick={onClose} aria-label="Close" className="kib-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[18px] font-black leading-none text-white">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
