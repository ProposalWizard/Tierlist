/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TIGHT CULLING: DON'T DRAW WHAT THE CAMERA CAN'T SEE (28 Nov 2026, Harry: "wherever the camera
 * isn't looking unloads to help load the game"). three.js already skips a mesh outside the view,
 * but it tests a ball round the mesh. A place's still pieces are joined into a few big meshes
 * (freezeStatic: one per material), and a ball round a joined mesh is huge: the garden's hedge
 * runs, its kerbs, a zone of trees 9 m behind the camera all "touched" the view, so they were drawn
 * every frame. Measured at the garden gate (28 Nov): 7 tree zones drawn, none on screen.
 *
 * Here each still mesh keeps its real box (world space, worked out once) and, for each picture,
 * a mesh whose box is outside the camera's view is left out. Nothing is unloaded or rebuilt (that
 * would hitch as you turn): the mesh is only skipped while three sorts what to draw, then put back
 * before the shadow pass and after the frame, so the shadows, the kept shadow picture
 * (shadowCache.ts) and everything else see it as always there.
 *
 * Only meshes with a ball wider than `minRadius` are checked (a small one is tested tightly enough
 * by three itself). Off: ?tightcull=0. Stats on window.__tightCull.
 */
import type * as THREE from "three";

export function tightCullOff(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("tightcull") === "0"; } catch { return false; }
}

/** Run `fn` just before each shadow pass of `renderer` (after three has sorted what the camera draws). */
export function beforeShadowPass(renderer: any, fn: () => void): () => void {
  const sm = renderer?.shadowMap;
  if (!sm) return () => {};
  if (!sm.__beforePass) {
    const hooks = new Set<() => void>();
    const inner = sm.render;
    sm.render = function (...a: any[]) { hooks.forEach((f) => f()); return inner.apply(this, a); };
    sm.__beforePass = hooks;
  }
  sm.__beforePass.add(fn);
  return () => { sm.__beforePass.delete(fn); };
}

export interface TightCull {
  /** How many meshes it checks, and how many the last picture left out. */
  stats(): { checked: number; skipped: number };
  dispose(): void;
}

/**
 * Check every still mesh under `scene` (not under anything in `moving`) against the camera's view,
 * box by box, on every render of `scene`. Call once the place is built and its still pieces joined.
 * `extraHide(camera)`: more meshes to leave out of this picture (e.g. a zone behind a building).
 */
export function tightCull(T: typeof import("three"), scene: THREE.Scene, renderer: THREE.WebGLRenderer, o: { moving?: Set<any>; minRadius?: number; extraHide?: (camera: any) => any[] } = {}): TightCull {
  const minR = o.minRadius ?? 2;
  let items: { m: any; box: THREE.Box3; mw: THREE.Matrix4 }[] = [];
  const off = tightCullOff();
  scene.updateMatrixWorld(true);
  const under = (x: any) => { for (let p = x; p; p = p.parent) if (o.moving?.has(p)) return true; return false; };
  if (!off) scene.traverse((m: any) => {
    if (!(m.isMesh || m.isPoints) || m.isSkinnedMesh || !m.frustumCulled || under(m)) return;
    const g = m.geometry;
    if (!g?.attributes?.position) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    let box: THREE.Box3;
    if (m.isInstancedMesh) { if (!m.boundingSphere) m.computeBoundingSphere(); if (m.boundingSphere.radius < minR) return; m.computeBoundingBox(); box = m.boundingBox.clone(); }
    else { if (!g.boundingSphere || g.boundingSphere.radius < minR) return; if (!g.boundingBox) g.computeBoundingBox(); box = g.boundingBox.clone(); }
    box.applyMatrix4(m.matrixWorld);
    if (!isFinite(box.min.x) || box.max.x - box.min.x > 150) return; // the sky, the far ground: always seen
    items.push({ m, box, mw: m.matrixWorld.clone() });
  });
  const frustum = new T.Frustum(), pm = new T.Matrix4();
  const hidden: any[] = [];
  let last = 0;
  const restore = () => { for (const m of hidden) m.visible = true; hidden.length = 0; };
  const before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = function (r: any, s: any, camera: any, rt: any) {
    (before as any).call(this, r, s, camera, rt);
    restore();
    if (!camera?.projectionMatrix) return;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let moved = false;
    for (const it of items) {
      // a piece that turned out to move (a door, a card that faces you) is left to three's own check
      if (!it.m.matrixWorld.equals(it.mw)) { moved = true; it.mw = null as any; continue; }
      if (it.m.visible && !frustum.intersectsBox(it.box)) { it.m.visible = false; hidden.push(it.m); }
    }
    if (moved) items = items.filter((it) => it.mw);
    if (o.extraHide) for (const m of o.extraHide(camera)) if (m.visible) { m.visible = false; hidden.push(m); }
    last = hidden.length;
  };
  scene.onAfterRender = function (...a: any[]) { (after as any).apply(this, a); restore(); };
  const unhook = beforeShadowPass(renderer, restore);
  const show = () => { if (typeof window !== "undefined") (window as any).__tightCull = { checked: items.length, skipped: last }; };
  const timer = typeof window !== "undefined" ? window.setInterval(show, 1000) : null;
  return {
    stats: () => ({ checked: items.length, skipped: last }),
    dispose() { restore(); unhook(); if (timer !== null) window.clearInterval(timer); scene.onBeforeRender = before; scene.onAfterRender = after; },
  };
}
