/**
 * THE 2D CAMERA SWIPE SWITCH (Harry, 13 Oct 2026: "the 2d version should be a new toggle in a new 2d
 * camera section cos this ones tough"). Settings → 2D match camera → "Swipe camera". Off by default:
 * the 2D match plays exactly as before. On: CanvasMatch.tsx's up/down swipe, double tap and the
 * video-camera lock button. Per device.
 */
import { useSyncExternalStore } from "react";
const KEY = "star-cam2d-swipe";
const subs = new Set<() => void>();
export function cam2dSwipeOn(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function setCam2dSwipeOn(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  subs.forEach((f) => f());
}
export function useCam2dSwipe(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, cam2dSwipeOn, () => false);
}
