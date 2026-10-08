/**
 * THE STANDING OVATION LOOK SWITCH — Settings → Look → "Standing ovation:
 * New | Old". One phone at a time, New by default.
 *
 * Mikey, 8 Oct 2026: the farewell's 85th minute as a 3D scene (the camera
 * circling you, hugs and dap-ups on the way off, the substitute on the line;
 * lib/star/ovation3d.ts). Old is the banner over the commentary, as it was.
 * Every new look gets a toggle and the old one stays (Harry, 3 Oct 2026).
 */
import { useSyncExternalStore } from "react";

export type OvationLook = "new" | "old";
export const OVATION_LOOK_KEY = "star-ovation-look";
let stored: OvationLook | undefined;
const listeners = new Set<() => void>();

function read(): OvationLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OVATION_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === OVATION_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function ovationLook(): OvationLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setOvationLook(v: OvationLook): void {
  try { localStorage.setItem(OVATION_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useOvationLook(): OvationLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    ovationLook, () => "new" as const,
  );
}
