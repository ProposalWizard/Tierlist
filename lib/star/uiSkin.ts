/**
 * THE NEW UI'S SKIN — "glass" or "pitch". Settings → Screens → "UI look".
 *
 * Harry, 1 Nov 2026: "go for glass stadium as a new UI option (make it
 * default)". Glass = the blurred day stadium behind every career screen,
 * frosted-glass cards and buttons, white type, a glowing green PLAY
 * (components/star/ui/glassLook.css, scoped under `.star-skin-glass`).
 * Pitch = the green stripes and chalk panels (pitchLook.css) as before.
 *
 * A skin, not a new UI: the screens, the save and every rule are the same;
 * `uiVersion()` stays "new" | "old", so nothing that checks it changes. The
 * Old UI never reads this. Stored per device, like uiLook.ts.
 */
import { useSyncExternalStore } from "react";

export type UiSkin = "glass" | "pitch";

/** THE ONE LINE: the skin everyone gets when nobody has chosen. */
export const UI_SKIN_DEFAULT: UiSkin = "glass";
export const UI_SKIN_KEY = "star-ui-skin";

let stored: UiSkin | null | undefined;
const listeners = new Set<() => void>();

function readStored(): UiSkin | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(UI_SKIN_KEY);
    return v === "glass" || v === "pitch" ? v : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === UI_SKIN_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function uiSkin(): UiSkin {
  if (stored === undefined) stored = readStored();
  return stored ?? UI_SKIN_DEFAULT;
}

export function setUiSkin(v: UiSkin): void {
  try { localStorage.setItem(UI_SKIN_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The skin, re-rendering when Settings flips it (the default until the
 *  phone's own choice is read, so most players never see a flash). */
export function useUiSkin(): UiSkin {
  return useSyncExternalStore(subscribe, uiSkin, () => UI_SKIN_DEFAULT);
}
