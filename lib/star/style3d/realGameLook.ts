/**
 * The real game in 3D (lib/star/style3d/engineView.ts): two New | Old looks,
 * one phone at a time.
 *
 *   Settings → Look → "3D camera: New | Old" (Harry, 9 Oct 2026: "a mix of A
 *   and B … less of it was empty grass"). New: the camera sits a little lower
 *   and frames only the action (ball, you, your team-mates in the move, the
 *   nearest defenders, the keeper and goal), so men at the edges may go off
 *   screen; it follows the play and stays inside what the phone shows; men,
 *   keeper and ball 1.6× life size. Old: the camera exactly as it
 *   was (everyone in the chance on screen, men drawn 1.3–2.6×).
 *
 *   Settings → Look → "3D player light: New | Old" ("the players on the pitch
 *   still look slightly flat"). New: a soft key and rim light on the players
 *   only, darker undersides and feet, less flat fill, a tight shadow under
 *   each man. Old: the players lit exactly as before.
 *
 * Being tested: Preview only (lib/star/gameVersions.ts), so both default Old.
 * The Style Testing page can force either for that page: ?cam=new|old&plight=new|old.
 */
import { useSyncExternalStore } from "react";

export type RealGameLook = "new" | "old";

const VALUES: readonly RealGameLook[] = ["new", "old"];
const FALLBACK: RealGameLook = "old";

function store(key: string) {
  let cached: RealGameLook | null = null;
  const listeners = new Set<() => void>();
  const get = (): RealGameLook => {
    if (cached) return cached;
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { v = null; }
    cached = v && (VALUES as readonly string[]).includes(v) ? (v as RealGameLook) : FALLBACK;
    return cached;
  };
  const set = (v: RealGameLook) => {
    try { localStorage.setItem(key, v); } catch { /* in-memory still changes */ }
    cached = v;
    listeners.forEach((f) => f());
  };
  /** A test page's choice for this page only: nothing is stored on the phone. */
  const preview = (v: RealGameLook) => { cached = v; listeners.forEach((f) => f()); };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => { if (e.key === key) { cached = null; listeners.forEach((f) => f()); } });
  }
  const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
  const use = () => useSyncExternalStore(subscribe, get, () => FALLBACK);
  return { get, set, preview, use };
}

const cam = store("star-look-3d-camera");
const light = store("star-look-3d-player-light");

export const realCameraLook = cam.get;
export const setRealCameraLook = cam.set;
export const previewRealCameraLook = cam.preview;
export const useRealCameraLook = cam.use;

export const playerLightLook = light.get;
export const setPlayerLightLook = light.set;
export const previewPlayerLightLook = light.preview;
export const usePlayerLightLook = light.use;
