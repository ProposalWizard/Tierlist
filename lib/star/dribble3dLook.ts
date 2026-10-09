/**
 * Settings → Look → "Dribble runs 3D: 3D | Old" (Harry, 9 Oct 2026: "I really
 * like the 3D style in Style Testing where it's top down and you're running
 * around … it would be great for in-game dribbling").
 *
 *   3D:  a dribble run in a career match is played in the Free Roam look: the
 *        top-down camera, golden hour, the thumb stick, sprint and stamina, on
 *        the shared 3D engine (lib/star/play3d/dribbleRun.ts, drawn by
 *        components/star/Dribble3D.tsx). Same waves, same result, same next chance.
 *   Old: the first-person duel, exactly as before (components/star/FirstPersonDribble.tsx).
 * Being tested: 3D in Preview only (lib/star/gameVersions.ts), so the default is Old.
 */
import { useSyncExternalStore } from "react";

export type Dribble3dLook = "3d" | "old";
export const DRIBBLE_3D_KEY = "star-look-dribble-3d";
const FALLBACK: Dribble3dLook = "old";

let cached: Dribble3dLook | null = null;
const listeners = new Set<() => void>();

/** True once this phone has a stored choice (a Preview phone picks the new row up once). */
export function dribble3dStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(DRIBBLE_3D_KEY) !== null; } catch { return false; }
}

export function dribble3dLook(): Dribble3dLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(DRIBBLE_3D_KEY); } catch { v = null; }
  cached = v === "3d" || v === "old" ? v : FALLBACK;
  return cached;
}

export function setDribble3dLook(v: Dribble3dLook) {
  try { localStorage.setItem(DRIBBLE_3D_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DRIBBLE_3D_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}

export function useDribble3dLook(): Dribble3dLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    dribble3dLook, () => FALLBACK,
  );
}
