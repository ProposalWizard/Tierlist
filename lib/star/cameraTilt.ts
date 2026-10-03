/**
 * THE CAMERA ANGLE — Settings → Look → Camera angle: 20° | 30° | Flat.
 *
 * Harry, 3 Oct 2026, after the new match view shipped flat top-down: "it's
 * still too top down, the angle needs to come down a bit", then, picking from
 * the mock-up at 0/20/30/40°: "rn 20 degrees should be the base".
 *
 * The match is still drawn flat (the engine, the camera rectangle and every
 * figure are untouched). The finished canvas is then tipped back by this many
 * degrees with a CSS perspective, exactly like the mock-up: the far end of the
 * pitch recedes and narrows, the near end comes forward. It is scaled up just
 * enough that the top of the picture still fills the screen. So the near
 * corners are cropped a little; `visibleOnScreen` says what is still in view.
 *
 * Touch goes through the exact inverse (`screenToCanvas`), and the drag's
 * power is measured on the SCREEN (`canvasToScreen`), so the same finger
 * movement kicks exactly as hard as it does flat.
 *
 * Only the new match view tilts; Classic is always flat. "Flat" (0) is the
 * old look, kept as the Old option.
 */
import { useSyncExternalStore } from "react";

export type CameraTilt = 0 | 20 | 30;
export const CAMERA_TILTS: CameraTilt[] = [20, 30, 0];

/** THE ONE LINE: the angle everyone gets when nobody has chosen. */
export const CAMERA_TILT_DEFAULT: CameraTilt = 20;
export const CAMERA_TILT_KEY = "star-camera-tilt";

/** The camera's distance from the picture, as a multiple of its height (the
 *  mock-up's 1.4): smaller is a stronger perspective. */
export const TILT_DISTANCE_H = 1.4;

let stored: CameraTilt | undefined;
const listeners = new Set<() => void>();

function readStored(): CameraTilt {
  try {
    if (typeof localStorage === "undefined") return CAMERA_TILT_DEFAULT;
    const v = Number(localStorage.getItem(CAMERA_TILT_KEY));
    return localStorage.getItem(CAMERA_TILT_KEY) !== null && (v === 0 || v === 20 || v === 30) ? v : CAMERA_TILT_DEFAULT;
  } catch {
    return CAMERA_TILT_DEFAULT;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CAMERA_TILT_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

/** This phone's camera angle. */
export function cameraTilt(): CameraTilt {
  if (stored === undefined) stored = readStored();
  return stored;
}

export function setCameraTilt(v: CameraTilt): void {
  try { localStorage.setItem(CAMERA_TILT_KEY, String(v)); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Settings' copy of the choice, kept in step with other tabs. */
export function useCameraTilt(): CameraTilt {
  return useSyncExternalStore(subscribe, cameraTilt, () => CAMERA_TILT_DEFAULT);
}

// ─────────────────────────────────────────────────────────────────────────────
// The geometry. Everything in CSS px of the untilted canvas box (W × H), with
// the transform's origin at its centre:
//   transform: perspective(d) rotateX(θ) scale(s)
// A point (x, y) from the centre lands on screen at
//   X = s·x / w,  Y = s·y·cosθ / w,  where w = 1 − s·y·sinθ / d.
// ─────────────────────────────────────────────────────────────────────────────

export interface Tilt { deg: number; W: number; H: number; d: number; s: number; sin: number; cos: number }

/** The tilt for a canvas W × H px; null when flat. `s` is the smallest scale
 *  at which the top of the tipped picture still fills the screen's top edge. */
export function tiltFor(deg: number, W: number, H: number): Tilt | null {
  if (!(deg > 0) || !(W > 0) || !(H > 0)) return null;
  const th = (deg * Math.PI) / 180, sin = Math.sin(th), cos = Math.cos(th);
  const d = TILT_DISTANCE_H * H;
  // Top edge (y = −H/2): needs s·(H/2)·cos/w ≥ H/2 and s·(W/2)/w ≥ W/2, with
  // w = 1 + s·(H/2)·sin/d. Both are s·k/(1 + s·m) ≥ 1, i.e. s ≥ 1/(k − m).
  const m = (H / 2) * sin / d;
  const s = Math.max(1, 1 / (cos - m), 1 / (1 - m));
  return { deg, W, H, d, s, sin, cos };
}

export function tiltCss(t: Tilt | null): string {
  return t ? `perspective(${t.d.toFixed(1)}px) rotateX(${t.deg}deg) scale(${t.s.toFixed(4)})` : "";
}

/** Canvas fraction (0..1 each way) -> screen px inside the box (0..W, 0..H). */
export function canvasToScreen(t: Tilt | null, sx: number, sy: number, W: number, H: number): { X: number; Y: number } {
  if (!t) return { X: sx * W, Y: sy * H };
  const x = (sx - 0.5) * t.W, y = (sy - 0.5) * t.H;
  const w = 1 - (t.s * y * t.sin) / t.d;
  return { X: t.W / 2 + (t.s * x) / w, Y: t.H / 2 + (t.s * y * t.cos) / w };
}

/** Screen px inside the box -> canvas fraction. The exact inverse of the above. */
export function screenToCanvas(t: Tilt | null, X: number, Y: number, W: number, H: number): { sx: number; sy: number } {
  if (!t) return { sx: X / W, sy: Y / H };
  const Xc = X - t.W / 2, Yc = Y - t.H / 2;
  const y = Yc / (t.s * (t.cos + (Yc * t.sin) / t.d));
  const w = 1 - (t.s * y * t.sin) / t.d;
  const x = (Xc * w) / t.s;
  return { sx: x / t.W + 0.5, sy: y / t.H + 0.5 };
}

/** Is this canvas fraction on the screen once tilted (with `marginPx` to spare)? */
export function visibleOnScreen(t: Tilt | null, sx: number, sy: number, marginPx = 0): boolean {
  if (!t) return sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1;
  const p = canvasToScreen(t, sx, sy, t.W, t.H);
  return p.X >= marginPx && p.X <= t.W - marginPx && p.Y >= marginPx && p.Y <= t.H - marginPx;
}
