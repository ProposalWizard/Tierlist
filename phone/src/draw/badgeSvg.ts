/**
 * The SVG the website shows for a club's badge or a nation's flag, made ready
 * for Skia's SVG reader. Pure code (tested by tools/draw-check.ts); drawn by
 * ClubBadge.tsx.
 */
import { badgeSvg } from "@/lib/star/clubBadge";
import { flagMarkup, hasDrawnFlag } from "@/lib/star/nationFlags";
import { nationKits } from "@/lib/star/international";
import { parseColor } from "./css";

/**
 * Skia's SVG reader may not take rgba()/hsl() colours in attributes: turn
 * fill="rgba(0,0,0,0.35)" into fill="#000000" fill-opacity="0.35".
 */
export function svgForSkia(svg: string): string {
  return svg.replace(/\b(fill|stroke|stop-color)="((?:rgba?|hsla?)\([^)]*\))"/g, (_m, attr: string, val: string) => {
    const c = parseColor(val);
    if (!c) return `${attr}="${val}"`;
    const hex = "#" + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
    const op = attr === "stop-color" ? "stop-opacity" : `${attr}-opacity`;
    return c[3] < 1 ? `${attr}="${hex}" ${op}="${+c[3].toFixed(4)}"` : `${attr}="${hex}"`;
  });
}

/**
 * What the website's ClubBadge shows: a nation's drawn flag in NationFlag's
 * rounded frame (rounded = max(2, size / 12), as ClubBadge passes), or the
 * club's drawn badge ("New" look, decided for everyone). w × h is the
 * picture's box inside the size × size square.
 */
export function badgeSvgFor(club: string, size: number): { svg: string; w: number; h: number; flag: boolean } {
  if (hasDrawnFlag(club)) {
    const kits = nationKits(club);
    const rx = (Math.max(2, size / 12) * 30) / size;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="none">`
      + `<defs><clipPath id="nf"><rect width="30" height="20" rx="${rx}"/></clipPath></defs>`
      + `<g clip-path="url(#nf)">${flagMarkup(club, [kits.home.shirt, kits.home.trim])}</g>`
      + `<rect x="0.4" y="0.4" width="29.2" height="19.2" rx="${rx}" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="0.8"/></svg>`;
    return { svg, w: size, h: Math.round((size * 2) / 3), flag: true };
  }
  return { svg: badgeSvg(club, "b"), w: size, h: size, flag: false };
}
