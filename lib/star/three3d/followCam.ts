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
 * Pure numbers + small helpers; each scene does its own placing and keeps its own
 * shots (cards, doors, close-ups): the house (lib/star/home3d/scene.ts, the game's
 * camera since 20 Nov 2026: "should camera D go into the real game?" "yes"), the
 * garden (garden3d/scene.ts, look New), the 3D shop (shop3d/scene.ts) and the
 * casino (casino3d/scene.ts, Casino look New). Old looks keep their own cameras.
 *
 * THE DOORWAY JAM (fixed 20 Nov 2026): just through a door the wall stood right
 * behind him, the eased camera lagged into it and was clamped to the wall by axis,
 * so it slid round onto the back of his head. Now the boom (how far behind him)
 * is eased on its own (FollowBoom): a wall coming in pulls it in quickly but
 * smoothly along its own line, and it eases back out slowly; it never goes past
 * the wall. Short of FOLLOW_MIN_DIST from his head the camera rises instead
 * (riseForMin), and if a ceiling stops even that he fades a little (followFade).
 * Tests: tests/star/followCam.mts.
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

// ── Walls: the boom, the nearest the camera comes, the fade ──────────────────────

/** The camera never comes nearer his head than this (metres): it rises instead. */
export const FOLLOW_MIN_DIST = 1.25;
/** Nearer than this (a low ceiling stopped the rise) he fades a little... */
export const FOLLOW_FADE_FROM = 1.1;
/** ...down to this much of him showing, at FOLLOW_FADE_AT or nearer. */
export const FOLLOW_FADE_MIN = 0.5;
export const FOLLOW_FADE_AT = 0.6;
/** His head, for the nearest-distance rule (metres up). */
export const FOLLOW_HEAD_Y = 1.6;

/**
 * How far from (px, pz) along the flat direction (dx, dz) before a box's side
 * (x0..x1, z0..z1, the camera's own margin already taken off). 0 when already outside.
 */
export function boxRoom(px: number, pz: number, dx: number, dz: number, x0: number, x1: number, z0: number, z1: number, cap = 99): number {
  let t = cap;
  if (dx > 1e-6) t = Math.min(t, (x1 - px) / dx); else if (dx < -1e-6) t = Math.min(t, (x0 - px) / dx);
  if (dz > 1e-6) t = Math.min(t, (z1 - pz) / dz); else if (dz < -1e-6) t = Math.min(t, (z0 - pz) / dz);
  return Math.max(0, t);
}

/**
 * The boom's length (how far behind him, along the camera's line), eased on its own:
 * a wall coming in pulls it in fast but smoothly; when the wall goes it eases back
 * out slowly; it is never longer than the room free behind him (no camera in a wall).
 */
export class FollowBoom {
  len = -1;
  /** Per-second rates: pulling in, easing back out. */
  constructor(public inK = 10, public outK = 2.2) {}
  /** A new place (a doorway, a teleport): the next step starts where it should be. */
  reset(): void { this.len = -1; }
  /** want: the zoom's boom; free: room behind him before a wall. */
  step(want: number, free: number, dt: number): number {
    const target = Math.max(0, Math.min(want, free));
    if (this.len < 0) this.len = target;
    else {
      const k = target < this.len ? this.inK : this.outK;
      this.len += (target - this.len) * (1 - Math.exp(-k * Math.max(0, dt)));
    }
    if (this.len > free) this.len = Math.max(0, free);
    return this.len;
  }
}

/**
 * The camera's height so it stays FOLLOW_MIN_DIST (or `minDist`) from his head with a
 * boom only `boom` long: it rises over him instead of jamming on his head; never
 * above `ceil`.
 */
export function riseForMin(boom: number, y: number, ceil = 99, headY = FOLLOW_HEAD_Y, minDist = FOLLOW_MIN_DIST): number {
  const need = minDist * minDist - boom * boom;
  if (need > 0) y = Math.max(y, headY + Math.sqrt(need));
  return Math.min(ceil, y);
}

/** How much of him shows with the camera `d` metres from his head: all of him from FOLLOW_FADE_FROM out. */
export function followFade(d: number): number {
  if (d >= FOLLOW_FADE_FROM) return 1;
  const t = Math.max(0, Math.min(1, (d - FOLLOW_FADE_AT) / (FOLLOW_FADE_FROM - FOLLOW_FADE_AT)));
  return FOLLOW_FADE_MIN + (1 - FOLLOW_FADE_MIN) * t;
}

/**
 * The eased camera (x, z) kept on its own line from him: never further out than
 * `free` (what that line has before a wall), shortened along the line, never slid
 * sideways round him. Returns the flat distance it ends at.
 */
export function capOnLine(cam: { x: number; z: number }, px: number, pz: number, free: (dx: number, dz: number) => number): number {
  const sx = cam.x - px, sz = cam.z - pz, L = Math.hypot(sx, sz);
  if (L < 1e-6) return 0;
  const f = free(sx / L, sz / L);
  if (L <= f) return L;
  cam.x = px + (sx / L) * f; cam.z = pz + (sz / L) * f;
  return f;
}

/** The lens on a phone held upright for this camera (its own, else the scene's). */
export function followFov(cs: FollowCam, portrait: boolean, sceneFov: number): number {
  return portrait && cs.fov ? cs.fov : sceneFov;
}

/**
 * His steps carried straight into the camera and its look point (only turning, the zoom
 * and the walls are eased). Close behind him on a tall phone the view is only about 1.2 m
 * wide at his distance; an eased follow lagged ~0.5 m behind a sideways jog and put him
 * at the edge of the picture. Call each frame before easing toward the wanted pose;
 * `on` false (a card's shot, an opening shot, the first frame) only notes where he is.
 */
export class FollowCarry {
  private x = NaN;
  private z = NaN;
  step(px: number, pz: number, cam: { x: number; z: number }, look: { x: number; z: number }, on: boolean): void {
    if (on && Number.isFinite(this.x)) {
      const dx = px - this.x, dz = pz - this.z;
      cam.x += dx; cam.z += dz; look.x += dx; look.z += dz;
    }
    this.x = px; this.z = pz;
  }
}

/**
 * WHERE TO ARRIVE SO THE CAMERA IS ALREADY SETTLED (20 Nov 2026, playtest: on
 * entering the house camera D opened almost on his head, off-centre, and only
 * settled after a second of walking, because he arrived 1 m inside the door
 * with the wall right behind him). Steps in from the door along its inward
 * normal, from `max` back down to `min` metres, and returns the first spot
 * `ok` accepts (clear floor, off the walls); camera D's whole boom fits behind
 * it. Null: none fits (the caller keeps its own spot). Pure.
 */
export function settledArrival(
  door: { x: number; z: number; nx: number; nz: number },
  ok: (x: number, z: number) => boolean,
  back = FOLLOW_CAM_D.back, min = 1.5, max = 3.2,
): { x: number; z: number; yaw: number; d: number } | null {
  for (let d = Math.min(max, back + 0.45); d > min; d -= 0.25) {
    const x = door.x + door.nx * d, z = door.z + door.nz * d;
    if (ok(x, z)) return { x, z, yaw: Math.atan2(door.nx, door.nz), d };
  }
  return null;
}
