"use client";
import type React from "react";
import { Chev } from "./Nav";

/**
 * THE ONE BACK BUTTON (navigation round 1, 21 Oct 2026; research §4.5 rule 4:
 * "One Back look. ‹ Back, same words everywhere"). Top left of a room. It goes
 * back to where you came from (page.tsx keeps the way back,
 * lib/star/navReturn.ts). Scenes keep the bottom bar's Back (ui/Nav.tsx BarButton).
 *
 *   <BackButton onClick={onBack} />
 *   <BackButton onClick={onBack} label="Menu" />   (only where Back means something else)
 *
 * Replaces "← Back", "‹ Back", "← Home" and the round "‹" on the rooms.
 */
export default function BackButton({ onClick, label = "Back", className = "", disabled = false, dark = false, ...rest }: {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Over a full-bleed picture (the Showroom): a darker glass so it reads. */
  dark?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  // Old labels arrive with their own arrow ("← Home"): the chevron is drawn here.
  const words = label.replace(/^[\s←‹<]+/, "") || "Back";
  return (
    <button
      type="button"
      data-back-button
      aria-label={rest["aria-label"] ?? words}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={`kib-press flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[12px] font-black uppercase tracking-wide text-white disabled:opacity-40 ${className}`}
      style={dark
        ? { background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)", backdropFilter: "blur(6px)" }
        : { background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.12), 0 8px 18px -10px rgba(0,0,0,.9)", backdropFilter: "blur(6px)" }}
    >
      <Chev dir="left" size={13} className="text-amber-300" />
      <span className="leading-none">{words}</span>
    </button>
  );
}
