/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OFF-SCREEN MEN COST NOTHING (9 Oct 2026, lag pass 2). Every skinned body
 * is built with frustumCulled = false (a body's rest-pose bounds don't follow
 * its bones), so all 22 men of a match were drawn every frame even when the
 * TV camera showed six of them: ~21k triangles each.
 *
 * This gives each skinned mesh a generous sphere of its own (its rest-pose
 * sphere, `grow` times wider: a dive, a stretch, a kick still fit inside) and
 * lets three skip the men the camera can't see. A man anywhere on screen is
 * drawn exactly as before; one off it is simply not sent. Off: ?cullpeople=0.
 */
import type * as THREE from "three";

export const CULL_GROW = 3;

export function cullPeopleOff(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).__cullPeopleOff) return true;
  try { return new URLSearchParams(window.location.search).get("cullpeople") === "0"; } catch { return false; }
}

/** Let the camera skip the skinned meshes under `root` when they are off screen. Returns how many. */
export function cullSkinned(T: typeof import("three"), root: THREE.Object3D, grow = CULL_GROW): number {
  if (cullPeopleOff()) return 0;
  let n = 0;
  root.traverse((o: any) => {
    if (!o.isSkinnedMesh || o.frustumCulled || o.userData.cullSphere) return;
    const g = o.geometry;
    if (!g?.attributes?.position) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const s = g.boundingSphere;
    if (!s || !(s.radius > 0)) return;
    o.boundingSphere = new T.Sphere(s.center.clone(), s.radius * grow);
    o.userData.cullSphere = true;
    o.frustumCulled = true;
    n++;
  });
  return n;
}
