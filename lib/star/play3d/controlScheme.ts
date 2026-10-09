/**
 * THE 3D DRILLS' CONTROLS — one scheme per device (Harry, 9 Oct 2026: "take
 * into account the difference in controls for pc and mobile and how to make
 * the gameplay best for both").
 *
 *   touch  a floating stick under the left thumb; the right half is the
 *          action (a swipe kicks, a tap touches); two fingers peek
 *   pc     WASD/arrows move, Shift sprints; the mouse is only the action
 *          (hold and let go kicks, click touches); Q/E look round; Space taps
 *
 * Auto picks by the pointer the device has (matchMedia "(pointer: coarse)"),
 * never by screen width. Settings → 3D world → "3D drill controls" overrides
 * it on this device. Kept free of three.js so Settings can import it.
 */
import { useSyncExternalStore } from "react";

export type ControlChoice = "auto" | "touch" | "pc";
export type ControlScheme = "touch" | "pc";
export const CONTROL_SCHEME_KEY = "star-3d-controls";

const listeners = new Set<() => void>();
let stored: ControlChoice | undefined;

function read(): ControlChoice {
  try {
    if (typeof location !== "undefined") {
      const q = new URLSearchParams(location.search).get("controls");
      if (q === "touch" || q === "pc") return q;
    }
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CONTROL_SCHEME_KEY) : null;
    return v === "touch" || v === "pc" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function controlChoice(): ControlChoice {
  if (stored === undefined) stored = read();
  return stored;
}

/** What "auto" means on this device: a coarse pointer (a finger) is touch, anything else is PC. */
export function detectScheme(): ControlScheme {
  try {
    return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? "touch" : "pc";
  } catch {
    return "touch";
  }
}

export function controlScheme(): ControlScheme {
  const c = controlChoice();
  return c === "auto" ? detectScheme() : c;
}

export function setControlChoice(c: ControlChoice) {
  stored = c;
  try { if (c === "auto") localStorage.removeItem(CONTROL_SCHEME_KEY); else localStorage.setItem(CONTROL_SCHEME_KEY, c); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CONTROL_SCHEME_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export function useControlChoice(): ControlChoice {
  return useSyncExternalStore(subscribe, controlChoice, () => "auto");
}
