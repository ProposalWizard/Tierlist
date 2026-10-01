"use client";

/**
 * YOUR CLUB'S COLOURS, READY TO LIGHT A SCREEN.
 *
 * `useClubTheme(career)` is the one call a screen needs to be themed like
 * the home screen: the home kit, a `glow` colour that shows on a dark card
 * (very dark kits are lifted, white kits fall back to their trim), and the
 * card look every home card shares.
 */
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { rgba, tint, luminance } from "@/lib/star/heroFigure";

export { rgba, tint, luminance };

/** A shirt colour that can light a dark card: very dark kits (black, navy)
 *  are lifted so the glow still shows; white kits fall back to their trim. */
export function glowOf(shirt: string, trim: string): string {
  const base = luminance(shirt) > 0.85 ? trim : shirt;
  return luminance(base) < 0.12 ? tint(base, 0.35) : base;
}

export interface ClubTheme {
  club: string;
  shirt: string;
  trim: string;
  /** The colour to light cards, glows and rims with. */
  glow: string;
}

/** The theme for a club by name (either side of a fixture, say). */
export function clubTheme(club: string, career?: Pick<CareerState, "clubKits"> | null): ClubTheme {
  const kit = kitsOf(club, career?.clubKits?.[club]).home;
  return { club, shirt: kit.shirt, trim: kit.trim, glow: glowOf(kit.shirt, kit.trim) };
}

/** Your club's theme. With no career (the title screen before any save)
 *  it is the game's own neutral green. */
export function useClubTheme(career: CareerState | null | undefined): ClubTheme {
  return clubTheme(career?.player.club ?? "", career);
}

/** The card look every home card shares: club-tinted glass, layered shadow,
 *  a soft highlight along the top edge. */
export function cardStyle(glow: string, strength = 0.28): React.CSSProperties {
  return {
    background: `radial-gradient(120% 140% at 0% 0%, ${rgba(glow, strength)} 0%, transparent 55%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96)))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px var(--sk-chalk, ${rgba(glow, 0.22)}), ${"var(--sk-lift, 0 10px 24px -12px rgba(0,0,0,.8), 0 2px 6px rgba(0,0,0,.35))"}`,
  };
}

/** Two clubs meeting: each side lit in its own colour (the next-match card). */
export function duelStyle(left: string, right: string): React.CSSProperties {
  return {
    background: `radial-gradient(90% 120% at 0% 50%, ${rgba(left, 0.42)} 0%, transparent 58%), radial-gradient(90% 120% at 100% 50%, ${rgba(right, 0.42)} 0%, transparent 58%), var(--sk-card, linear-gradient(180deg, #172033, #0a0f1a))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px var(--sk-chalk, rgba(255,255,255,.08)), ${"var(--sk-lift, 0 12px 26px -14px rgba(0,0,0,.9), 0 2px 6px rgba(0,0,0,.35))"}`,
  };
}
