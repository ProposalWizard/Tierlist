/**
 * THE WALK-AROUND PLACES' EDIT HOOK — the 3D Shop, Garden and House in the
 * 3D Scene Editor (step 3b, Harry 20 Oct 2026: "3B first"). Same idea as step
 * 3a's Signing/Office hook (lib/star/signing3dScene.ts SigningSceneEdit): an
 * optional edit; none = the scene exactly as before.
 *
 * These places have no fixed shots: a camera follows you, and a card that
 * opens frames its item. So a VIEW's edit is relative to the camera the scene
 * already works out (it moves with you and with the item):
 *   turn  — swing round what it looks at (degrees)
 *   rise  — up or down (metres)
 *   dist  — closer or further (× the distance; 1 = as written)
 *   lens  — the lens (mm; absent = as written)
 * View ids: "follow" = walking about; the rest are each place's card shots
 * (the shop's boots, car, counter, homes, cans; the house's wardrobe, cabinet, drive).
 * The key light (strength, angle round the place, colour) and the exposure
 * are scene-wide, as in step 3a.
 */
export type V3 = [number, number, number];

export interface ViewEdit { turn?: number; rise?: number; dist?: number; lens?: number }

export interface WalkSceneEdit {
  views?: Record<string, ViewEdit>;
  /** Multiplies the exposure (1 = as written). With Look H on, it scales the lights instead (Look H's grade sets its own exposure). */
  exposure?: number;
  /** Multiplies the key light (1 = as written). */
  keyLight?: number;
  /** Turns the key light round the place, degrees about the vertical (0 = as written). */
  keyAngle?: number;
  /** The key light's colour, "#rrggbb" (absent = as written). */
  keyColor?: string;
}

/** The views each place offers in the editor. */
export const WALK_VIEWS: Record<"shop" | "garden" | "house", { id: string; name: string }[]> = {
  shop: [
    { id: "follow", name: "Walking about" }, { id: "boots", name: "Card: the boots" }, { id: "car", name: "Card: the car" },
    { id: "counter", name: "Card: the counter" }, { id: "homes", name: "Card: the homes table" }, { id: "cans", name: "Card: the cans" },
  ],
  garden: [{ id: "follow", name: "Walking about" }],
  house: [
    { id: "follow", name: "Walking about" }, { id: "wardrobe", name: "Card: the wardrobe" },
    { id: "cabinet", name: "Card: the trophy cabinet" }, { id: "drive", name: "Card: the drive" },
  ],
};

/** Where you stand to preview the garden's walking camera. */
export const GARDEN_STANDS: { id: string; name: string }[] = [
  { id: "gate", name: "At the gate" }, { id: "fountain", name: "By the fountain" }, { id: "shop", name: "Outside the shop" },
  { id: "casino", name: "Outside the casino" }, { id: "training", name: "At the pitch gate" }, { id: "house", name: "By the house door" },
];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Is this view edit doing anything? */
export function viewEdited(e?: ViewEdit | null): boolean {
  return !!e && ((isNum(e.turn) && e.turn !== 0) || (isNum(e.rise) && e.rise !== 0) || (isNum(e.dist) && e.dist !== 1) || isNum(e.lens));
}

/**
 * Where the camera stands after a view edit, given where the scene put it and
 * what it looks at. Pure. No edit = the same point.
 */
export function editCamera(pos: V3, look: V3, e?: ViewEdit | null): V3 {
  if (!viewEdited(e)) return pos;
  const ox = pos[0] - look[0], oy = pos[1] - look[1], oz = pos[2] - look[2];
  const a = ((e!.turn ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const d = isNum(e!.dist) ? Math.max(0.2, Math.min(4, e!.dist)) : 1;
  const rx = (ox * c + oz * s) * d, rz = (-ox * s + oz * c) * d;
  return [look[0] + rx, look[1] + oy * d + (e!.rise ?? 0), look[2] + rz];
}

/** A lens in mm as a vertical field of view (degrees), as signing3dScene.ts's lensToFovDeg. */
export const lensToFov = (mm: number) => (2 * Math.atan(12 / mm) * 180) / Math.PI;
export const fovToLens = (fov: number) => 12 / Math.tan((fov * Math.PI) / 360);

/**
 * The field of view this frame: the scene's own (from the screen shape), the
 * walking view's lens, and a card view's lens blended in by how far the card
 * shot has come in (frame 0..1). No lens edits = the scene's own.
 */
export function editFov(baseFov: number, e: WalkSceneEdit | null | undefined, cardView: string | null, frame: number): number {
  const f0 = isNum(e?.views?.follow?.lens) ? lensToFov(e!.views!.follow!.lens!) : baseFov;
  const cl = cardView ? e?.views?.[cardView]?.lens : undefined;
  if (!isNum(cl)) return f0;
  const k = Math.max(0, Math.min(1, frame));
  return f0 + (lensToFov(cl) - f0) * k;
}

/** Light edits, applied to a scene's own key light and exposure. Duck-typed three.js objects. */
export interface LightBase {
  key: { position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }; intensity: number; color: { set: (c: string) => void; copy: (c: unknown) => void; clone: () => unknown } };
  renderer: { toneMappingExposure: number };
  /** Look H is on: its grade sets the exposure, so exposure scales the lights instead. */
  lookH: boolean;
  scene: { traverse: (f: (o: { isLight?: boolean; intensity?: number; userData: Record<string, unknown> }) => void) => void };
  /** Where the key light stands as written, if the scene moves it itself (the house: per room). */
  keyBase?: () => { x: number; y: number; z: number };
}

/** Remember the scene as written, once. Returns a function that applies an edit (null = back to as written). */
export function makeLightEditor(b: LightBase): (e: WalkSceneEdit | null | undefined) => void {
  const p0 = { x: b.key.position.x, y: b.key.position.y, z: b.key.position.z };
  const col0 = b.key.color.clone();
  const int0 = b.key.intensity;
  const exp0 = b.renderer.toneMappingExposure;
  let scaled = false;
  return (e) => {
    const pos0 = b.keyBase?.() ?? p0;
    const ang = ((e?.keyAngle ?? 0) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    b.key.position.set(pos0.x * ca - pos0.z * sa, pos0.y, pos0.x * sa + pos0.z * ca);
    if (e?.keyColor) b.key.color.set(e.keyColor); else b.key.color.copy(col0);
    const ex = isNum(e?.exposure) ? e!.exposure! : 1;
    if (b.lookH) {
      // every light's own strength × the exposure (remembered on the light the first time)
      if (ex !== 1 || scaled) {
        b.scene.traverse((o) => {
          if (!o.isLight || !isNum(o.intensity)) return;
          if (!isNum(o.userData.__editI0)) o.userData.__editI0 = o === (b.key as unknown) ? int0 : o.intensity;
          o.intensity = (o.userData.__editI0 as number) * ex;
        });
        scaled = ex !== 1;
      }
      b.key.intensity = int0 * (e?.keyLight ?? 1) * ex;
    } else {
      b.renderer.toneMappingExposure = exp0 * ex;
      b.key.intensity = int0 * (e?.keyLight ?? 1);
    }
  };
}
