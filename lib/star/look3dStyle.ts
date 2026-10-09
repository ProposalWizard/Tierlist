/**
 * THE 3D LOOK SWITCH — Settings → Look → "3D look: H | Old" (Harry, 9 Oct
 * 2026: make look H, Console Realism, "AMAZING … across the game").
 *
 *   H    the 3D drills play in a full stadium (real sky light, a PBR pitch,
 *        a crowd, the broadcast pass: lib/star/style3d/real); the garden and
 *        the 3D shop get the real sky's light and the broadcast pass
 *   Old  every 3D area exactly as it was before
 *
 * One phone at a time, H by default (the brief: "default H, Old = exactly
 * current"). Kept free of three.js so the Settings screen can import it.
 */
import { useSyncExternalStore } from "react";

export type Look3dStyle = "h" | "old";
export const LOOK3D_STYLE_KEY = "star-3d-look";
let stored: Look3dStyle | undefined;
const listeners = new Set<() => void>();

function read(): Look3dStyle {
  try {
    if (typeof location !== "undefined") {
      const q = new URLSearchParams(location.search).get("look3d");
      if (q === "h" || q === "old") return q;
    }
    return typeof localStorage !== "undefined" && localStorage.getItem(LOOK3D_STYLE_KEY) === "old" ? "old" : "h";
  } catch {
    return "h";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LOOK3D_STYLE_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function look3dStyle(): Look3dStyle {
  if (stored === undefined) stored = read();
  return stored;
}

export function setLook3dStyle(v: Look3dStyle): void {
  try { localStorage.setItem(LOOK3D_STYLE_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useLook3dStyle(): Look3dStyle {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    look3dStyle, () => "h" as const,
  );
}
