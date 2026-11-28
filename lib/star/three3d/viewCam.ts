/**
 * FIRST PERSON | THIRD PERSON — one switch for every walk-around 3D place
 * (Harry, 28 Nov 2026: "we had a glitch where it went first person for a minute
 * in 3D and it was cool looking — we need to zoom out the camera a bit and add a
 * toggle for first person").
 *
 * The glitch: the 3D phone (components/star/HousePhone.tsx) opens the house in
 * his eyes (home3d scene `pov`). Put the phone down while the house was still
 * loading and it stayed there: the house at his eyes, no him in it. Fixed in
 * 62e5792ab (the phone now always comes back out of his eyes).
 *
 * How it works, the same in the house, the garden, the 3D shop, the casino and
 * the world kit's places (lounge, garden, gym):
 *  - Each scene works out its normal third-person camera as before (camera D,
 *    ./followCam.ts), then hands it to ViewCam.place() with his head. In first
 *    person the camera goes to his eyes, looking where the third-person camera
 *    looked (so the stick still walks "forward" the way you look, and a drag
 *    still turns the view; up/down drag tilts the eyes: ViewCam.drag).
 *  - The switch eases over VIEW_BLEND_S (0.4 s): up and over his head, never
 *    through it. He is hidden only once the camera is inside his head (not
 *    drawn at all: one fewer draw, never more).
 *  - Using something (a card's close-up, sitting on the sofa, a can, the bench
 *    press, sleeping, a game table, talking to a team-mate) eases back out to
 *    third person for the action (`busy` in step()), and back into his eyes
 *    after: the scenes' own close-ups were made to show him doing it.
 *  - No hands: the body is one skinned mesh, so his arms cannot be shown
 *    without the inside of his head; none looks better than floating arms.
 *  - The choice is remembered per device (VIEW_MODE_KEY).
 * Pure numbers (no three.js): tests/star/viewCam.mts.
 */

export type ViewMode = "third" | "first";

/** Where the choice is remembered (per device). */
export const VIEW_MODE_KEY = "kib-3d-view";
/** The switch, seconds. */
export const VIEW_BLEND_S = 0.4;
/** The eyes: this far above the head bone's origin (the base of the skull), and this far in front of it. */
export const EYE_ABOVE_HEAD_BONE = 0.09;
export const EYE_FORWARD = 0.12;
/** No head bone: eyes this high on a man of build height 1 (the game's bodies are about 1.76 m). */
export const EYE_HEIGHT = 1.64;
/** First person's own lens, upright phone (vertical degrees): wider than camera D's, so a room reads from inside it. */
export const FIRST_FOV = 66;
/** Eyes tilt (radians, + = looking down): where they rest, and how far a drag can take them. */
export const EYE_PITCH_REST = 0.24;
export const EYE_PITCH_MIN = -0.55;
export const EYE_PITCH_MAX = 0.85;
/** Up/down drag: radians per pixel. */
export const EYE_PITCH_PER_PX = 0.004;
/** He is drawn only with the camera at least this far from his head (metres). */
export const BODY_SHOW_FROM = 0.55;

/** Eye height for a body built `scaleY` times the usual height (the Tall build is 1.05). */
export function eyeHeightFor(scaleY = 1): number {
  return EYE_HEIGHT * (scaleY > 0 ? scaleY : 1);
}

export function loadViewMode(): ViewMode {
  try { return localStorage.getItem(VIEW_MODE_KEY) === "first" ? "first" : "third"; } catch { return "third"; }
}
export function saveViewMode(m: ViewMode): void {
  try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* private mode: this visit only */ }
}

/** Ease in and out over 0..1. */
export const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

type V3 = { x: number; y: number; z: number };

/**
 * The camera k of the way from the third-person camera to the eyes (k = 1: in
 * his eyes). Up and over his head, not through it: on the way it rises faster
 * than it comes in, plus a small arc. Writes outPos / outLook. Pure.
 */
export function blendView(thirdPos: V3, thirdLook: V3, eye: V3, eyeLook: V3, k: number, ceil: number, outPos: V3, outLook: V3): void {
  const t = Math.max(0, Math.min(1, k)), s = 1 - t;
  outPos.x = eye.x + (thirdPos.x - eye.x) * s;
  outPos.z = eye.z + (thirdPos.z - eye.z) * s;
  const lift = eye.y + (thirdPos.y - eye.y) * Math.sqrt(s) + 0.35 * Math.sin(Math.PI * s);
  outPos.y = Math.min(ceil, Math.max(eye.y + (thirdPos.y - eye.y) * s, lift));
  if (t >= 1) outPos.y = eye.y;
  outLook.x = eyeLook.x + (thirdLook.x - eyeLook.x) * s;
  outLook.y = eyeLook.y + (thirdLook.y - eyeLook.y) * s;
  outLook.z = eyeLook.z + (thirdLook.z - eyeLook.z) * s;
}

