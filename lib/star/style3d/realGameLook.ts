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
 *   New, round 3 (Harry, 9 Oct 2026, from his iPhone: "players too big,
 *   angle too low … dragging is having to be done off the pitch"): the
 *   broadcast camera (lib/star/style3d/broadcastCam.ts), one 48–50° angle for
 *   every chance, ball at 55–60% height, men ~6% of the canvas, plus smoother
 *   playback in engineView. Old is unchanged.
 *
 *   New, round 4 (Harry, 12 Oct 2026: "the framing is not exactly the same on
 *   3d and 2d"): the 3D shows the 2D's own view box (lib/star/style3d/match2dCam.ts).
 *   12 Oct 2026, later: the only camera; the Old and broadcast cameras were deleted.
 *
 *   Settings → Look → "3D player light: New | Old" ("the players on the pitch
 *   still look slightly flat"). New: a soft key and rim light on the players
 *   only, darker undersides and feet, less flat fill, a tight shadow under
 *   each man. Old: the players lit exactly as before.
 *
 * The camera: New by default (12 Oct 2026). The player light: being tested,
 * Preview only (lib/star/gameVersions.ts), so it defaults Old.
 * The Style Testing page can force the light for that page: ?plight=new|old.
 * (The 3D camera row was removed on 12 Oct 2026: one camera, no setting.)
 */
import { useSyncExternalStore } from "react";

export type RealGameLook = "new" | "old";

const VALUES: readonly RealGameLook[] = ["new", "old"];

function store(key: string, FALLBACK: RealGameLook) {
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

// The 3D camera has no New | Old any more (Harry, 12 Oct 2026: decided things are not settings):
// one camera, the 2D's own frame (match2dCam.ts). The player light stays a choice, Old by default.
const light = store("star-look-3d-player-light", "old");


export const playerLightLook = (): RealGameLook => "old"; // Decided, no toggle (12 Oct 2026): the stored choice is ignored.
export const setPlayerLightLook = light.set;
export const previewPlayerLightLook = light.preview;
export const usePlayerLightLook = light.use;
