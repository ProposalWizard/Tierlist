"use client";
import type React from "react";
import { rgba, tint } from "./theme";

type Variant = "primary" | "secondary" | "danger" | "gold" | "accent" | "plain";
type Size = "sm" | "md" | "lg" | "none";

/** Sizes also set the type (bold caps); `none` leaves both to className. */
const SIZE: Record<Size, string> = {
  sm: "rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide",
  md: "rounded-xl px-4 py-2.5 text-[13px] font-black uppercase tracking-wide",
  lg: "rounded-2xl px-5 py-3.5 text-[16px] font-black uppercase tracking-wide",
  none: "",
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "text-white disabled:opacity-45",
  secondary: "text-white disabled:opacity-45",
  danger: "text-white disabled:opacity-45",
  gold: "text-gray-950 disabled:opacity-45",
  accent: "text-gray-950 disabled:text-white/45",
  plain: "",
};

function variantStyle(variant: Variant, accent: string, disabled: boolean): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "linear-gradient(180deg, #4ade80, #10b981 55%, #047857)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.18), 0 8px 18px -6px rgba(16,185,129,.75)" };
    case "secondary":
      return { background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.12), 0 8px 18px -10px rgba(0,0,0,.9)", backdropFilter: "blur(6px)" };
    case "danger":
      return { background: "linear-gradient(180deg, #f87171, #dc2626 55%, #991b1b)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 8px 18px -6px rgba(220,38,38,.7)" };
    case "gold":
      return { background: "linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 8px 18px -6px rgba(245,158,11,.7)" };
    case "accent":
      return disabled
        ? { background: "rgba(55,65,81,.8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" }
        : { background: `linear-gradient(180deg, ${tint(accent, 0.3)}, ${accent} 55%, ${tint(accent, -0.15)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -3px ${rgba(accent, 0.8)}` };
    default:
      return {};
  }
}

/**
 * A BUTTON THAT PRESSES IN. Every button in the kit squashes a little under
 * the finger (kib-press) and can pulse to say "this one" (the Play button's
 * pulse).
 *
 *   <PressButton variant="primary" pulse onClick={go}>Continue</PressButton>
 *   <PressButton variant="secondary" size="sm">Settings</PressButton>
 *   <PressButton variant="danger">Delete</PressButton>
 *   <PressButton variant="accent" accent="#60a5fa" size="none" className="w-full py-1.5">Use</PressButton>
 *   <PressButton className="rounded-lg bg-black/35 …">Buy</PressButton>   (plain: bring your own look)
 *
 * `accent` is any hex colour, lit like the can buttons. `size="none"` leaves
 * the padding and rounding to `className`.
 */
export default function PressButton({ variant = "plain", size, accent = "#34d399", pulse = false, className = "", style, disabled, children, ...rest }: {
  variant?: Variant;
  size?: Size;
  accent?: string;
  pulse?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz = SIZE[size ?? (variant === "plain" || variant === "accent" ? "none" : "md")];
  const cls = ["kib-press", pulse && !disabled ? "kib-play-pulse" : "", sz, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return (
    <button disabled={disabled} className={cls} style={{ ...variantStyle(variant, accent, !!disabled), ...style }} {...rest}>
      {children}
    </button>
  );
}
