/**
 * 3D QUALITY — Settings → Look → "3D quality: Auto | Low | Medium | High"
 * (Harry, 5 Oct 2026: "the less lag is BIG"). One setting per phone, shared
 * by every 3D scene (garden, shop, signing, office, Test Area).
 *
 * Auto (the default) = the tier this phone's own benchmark picked the first
 * time it opened a 3D scene (lib/star/three3d/perf.ts → resolveQuality3d),
 * saved under AUTO_KEY so it runs once per phone, not once per visit.
 *
 * Kept free of three.js so the Settings screen can import it without
 * pulling the 3D engine into the page.
 */
import { useSyncExternalStore } from "react";

export type Quality3d = "low" | "medium" | "high";
export type Quality3dSetting = "auto" | Quality3d;

export const QUALITY3D_KEY = "star-3d-quality";
/** The benchmark's saved answer: { tier, ms, gpu, v }. */
export const QUALITY3D_AUTO_KEY = "star-3d-quality-auto";
const VALUES: readonly Quality3dSetting[] = ["auto", "low", "medium", "high"];

let cached: Quality3dSetting | null = null;
const listeners = new Set<() => void>();

export function quality3dSetting(): Quality3dSetting {
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(QUALITY3D_KEY); } catch { v = null; }
    cached = v && (VALUES as readonly string[]).includes(v) ? (v as Quality3dSetting) : "auto";
  }
  return cached;
}

export function setQuality3dSetting(v: Quality3dSetting) {
  try { localStorage.setItem(QUALITY3D_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === QUALITY3D_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useQuality3dSetting = () => useSyncExternalStore(subscribe, quality3dSetting, () => "auto" as Quality3dSetting);

/** What Auto picked on this phone, if the benchmark has run (for the Settings note). */
export function autoQuality3d(): { tier: Quality3d; ms: number; gpu: string } | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(QUALITY3D_AUTO_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && (o.tier === "low" || o.tier === "medium" || o.tier === "high") ? o : null;
  } catch { return null; }
}
