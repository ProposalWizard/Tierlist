"use client";
/**
 * lib/star/tapFeel.ts — every tap is felt the moment the finger lands.
 *
 * Stage 1 of the tap-speed work (Harry and Mikey, 18-19 Nov 2026: "the speed
 * of button presses and page movements is very noticeable"; the game should
 * feel like a proper app). Measured: buttons only reacted on finger-up, the
 * press-in look was often never painted because the next screen was already
 * being built, iPhones showed no press look at all (Safari only applies
 * :active when a touch listener exists), and menus had no haptic.
 *
 * One listener on the document (installTapFeel, once per page):
 *  - finger down on a button: it gets data-kib-pressed at once (ui/kit.css
 *    draws the press-in from it), and the phone gives a light tick;
 *  - finger up / cancel: the attribute goes.
 * The action itself still runs on finger-up (onClick), so a scroll never
 * presses a button and every tutorial pointer still sees the click.
 *
 * Haptic: in the packed app through the phone's own haptics (Capacitor
 * Haptics.impact LIGHT; iPhone has no navigator.vibrate). On the website no
 * menu buzz (a browser buzz is coarse and long). Settings → "Vibration"
 * switches every buzz off, the match's included (matchFeel.feelHaptic).
 */
import { useSyncExternalStore } from "react";
import { PACKED_APP } from "@/lib/app/packed";

const KEY = "kib-vibration";
let on: boolean | undefined;
const listeners = new Set<() => void>();

/** Settings → Vibration. Default on. Stored on this phone only. */
export function vibrationOn(): boolean {
  if (on === undefined) {
    try { on = localStorage.getItem(KEY) !== "off"; } catch { on = true; }
  }
  return on;
}
export function setVibrationOn(v: boolean): void {
  try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* in-memory still changes */ }
  on = v; listeners.forEach((f) => f());
}
export function useVibrationOn(): boolean {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, vibrationOn, () => true);
}

type Haptics = { impact?: (o: { style: string }) => unknown; selectionChanged?: () => unknown };
function haptics(): Haptics | null {
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, Haptics>; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.Plugins || (cap.isPluginAvailable && !cap.isPluginAvailable("Haptics"))) return null;
  return cap.Plugins.Haptics ?? null;
}

/** The light tick of a button press. Never waits, never throws. */
export function tapHaptic(): void {
  if (!PACKED_APP || !vibrationOn()) return;
  try { void haptics()?.impact?.({ style: "LIGHT" }); } catch { /* no tick */ }
}

const PRESSABLE = "button, [role=button], a[href], [data-tap]";
let installed = false;
let pressed: Element | null = null;

function release() {
  pressed?.removeAttribute("data-kib-pressed");
  pressed = null;
}

/** Install once (the career page calls it on mount). Safe to call again. */
export function installTapFeel(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const el = (e.target as Element | null)?.closest?.(PRESSABLE);
    release();
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    if (el.closest("[data-kib-nopress]")) return;
    el.setAttribute("data-kib-pressed", "");
    pressed = el;
    tapHaptic();
  }, { capture: true, passive: true });
  for (const type of ["pointerup", "pointercancel", "dragstart"] as const) {
    document.addEventListener(type, release, { capture: true, passive: true });
  }
  // iPhone: Safari applies :active only when the page has a touch listener.
  document.addEventListener("touchstart", () => {}, { passive: true });
}
