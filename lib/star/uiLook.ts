/**
 * WHICH LOOK THE MENUS ARE IN — "classic" or "pitch".
 *
 * Harry, 1 Oct 2026: "Where's the green/football vibes? Everything is
 * purple/modern. Analyse the UI of NSS and see how it feels so fresh and
 * footbally, add a new toggle for a green/football vibes UI (still with all
 * the changes and animations and style but updates)."
 *
 * "pitch" restyles the star-career screens AROUND the match — grass-stripe
 * backgrounds, chalk-white edges, a condensed display font — through one
 * class on the star-dev root (`star-look-pitch`) and the CSS variables in
 * components/star/ui/pitchLook.css. No screen is forked: every screen keeps
 * its layout and animations, only colours and type change. The match itself
 * (canvas) is untouched.
 *
 * Saved per device, like the player look (figureSkin.ts).
 */
import { useSyncExternalStore } from "react";

export type UiLook = "classic" | "pitch";

/** THE ONE LINE: the look everyone gets when nobody has chosen. */
export const UI_LOOK_DEFAULT: UiLook = "classic";
export const UI_LOOK_KEY = "star-ui-look";

let stored: UiLook | null | undefined;
const listeners = new Set<() => void>();

function readStored(): UiLook | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(UI_LOOK_KEY);
    return v === "classic" || v === "pitch" ? v : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === UI_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function uiLook(): UiLook {
  if (stored === undefined) stored = readStored();
  return stored ?? UI_LOOK_DEFAULT;
}

export function setUiLook(look: UiLook): void {
  try { localStorage.setItem(UI_LOOK_KEY, look); } catch { /* in-memory still changes */ }
  stored = look;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The look, re-rendering when Settings flips it. Classic on the server. */
export function useUiLook(): UiLook {
  return useSyncExternalStore(subscribe, uiLook, () => UI_LOOK_DEFAULT);
}
