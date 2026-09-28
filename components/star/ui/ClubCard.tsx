"use client";
import type React from "react";
import { cardStyle, duelStyle } from "./theme";

/**
 * THE HOME CARD: club-colour glass, a layered shadow and a highlight along
 * the top edge.
 *
 *   <ClubCard glow={theme.glow} className="p-3">…</ClubCard>
 *   <ClubCard duel={[homeGlow, awayGlow]}>…</ClubCard>   two clubs meeting
 *
 * `strength` is how much of the club colour washes in from the top-left
 * corner (0.28 by default; the hero card uses 0.2). The rounding is
 * `rounded-2xl` unless `className` sets another.
 */
export default function ClubCard({ glow, strength = 0.28, duel, className = "", style, children, ...rest }: {
  glow?: string;
  strength?: number;
  duel?: [string, string];
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">) {
  const look = duel ? duelStyle(duel[0], duel[1]) : cardStyle(glow ?? "#2F6F4E", strength);
  const round = /\brounded(-|\b)/.test(className) ? "" : "rounded-2xl ";
  return (
    <div className={`${round}${className}`} style={{ ...look, ...style }} {...rest}>
      {children}
    </div>
  );
}
