/**
 * Settings → Look → "Cut-scene people: New | Old" (one phone at a time).
 *
 * Harry's standing rule (3 Oct 2026): every new look gets a toggle, default
 * New, and the old one stays exactly as it was.
 *   New: the cut-scene face (lib/star/cutscene/face.ts): painted skin, real
 *        eyes that blink and look, expressions; no face photo on the head.
 *   Old: the people exactly as the 3D scenes make them today (their own
 *        painted face, or the face picture laid over it).
 * Being tested: Preview only (lib/star/gameVersions.ts), so the default is Old.
 */
import { useSyncExternalStore } from "react";

export type CutscenePeopleLook = "new" | "old";

const KEY = "star-look-cutscene-people";
const VALUES: readonly CutscenePeopleLook[] = ["new", "old"];
const FALLBACK: CutscenePeopleLook = "old";

let cached: CutscenePeopleLook | null = null;
const listeners = new Set<() => void>();

export function cutscenePeopleLook(): CutscenePeopleLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as CutscenePeopleLook) : FALLBACK;
  return cached;
}

export function setCutscenePeopleLook(v: CutscenePeopleLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useCutscenePeopleLook = () => useSyncExternalStore(subscribe, cutscenePeopleLook, () => FALLBACK);

/**
 * Settings → Look → "Cut-scene camera: New | Old" (Harry, 9 Oct 2026: "do a
 * pass of camera angles in the cut scenes, hide bad animations with good
 * zooms and angles, wide angles, music").
 *   New: the film pass (cinema.ts `filmPass`) runs over every scene before it
 *        plays: an establishing wide first, every shot moving a little,
 *        over-the-shoulder talk, weak moves hidden behind faces and props,
 *        cuts on action; plus a music bed (cutscene/music.ts).
 *   Old: the scenes' shots exactly as written, no music.
 * Default New.
 */
export type CutsceneCameraLook = "new" | "old";
const CAM_KEY = "star-look-cutscene-camera";
const CAM_FALLBACK: CutsceneCameraLook = "new";
let camCached: CutsceneCameraLook | null = null;
const camListeners = new Set<() => void>();

export function cutsceneCameraLook(): CutsceneCameraLook {
  if (camCached) return camCached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(CAM_KEY); } catch { v = null; }
  camCached = v === "new" || v === "old" ? v : CAM_FALLBACK;
  return camCached;
}
/** True once this phone has chosen (gameVersions.ts keeps a Classic phone on Old). */
export function cutsceneCameraStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(CAM_KEY) !== null; } catch { return false; }
}
export function setCutsceneCameraLook(v: CutsceneCameraLook) {
  try { localStorage.setItem(CAM_KEY, v); } catch { /* in-memory still changes */ }
  camCached = v;
  camListeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === CAM_KEY) { camCached = null; camListeners.forEach((f) => f()); } });
}
const camSubscribe = (f: () => void) => { camListeners.add(f); return () => { camListeners.delete(f); }; };
export const useCutsceneCameraLook = () => useSyncExternalStore(camSubscribe, cutsceneCameraLook, () => CAM_FALLBACK);
