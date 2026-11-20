/**
 * THE FOLLOW CAMERA — camera D, the one to build every 3D area's walking camera on
 * (Harry, 20 Nov 2026, after comparing A/B/C/D in the house on /star-phone3d-dev:
 * "D is good and should be the base for all 3D areas — maybe you should be able
 * to zoom out though?").
 *
 * D: close (2.5 m behind), centred straight behind him, at 2.2 m looking a little
 * down at him (17°), a smooth follow, a small swing (±23°) off walls. Zoom pulls it
 * back to about the old house camera's distance (4.4 m), rising a little as it goes.
 * Pinch on a phone, the mouse wheel on a computer; the zoom is remembered per device.
 *
 * Pure numbers + a small input helper; the scene that uses it does the placing
 * (lib/star/home3d/scene.ts, HomeOptions.houseCam "D"). Not wired into other areas yet.
 */

/** One walking camera, in metres and per-second follow rates. */
export interface FollowCam {
  /** Camera height, and how far behind him. */
  height: number; back: number;
  /** The point it looks at: this high, this far ahead of him. */
  lookY: number; lookAhead: number;
  /** Sideways offset of the camera and of the point it looks at (0 = centred). */
  side: number; lookSide: number;
  /** For each metre a wall takes off the boom, the camera rises this much. */
  riseIfShort: number;
  /** The shortest boom near a wall. */
  minBoom: number;
  /** Follow rates (per second): position, look point, turning round behind him. */
  posK: number; lookK: number; yawK: number;
  /** How far it may swing round him off a wall (steps of 0.2 rad; 0 = straight behind). */
  swing: number;
  /** The lens on a phone held upright (degrees; 0 = the scene's own). */
  fov: number;
}

/** Camera D: the closest the zoom goes. */
export const FOLLOW_CAM_D: FollowCam = {
  height: 2.2, back: 2.5, lookY: 1.0, lookAhead: 1.4, side: 0, lookSide: 0,
  riseIfShort: 0.3, minBoom: 1.0, posK: 4, lookK: 5, yawK: 2.0, swing: 2, fov: 56,
};

/** The furthest the zoom goes: about the old house camera's distance, a little higher, still centred. */
export const FOLLOW_CAM_FAR: Pick<FollowCam, "height" | "back" | "lookY" | "lookAhead" | "fov"> = {
  height: 2.75, back: 4.4, lookY: 0.95, lookAhead: 2.0, fov: 60,
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The camera at zoom z (0 = D, 1 = the furthest). Writes into `out` (no garbage per frame). */
export function zoomedFollowCam(z: number, base: FollowCam = FOLLOW_CAM_D, out: FollowCam = { ...base }): FollowCam {
  const t = Math.max(0, Math.min(1, z));
  Object.assign(out, base);
  out.height = mix(base.height, FOLLOW_CAM_FAR.height, t);
  out.back = mix(base.back, FOLLOW_CAM_FAR.back, t);
  out.lookY = mix(base.lookY, FOLLOW_CAM_FAR.lookY, t);
  out.lookAhead = mix(base.lookAhead, FOLLOW_CAM_FAR.lookAhead, t);
  out.fov = mix(base.fov, FOLLOW_CAM_FAR.fov, t);
  return out;
}

/** Where the zoom is remembered (per device). */
export const FOLLOW_ZOOM_KEY = "kib-3d-follow-zoom";

export function loadFollowZoom(): number {
  try { const v = Number(localStorage.getItem(FOLLOW_ZOOM_KEY)); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; } catch { return 0; }
}

/** The zoom: where it is going (want) and where it is (now), eased. */
export class FollowZoom {
  want: number;
  now: number;
  private saveT: ReturnType<typeof setTimeout> | null = null;
  constructor(z = 0) { this.want = this.now = Math.max(0, Math.min(1, z)); }
  /** Move the zoom by dz (positive = further out). */
  nudge(dz: number): void {
    this.want = Math.max(0, Math.min(1, this.want + dz));
    if (this.saveT) clearTimeout(this.saveT);
    this.saveT = setTimeout(() => { try { localStorage.setItem(FOLLOW_ZOOM_KEY, this.want.toFixed(3)); } catch { /* private mode */ } }, 300);
  }
  get moving(): boolean { return Math.abs(this.want - this.now) > 1e-3; }
  /** Ease toward want over dt seconds. */
  step(dt: number): void {
    this.now += (this.want - this.now) * (1 - Math.exp(-8 * Math.max(0, dt)));
    if (!this.moving) this.now = this.want;
  }
}

/**
 * Wheel (computer) and pinch (phone) on `el` move `zoom`. While two fingers are
 * down, `el.dataset.pinching` is "1" so a one-finger look-round can ignore them.
 * Returns the function that removes the listeners.
 */
export function attachFollowZoom(el: HTMLElement, zoom: FollowZoom): () => void {
  const pts = new Map<number, { x: number; y: number }>();
  let lastDist = 0;
  const dist = () => { const [a, b] = Array.from(pts.values()); return Math.hypot(a.x - b.x, a.y - b.y); };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoom.nudge(Math.max(-0.25, Math.min(0.25, px * 0.0015)));
  };
  const down = (e: PointerEvent) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { lastDist = dist(); el.dataset.pinching = "1"; }
  };
  const move = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size !== 2) return;
    const d = dist();
    zoom.nudge((lastDist - d) / 260); // fingers apart = closer, together = further
    lastDist = d;
  };
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) delete el.dataset.pinching;
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("pointerdown", down, true);
  el.addEventListener("pointermove", move, true);
  el.addEventListener("pointerup", up, true);
  el.addEventListener("pointercancel", up, true);
  return () => {
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("pointerdown", down, true);
    el.removeEventListener("pointermove", move, true);
    el.removeEventListener("pointerup", up, true);
    el.removeEventListener("pointercancel", up, true);
    delete el.dataset.pinching;
  };
}
