/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The three.js half of the governor (governor.ts): what a rung means for a
 * renderer, a shadow map and the people in it. Each 3D scene calls
 * `governScene(...)` once after building and `g.frame(now)` once per drawn
 * frame; scenes with their own tier logic (garden, shop, casino) pass
 * `onTier` and keep doing it their way.
 *
 * Shadows by rung:
 *   full  the scene's own (as built)
 *   lite  one smaller map; the static set (stands, crowd, props) never casts;
 *         people don't cast either (9 Oct 2026, Harry's iPhone: the men were
 *         ~21k triangles each, drawn a second time for the shadow map — most
 *         of the 743k). Their blob / contact shadows stay.
 *   off   no live shadow map at all (blob / baked shadows only)
 */
import type * as THREE from "three";
import { Governor, governedPixelRatio, type GovRung } from "./governor";
import type { Quality3d } from "./quality";

/** People further than this from the camera stop casting on the lite rung (metres; 0 = none cast). */
export const LITE_CAST_M = 0;

const isPerson = (o: any) => o.isSkinnedMesh;

/** Remember what `o` cast as built (once). */
const orig = (o: any): boolean => {
  if (o.userData.castOrig === undefined) o.userData.castOrig = !!o.castShadow;
  return o.userData.castOrig;
};

/** Static meshes (not skinned) under `root` cast as built (`on`) or never. */
export function setStaticCasters(root: THREE.Object3D, on: boolean, skip?: (o: any) => boolean) {
  root.traverse((o: any) => {
    if (!o.isMesh || isPerson(o) || (skip && skip(o))) return;
    const c = orig(o);
    o.castShadow = on ? c : false;
  });
}

/**
 * People (skinned meshes) under `root` cast only within `maxDist` of the
 * camera (`maxDist` Infinity = as built). Cheap: a distance per body.
 */
export function limitPeopleCasters(root: THREE.Object3D, camera: THREE.Camera, maxDist: number, list?: any[]) {
  const cam = (camera as any).position as THREE.Vector3;
  const people = list ?? collectPeople(root);
  const d2 = maxDist * maxDist;
  for (const o of people) {
    const c = orig(o);
    if (!c) continue;
    if (maxDist === Infinity) { o.castShadow = true; continue; }
    o.getWorldPosition(TMP);
    o.castShadow = TMP.distanceToSquared(cam) <= d2;
  }
}
let TMP: any = null;
export function collectPeople(root: THREE.Object3D): any[] {
  const out: any[] = [];
  root.traverse((o: any) => { if (isPerson(o)) out.push(o); });
  return out;
}

export interface GovernedScene {
  gov: Governor;
  /** Once per drawn frame (after the scene moved, before render). `cap` = the rate the scene aims for. */
  frame(now: number, cap?: number): void;
  /** The scene changed its own wanted pixel ratio (e.g. moving vs still). */
  setBasePixelRatio(pr: number): void;
  /** People were added (re-collect the casters). */
  refreshPeople(): void;
  dispose(): void;
}

/**
 * Put a scene under the governor.
 *   lights:   the lights that cast shadows (the sun, floods)
 *   basePR:   the pixel ratio the scene would draw at on its own
 *   shadowSize: the map size on the full rung (lite halves it, min 512)
 *   onRung:   anything else the scene does per rung (post, outlines)
 *   onTier:   scenes with their own tier logic: called when the tier label changes
 */
export function governScene(T: typeof import("three"), o: {
  name: string;
  start: Quality3d;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Object3D;
  camera: THREE.Camera;
  lights?: any[];
  basePR?: number;
  shadowSize?: number;
  /** Leave the pixel ratio to the scene (it reads g.gov.rung.pixelRatio itself). */
  ownPixelRatio?: boolean;
  /** Leave shadows to the scene (it reads g.gov.rung.shadows itself). */
  ownShadows?: boolean;
  /** Cut scenes: a few people in close-up keep their shadows on lite. */
  litePeopleCast?: boolean;
  /** Meshes that must keep casting on lite (the ball, the goal frame). */
  keepCasting?: (o: any) => boolean;
  onRung?: (r: GovRung, why: "down" | "up" | "start") => void;
  onTier?: (t: Quality3d, why: "down" | "up" | "start") => void;
}): GovernedScene {
  if (!TMP) TMP = new T.Vector3();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  let base = o.basePR ?? o.renderer.getPixelRatio();
  let people = collectPeople(o.scene);
  let shadowMode: GovRung["shadows"] | null = null;
  let lastTier: Quality3d | null = null;
  let n = 0;
  const lightsCast = (o.lights ?? []).map((l) => !!l.castShadow);
  const applyShadows = (mode: GovRung["shadows"]) => {
    if (o.ownShadows || mode === shadowMode) return;
    const was = shadowMode;
    shadowMode = mode;
    const on = mode !== "off";
    (o.lights ?? []).forEach((l, i) => {
      const want = on && lightsCast[i] && (mode === "full" || i === 0); // lite: the first light (the sun) only
      if (l.castShadow !== want) l.castShadow = want;
      if (want && o.shadowSize && l.shadow) {
        const s = mode === "lite" ? Math.max(512, o.shadowSize / 2) : o.shadowSize;
        if (l.shadow.mapSize.x !== s) { l.shadow.map?.dispose(); l.shadow.map = null; l.shadow.mapSize.set(s, s); }
      }
    });
    if (lightsCast.some(Boolean)) o.renderer.shadowMap.enabled = on;
    setStaticCasters(o.scene, mode === "full", o.keepCasting);
    limitPeopleCasters(o.scene, o.camera, mode === "full" || (mode === "lite" && o.litePeopleCast) ? Infinity : LITE_CAST_M, people);
    if (was !== null) o.renderer.shadowMap.needsUpdate = true;
  };
  const gov = new Governor({
    start: o.start, name: o.name,
    onChange: (r, _i, why) => {
      if (!o.ownPixelRatio) o.renderer.setPixelRatio(governedPixelRatio(base, r, dpr));
      applyShadows(r.shadows);
      if (r.tier !== lastTier) { const prev = lastTier; lastTier = r.tier; if (prev !== null || why === "start") o.onTier?.(r.tier, prev === null ? "start" : why); }
      o.onRung?.(r, why);
    },
  });
  gov.apply();
  return {
    gov,
    frame(now, cap = 60) {
      gov.frame(now, cap);
      if (shadowMode === "lite" && LITE_CAST_M > 0 && (n++ % 10) === 0) limitPeopleCasters(o.scene, o.camera, LITE_CAST_M, people);
    },
    setBasePixelRatio(pr) {
      if (Math.abs(pr - base) < 1e-3) return;
      base = pr;
      if (!o.ownPixelRatio) o.renderer.setPixelRatio(governedPixelRatio(base, gov.rung, dpr));
    },
    refreshPeople() { people = collectPeople(o.scene); if (shadowMode) limitPeopleCasters(o.scene, o.camera, shadowMode === "full" || (shadowMode === "lite" && o.litePeopleCast) ? Infinity : LITE_CAST_M, people); },
    dispose() { gov.dispose(); },
  };
}
