/**
 * THE 3D MATCH CAMERA'S ZOOM (Harry, 12 Oct 2026): pinch on a phone, a Settings slider and
 * the mouse wheel on a PC. Sizes never change: zoom only moves the camera.
 *
 * `zoom` runs from -1 (closest) through 0 (the default framing) to 1 (the whole scenario the
 * 2D draws for that chance, the 2D's own frame). It KEEPS between chances (and is remembered
 * on this device), so the Settings slider and a pinch are one setting.
 *
 * `heightDeg` (TEST ONLY, Settings → "3D camera height (test)"): degrees added to the camera's
 * angle down, the distance kept, so the camera sits higher or lower. 0 in the game.
 * Kept free of three.js so Settings can import it.
 */
import { useSyncExternalStore } from "react";

export const ZOOM_MIN = -1, ZOOM_MAX = 1;
export const HEIGHT_TEST_MIN = -20, HEIGHT_TEST_MAX = 20;
const KZ = "star-3d-cam-zoom", KH = "star-3d-cam-height-test";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const read = (k: string): number => { try { return typeof localStorage === "undefined" ? 0 : Number(localStorage.getItem(k) ?? 0) || 0; } catch { return 0; } };
const state = { zoom: NaN, height: NaN };
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((f) => f());

export function camZoom(): number { if (Number.isNaN(state.zoom)) state.zoom = clamp(read(KZ), ZOOM_MIN, ZOOM_MAX); return state.zoom; }
export function setCamZoom(v: number): void {
  state.zoom = clamp(v, ZOOM_MIN, ZOOM_MAX);
  try { localStorage.setItem(KZ, state.zoom.toFixed(3)); } catch { /* in-memory still changes */ }
  ping();
}
export function camHeightTest(): number { if (Number.isNaN(state.height)) state.height = clamp(read(KH), HEIGHT_TEST_MIN, HEIGHT_TEST_MAX); return state.height; }
export function setCamHeightTest(v: number): void {
  state.height = clamp(v, HEIGHT_TEST_MIN, HEIGHT_TEST_MAX);
  try { localStorage.setItem(KH, String(state.height)); } catch { /* fine */ }
  ping();
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useCamZoom = () => useSyncExternalStore(subscribe, camZoom, () => 0);
export const useCamHeightTest = () => useSyncExternalStore(subscribe, camHeightTest, () => 0);

/**
 * The camera for zoom `z`: between `def` (0) and `wide` (1, the whole scenario), or, below 0,
 * `def` pulled in towards its own look point down to `inK` of its distance at -1.
 * Every number is the camera's (spot, distance, angle, lens); nothing is scaled.
 */
export interface ZoomCam { tx: number; tz: number; ax: number; az: number; D: number; fov: number; elevDeg: number; minDepth: number }
export function zoomCamera<T extends ZoomCam>(def: T, wide: ZoomCam, z: number, inK = 0.55): T {
  if (z >= 0) {
    const t = Math.min(1, z);
    const L = (a: number, b: number) => a + (b - a) * t;
    return { ...def, tx: L(def.tx, wide.tx), tz: L(def.tz, wide.tz), D: L(def.D, wide.D), fov: L(def.fov, wide.fov), elevDeg: L(def.elevDeg, wide.elevDeg), minDepth: L(def.minDepth, wide.minDepth) };
  }
  const k = 1 + (inK - 1) * Math.min(1, -z);
  return { ...def, D: def.D * k, minDepth: def.minDepth * k };
}