/** The eyes and what they look at: from his head, along the flat way (fx, fz), tilted down by pitch. Pure. */
export function eyePose(head: V3, fx: number, fz: number, pitch: number, outEye: V3, outLook: V3): void {
  const L = Math.hypot(fx, fz) || 1, ux = fx / L, uz = fz / L;
  outEye.x = head.x + ux * EYE_FORWARD; outEye.y = head.y + EYE_ABOVE_HEAD_BONE; outEye.z = head.z + uz * EYE_FORWARD;
  const c = Math.cos(pitch);
  outLook.x = outEye.x + ux * 3 * c; outLook.y = outEye.y - 3 * Math.sin(pitch); outLook.z = outEye.z + uz * 3 * c;
}

/** The camera.zoom that turns the scene's lens `fov` into first person's at k (1 = all the way in). */
export function zoomForLens(fov: number, k: number, firstFov = FIRST_FOV): number {
  const t = Math.max(0, Math.min(1, k));
  if (t <= 0 || firstFov <= fov) return 1;
  const want = fov + (firstFov - fov) * t;
  const r = (d: number) => Math.tan((d * Math.PI) / 360);
  return r(fov) / r(want);
}

/** A three.js camera, as much of it as ViewCam uses. */
interface CamLike { position: V3 & { set: (x: number, y: number, z: number) => unknown }; lookAt: (x: number, y: number, z: number) => void; fov: number; aspect: number; zoom: number; updateProjectionMatrix: () => void }

/**
 * The switch and its blend, one per scene. step() each frame, then place() just
 * before drawing, in place of `camera.position.copy(camPos); camera.lookAt(camLook)`.
 */
export class ViewCam {
  mode: ViewMode;
  /** 0 = third person, 1 = his eyes (eased). */
  k: number;
  /** Eyes' tilt (radians, + = down), eased toward pitchWant. */
  pitch = EYE_PITCH_REST;
  private pitchWant = EYE_PITCH_REST;
  private from = 0;
  private to = 0;
  private t = 1;
  /** The eyes' height, eased (his walk bobs the head bone). */
  private eyeY = NaN;
  private eye: V3 = { x: 0, y: 0, z: 0 };
  private eyeLook: V3 = { x: 0, y: 0, z: 0 };
  private outPos: V3 = { x: 0, y: 0, z: 0 };
  private outLook: V3 = { x: 0, y: 0, z: 0 };
  private head: V3 = { x: 0, y: 0, z: 0 };
  private lastZoom = 1;
  constructor(mode: ViewMode = "third", private remember = true) {
    this.mode = mode;
    this.k = this.to = mode === "first" ? 1 : 0;
  }
  get first(): boolean { return this.mode === "first"; }
  /** In (or mostly in) his eyes: a scene stops swinging its camera round him. */
  get inEyes(): boolean { return this.k > 0.5; }
  /** Still easing (the scene keeps drawing). */
  get moving(): boolean { return this.t < 1 || Math.abs(this.pitchWant - this.pitch) > 1e-3; }
  set(m: ViewMode): void {
    if (m === this.mode) return;
    this.mode = m;
    if (this.remember) saveViewMode(m);
    if (m === "first") { this.pitch = this.pitchWant = EYE_PITCH_REST; }
  }
  toggle(): ViewMode { this.set(this.first ? "third" : "first"); return this.mode; }
  /** An up/down drag of dy pixels (down = look down). Only in first person. */
  drag(dy: number): void {
    if (!this.first) return;
    const d = Math.max(-60, Math.min(60, dy || 0));
    this.pitchWant = Math.max(EYE_PITCH_MIN, Math.min(EYE_PITCH_MAX, this.pitchWant + d * EYE_PITCH_PER_PX));
  }
  /** Back to the resting tilt (a new room, a teleport). */
  resetPitch(): void { this.pitch = this.pitchWant = EYE_PITCH_REST; }
  /**
   * Advance dt seconds. busy: he is using something (a close-up, a seat, a game):
   * third person for it, back into his eyes after.
   */
  step(dt: number, busy = false): number {
    const target = this.first && !busy ? 1 : 0;
    if (target !== this.to) { this.from = this.k; this.to = target; this.t = 0; }
    if (this.t < 1) {
      this.t = Math.min(1, this.t + Math.max(0, dt) / VIEW_BLEND_S);
      if (this.t > 1 - 1e-6) this.t = 1;
      this.k = this.from + (this.to - this.from) * easeInOut(this.t);
    } else this.k = this.to;
    this.pitch += (this.pitchWant - this.pitch) * (1 - Math.exp(-12 * Math.max(0, dt)));
    return this.k;
  }
  /** Jump straight to where the switch is going (a scene opening, filming a still). */
  settle(): void { this.t = 1; this.k = this.to = this.first ? 1 : 0; }

