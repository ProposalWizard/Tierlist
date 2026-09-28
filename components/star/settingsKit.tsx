"use client";

/**
 * SETTINGS IN THE HOME SCREEN'S LOOK (Harry, 28 Sep 2026: "all the pages
 * should just be reskinned to fit the new home screen vibe").
 *
 * The small pieces the Settings screen and the panels it mounts share, all
 * built from the design kit (components/star/ui): a club-lit glass card, a
 * card heading, a note line, and a lit on/off switch. Visual only — every
 * switch still calls exactly the handler it was given.
 */
import type React from "react";
import { ClubCard, rgba } from "./ui";

/** A glass card lit in `tone` (a hex colour). */
export function SetCard({ tone, strength = 0.28, className = "p-3", children, ...rest }: {
  tone: string;
  strength?: number;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return <ClubCard glow={tone} strength={strength} className={className} {...rest}>{children}</ClubCard>;
}

/** The small caps heading at the top of a card, in the card's own colour. */
export function SetHead({ tone, children, right, className = "" }: {
  tone?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: tone ? tintText(tone) : "rgba(255,255,255,.85)" }}>{children}</div>
      {right}
    </div>
  );
}

/** One line of explanation under a heading. */
export function SetNote({ children, className = "mt-1", dim = false }: { children: React.ReactNode; className?: string; dim?: boolean }) {
  return <p className={`text-[11px] font-semibold leading-snug ${dim ? "text-white/55" : "text-white/85"} ${className}`}>{children}</p>;
}

/** A thin rule between rows inside one card. */
export function SetDivider({ className = "my-2.5" }: { className?: string }) {
  return <div aria-hidden className={`h-px bg-gradient-to-r from-transparent via-white/15 to-transparent ${className}`} />;
}

/** A section header above a group of cards. */
export function SetSection({ children, tone, className = "mb-1.5 mt-4" }: { children: React.ReactNode; tone?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 px-0.5 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: tone ?? "rgba(255,255,255,.6)" }}>{children}</span>
      <span aria-hidden className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${rgba(tone ?? "#ffffff", 0.35)}, transparent)` }} />
    </div>
  );
}

/** The switch's look: a glossy track that lights green, a knob that slides. */
function Track({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block h-[26px] w-[46px] shrink-0 rounded-full transition-[background,box-shadow] duration-200"
      style={on
        ? { background: "linear-gradient(180deg, #4ade80, #10b981 60%, #047857)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 0 14px -2px rgba(16,185,129,.8)" }
        : { background: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))", boxShadow: "inset 0 2px 4px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.12)" }}
    >
      <span
        className="absolute left-0 top-[3px] h-5 w-5 rounded-full bg-gradient-to-b from-white to-gray-200 transition-transform duration-200 motion-reduce:transition-none"
        style={{ transform: `translateX(${on ? 23 : 3}px)`, boxShadow: "0 2px 5px rgba(0,0,0,.45), inset 0 -1px 0 rgba(0,0,0,.12)" }}
      />
    </span>
  );
}

/** An on/off switch that is a button (role="switch"). */
export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} aria-label={label} className="kib-press shrink-0 rounded-full">
      <Track on={on} />
    </button>
  );
}

/** An on/off switch that is still a real checkbox underneath. */
export function CheckSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative shrink-0">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
      <Track on={checked} />
    </span>
  );
}

/** A heading colour that reads on the dark card whatever the tone. */
function tintText(hex: string): string {
  return `color-mix(in srgb, ${hex} 70%, white 30%)`;
}
