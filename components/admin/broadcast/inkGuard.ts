"use client";
/**
 * The ink guard: keeps words readable when an admin page is shown in a LIGHT
 * look (Clean light, Bento). Harry, 20 Oct 2026: every look is the same page
 * in a different skin. But the ~40 admin and test pages were written for the
 * dark Broadcast look: many draw their own dark tiles (a table, a level grid,
 * a match card) and many write plain white words. On a white page those turn
 * into dark-on-dark or white-on-white.
 *
 * Instead of a second stylesheet per page, this looks at what is really on
 * the screen, the same way a person would:
 *  1. Any box painted dark (its own colour or gradient, laid over white) is a
 *     "dark island": inside it the frame's ink tokens switch back to the light
 *     ones (data-ink="dark" in skins.css). A light box inside an island gets
 *     the dark ink back (data-ink="light").
 *  2. Then any words that still nearly match what is behind them get the
 *     opposite ink (data-ink-fix="dark" | "light").
 * It runs only in the light looks, again whenever the page changes (short
 * wait), and takes every mark away when the look goes dark again.
 */
import { useEffect, type RefObject } from "react";

type RGBA = [number, number, number, number];
const NUM = /rgba?\(([^)]+)\)/g;

function parse(c: string): RGBA | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
const chan = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r: number, g: number, b: number) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
/** A colour laid over a base colour. */
const over = (c: RGBA, base: [number, number, number]): [number, number, number] =>
  [c[0] * c[3] + base[0] * (1 - c[3]), c[1] * c[3] + base[1] * (1 - c[3]), c[2] * c[3] + base[2] * (1 - c[3])];

/** The box's own paint (colour + gradient stops, averaged), or null if it is (nearly) see-through. */
function paintOf(cs: CSSStyleDeclaration): RGBA | null {
  const stops: RGBA[] = [];
  const bg = parse(cs.backgroundColor);
  if (bg && bg[3] > 0.05) stops.push(bg);
  if (cs.backgroundImage && cs.backgroundImage.includes("gradient")) {
    for (const m of cs.backgroundImage.match(NUM) ?? []) { const c = parse(m); if (c) stops.push(c); }
  }
  if (!stops.length) return null;
  const a = stops.reduce((s, c) => s + c[3], 0) / stops.length;
  if (a < 0.35) return null;
  const n = stops.length;
  return [stops.reduce((s, c) => s + c[0], 0) / n, stops.reduce((s, c) => s + c[1], 0) / n, stops.reduce((s, c) => s + c[2], 0) / n, a];
}

const SKIP = "canvas, video, img, svg, iframe, [data-page-guide], [data-back-arrow]";
const DARK = 0.19; // laid over white, darker than this = a dark island
const PAGE: [number, number, number] = [246, 248, 247];

export function clearInk(root: HTMLElement) {
  root.querySelectorAll("[data-ink], [data-ink-fix]").forEach((el) => { el.removeAttribute("data-ink"); el.removeAttribute("data-ink-fix"); });
}

export function markInk(root: HTMLElement) {
  // Read everything first, then write: one style pass, not one per box.
  const all = Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => !el.closest(SKIP));
  const paints = all.map((el) => paintOf(getComputedStyle(el)));
  // 1. Islands: every painted box, laid over what it sits on (top-down, so the inner one wins).
  const surface = new Map<Element, [number, number, number]>();
  const ink: (string | null)[] = all.map(() => null);
  all.forEach((el, i) => {
    const p = paints[i];
    if (!p) return;
    let base = PAGE;
    for (let up = el.parentElement; up && up !== root.parentElement; up = up.parentElement) { const s = surface.get(up); if (s) { base = s; break; } }
    const rgb = over(p, base);
    surface.set(el, rgb);
    ink[i] = lum(...rgb) < DARK ? "dark" : "light";
  });
  const texty = all.map((el) => Array.prototype.some.call(el.childNodes, (n: ChildNode) => n.nodeType === 3 && !!(n.textContent ?? "").trim()));
  all.forEach((el, i) => {
    const want = ink[i];
    if (want ? el.getAttribute("data-ink") !== want : el.hasAttribute("data-ink")) { if (want) el.setAttribute("data-ink", want); else el.removeAttribute("data-ink"); }
    if (texty[i]) el.removeAttribute("data-ink-fix");
  });
  // 2. Words that still nearly match what is behind them get the opposite ink.
  const fixes: [HTMLElement, string][] = [];
  all.forEach((el, i) => {
    if (!texty[i]) return;
    const cs = getComputedStyle(el);
    const c = parse(cs.color);
    if (!c || cs.visibility === "hidden") return;
    let base = PAGE;
    for (let up: Element | null = el; up && up !== root.parentElement; up = up.parentElement) { const s = surface.get(up); if (s) { base = s; break; } }
    const T = lum(...over(c, base)), B = lum(...base);
    const ratio = (Math.max(T, B) + 0.05) / (Math.min(T, B) + 0.05);
    if (ratio < 3) fixes.push([el, B > 0.3 ? "dark" : "light"]);
  });
  for (const [el, v] of fixes) el.setAttribute("data-ink-fix", v);
}

/** Run the guard on `root` while `on` (a light look). */
export function useInkGuard(root: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!on) { clearInk(el); return; }
    let t: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const run = () => { t = null; last = Date.now(); markInk(el); };
    // A page that changes all the time (a match ticking) is looked at once a second at most.
    const soon = () => { if (t) clearTimeout(t); t = setTimeout(run, Math.max(250, last + 1000 - Date.now())); };
    run();
    const late = setTimeout(run, 1500);
    const mo = new MutationObserver(soon);
    mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-pressed", "aria-selected", "data-on", "data-open", "open"] });
    return () => { mo.disconnect(); if (t) clearTimeout(t); clearTimeout(late); clearInk(el); };
  }, [root, on]);
}