  /**
   * Put the camera: third (camPos/camLook, as the scene worked out) blended to the
   * eyes. head: the head bone's world position (or his feet + eyeHeightFor); fx, fz:
   * the way he looks (the third-person camera's facing). Returns true when he should
   * be drawn (the camera is clear of his head).
   */
  place(camera: CamLike, camPos: V3, camLook: V3, head: V3, fx: number, fz: number, ceil: number, dt: number): boolean {
    const k = this.k;
    // eased eye height: the walk's head bob, softened
    this.eyeY = Number.isFinite(this.eyeY) ? this.eyeY + (head.y - this.eyeY) * (1 - Math.exp(-10 * Math.max(0, dt))) : head.y;
    if (k <= 1e-4) {
      this.eyeY = head.y;
      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.lookAt(camLook.x, camLook.y, camLook.z);
      this.setZoom(camera, 1);
      return true;
    }
    this.head.x = head.x; this.head.y = this.eyeY; this.head.z = head.z;
    eyePose(this.head, fx, fz, this.pitch, this.eye, this.eyeLook);
    blendView(camPos, camLook, this.eye, this.eyeLook, k, ceil, this.outPos, this.outLook);
    camera.position.set(this.outPos.x, this.outPos.y, this.outPos.z);
    camera.lookAt(this.outLook.x, this.outLook.y, this.outLook.z);
    this.setZoom(camera, camera.aspect < 0.7 ? zoomForLens(camera.fov, k) : zoomForLens(camera.fov, k, Math.min(FIRST_FOV, 64)));
    const dx = this.outPos.x - head.x, dy = this.outPos.y - this.eyeY, dz = this.outPos.z - head.z;
    return Math.hypot(dx, dy, dz) > BODY_SHOW_FROM;
  }
  private setZoom(camera: CamLike, z: number): void {
    if (Math.abs(z - this.lastZoom) < 1e-4 && Math.abs(camera.zoom - z) < 1e-4) return;
    this.lastZoom = z; camera.zoom = z; camera.updateProjectionMatrix();
  }
}

/** His head bone (the first bone named ...head), or null. */
export function findHeadBone(root: { traverse: (f: (o: any) => void) => void }): any {
  let head: any = null;
  root.traverse((o: any) => { if (!head && o.isBone && /head$/i.test(o.name)) head = o; });
  return head;
}

/** His head in the world: the bone if he has one, else his feet plus the eye height for his build. Writes `out`. */
export function headWorld(bone: any, root: { position: V3; scale?: V3 }, out: V3 & { copy?: unknown }): V3 {
  if (bone && typeof bone.getWorldPosition === "function") { bone.getWorldPosition(out); return out; }
  out.x = root.position.x; out.z = root.position.z;
  out.y = root.position.y + eyeHeightFor(root.scale?.y ?? 1) - EYE_ABOVE_HEAD_BONE;
  return out;
}

/**
 * Show or hide his body for first person WITHOUT touching root.visible: game logic reads
 * root.visible (the world kit skips people who are "away", so hiding the root froze his
 * walk). The root's children are hidden instead, and each one's own visibility (an
 * outline switched off on a low tier) comes back as it was. Cheap: only acts on a change.
 */
const hiddenKids = new WeakMap<object, boolean[]>();
export function showBody(root: { children: { visible: boolean }[] }, on: boolean): void {
  const was = hiddenKids.get(root);
  if (!on) {
    if (was) return;
    hiddenKids.set(root, root.children.map((c) => c.visible));
    for (const c of root.children) c.visible = false;
  } else if (was) {
    root.children.forEach((c, i) => { c.visible = was[i] ?? true; });
    hiddenKids.delete(root);
  }
}
