/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE SHADOW CACHE (Harry, 9 Oct 2026: "I don't want our solution to bad lag
 * to just be make the game look worse"). Same shadows on screen, far less
 * drawn to make them.
 *
 * Every 3D place redrew its WHOLE shadow map every frame: the stadium, the
 * stands, the goals, the garden's trees and fences, the shop's shelves —
 * none of which move — plus the people, who do. This wraps the renderer's
 * shadow pass (one call per renderer, from governScene / the real game) so:
 *
 *   1. THE STILL THINGS are drawn into the light's map ONCE and kept (a
 *      cache picture). Drawn again only when the light, the shadow box, the
 *      map size or the still set itself changes (something added, hidden,
 *      moved).
 *   2. THE MOVING THINGS (people, the ball, anything seen moving) are drawn
 *      on top each frame: the kept picture is copied back first (one full-map
 *      pass that also restores its depth), then only the movers are drawn,
 *      depth-tested against it — exactly what a full redraw would make.
 *      Nothing moving casting at all → the kept map is used as it is: no
 *      shadow drawing that frame.
 *   3. PEOPLE cast from a lighter copy of their body (a "shadow body"): the
 *      same skeleton and the same vertices, with the triangles merged on a
 *      ~4 cm grid per bone. At the shadow map's size (5–10 cm a texel) its
 *      outline is the body's own; a man's 21k triangles become ~2–4k. The
 *      shadow body is only switched on inside the shadow pass; the picture
 *      draws the real body as before.
 *
 * Self-checking: a "still" mesh found moving is moved to the movers (one
 * redraw); one that flickers on/off is too. (A custom depth material is taken
 * as still: the garden's leaf cards cut their shadow with a picture; a
 * shader that sways must mark its mesh with markShadowMoving.) A light whose box keeps moving
 * (more than 8 redraws in 60 frames) is left to three's own pass for 10 s.
 * Off: ?shadowcache=0 (the cache) or ?shadowbody=0 (the shadow bodies), or
 * window.__shadowCacheOff = true. Stats on window.__shadowCache.
 *
 * Only directional and spot lights are cached; point lights and VSM pass
 * straight through. Tested in tests/star/shadowCache.mts (the classifying
 * and the "a still frame redraws nothing" rule, with a counting fake renderer).
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** A light whose cache is redrawn more than this many times in 60 shadow frames is left uncached for a while. */
export const THRASH_REBUILDS = 8;
/** Frames between full looks for new casters (a mesh added to the scene). */
export const SWEEP_EVERY = 30;
/** A still mesh flipping (visible / casting / material) more than this many times is treated as moving. */
export const FLIP_LIMIT = 3;
/** The shadow body's grid: this share of the body's tallest side (1.8 m → 4 cm). */
export const BODY_CELL = 1 / 45;

export interface ShadowCacheStats {
  /** Shadow frames seen. */
  frames: number;
  /** Cache pictures drawn (the still things). */
  rebuilds: number;
  /** Frames where only the movers were drawn on top of the kept picture. */
  overlays: number;
  /** Frames that drew nothing at all (nothing moving casts). */
  reused: number;
  /** Frames passed straight to three (light uncached, thrashing, or off). */
  passed: number;
  statics: number;
  movers: number;
  /** Shadow bodies in use, and the triangles one saves on average. */
  bodies: number;
  bodyTris: { from: number; to: number };
  /** Why the last cache picture was drawn. */
  lastWhy: string;
}

interface Entry {
  o: any;
  m: Float64Array;
  cast: boolean;
  vis: boolean;
  mat: any;
  geo: any;
  iv: number;
  ic: number;
  pv: number;
  flips: number;
}

interface SceneState {
  version: number;
  statics: Entry[];
  movers: any[];
  lastSweep: number;
  /** Casters seen at the last sweep (a cheap "anything new?" count). */
  seen: number;
}

interface LightState {
  cacheRT: any;
  dynRT: any;
  sig: number[];
  version: number;
  scene: any;
  ready: boolean;
  rebuildAt: number[];
  offUntil: number;
}

/** Things never treated as still: anything seen moving, flickering, or animated by its vertices. */
const MOVING = new WeakSet<object>();
/** Mark an object (and everything under it) as moving: its shadow is drawn every frame. */
export function markShadowMoving(o: THREE.Object3D) { o.traverse((x) => MOVING.add(x)); }

const isAnimated = (o: any) =>
  o.isSkinnedMesh || !!(o.geometry?.morphAttributes && Object.keys(o.geometry.morphAttributes).length) || !!o.userData?.dynamic;

/** True when `o` is drawn by a shadow pass of `scene` (visible all the way up and still in the scene). */
export function inScene(o: any, scene: any): boolean {
  for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; }
  return false;
}

const casts = (o: any) => (o.isMesh || o.isLine || o.isPoints) && o.castShadow;

/** Sort every caster under `scene` into still and moving (pure: used by tests). */
export function classifyCasters(scene: any): { statics: any[]; movers: any[] } {
  const statics: any[] = [], movers: any[] = [];
  const walk = (o: any, moving: boolean) => {
    if (!o.visible) return;
    const mv = moving || MOVING.has(o) || isAnimated(o) || !!o.isBone;
    if (casts(o)) (mv ? movers : statics).push(o);
    for (const c of o.children) walk(c, mv);
  };
  walk(scene, false);
  return { statics, movers };
}

const entryOf = (o: any): Entry => {
  const e: Entry = { o, m: new Float64Array(16), cast: true, vis: true, mat: null, geo: null, iv: 0, ic: 0, pv: 0, flips: 0 };
  snap(e);
  return e;
};
function snap(e: Entry) {
  const o = e.o;
  e.m.set(o.matrixWorld.elements);
  e.cast = !!o.castShadow;
  e.mat = o.material;
  e.geo = o.geometry;
  e.iv = o.instanceMatrix ? o.instanceMatrix.version : 0;
  e.ic = o.isInstancedMesh ? o.count : 0;
  e.pv = o.geometry?.attributes?.position?.version ?? 0;
}

/**
 * Has a still caster changed since its picture was drawn? "move" (it moved:
 * it is a mover from now on), "flip" (shown/hidden, material, casting), or null.
 */
export function entryChange(e: Entry, scene: any): "move" | "flip" | null {
  const o = e.o;
  const el = o.matrixWorld.elements;
  for (let i = 0; i < 16; i++) if (el[i] !== e.m[i]) return "move";
  if (o.instanceMatrix && o.instanceMatrix.version !== e.iv) return "move";
  if ((o.geometry?.attributes?.position?.version ?? 0) !== e.pv) return "move";
  if (!!o.castShadow !== e.cast || o.material !== e.mat || o.geometry !== e.geo || (o.isInstancedMesh && o.count !== e.ic)) return "flip";
  if (!inScene(o, scene)) return "flip";
  return null;
}

/** What a light's shadow map depends on (its place, its aim, its box, its size). */
function lightSig(l: any): number[] {
  const a = l.matrixWorld.elements, b = l.target ? l.target.matrixWorld.elements : null, c = l.shadow.camera;
  return [a[12], a[13], a[14], b ? b[12] : 0, b ? b[13] : 0, b ? b[14] : 0,
    c.left ?? 0, c.right ?? 0, c.top ?? 0, c.bottom ?? 0, c.near, c.far, c.zoom ?? 1, c.fov ?? 0,
    l.shadow.mapSize.x, l.shadow.mapSize.y, l.angle ?? 0, l.distance ?? 0, l.shadow.focus ?? 1];
}
const sameSig = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── the shadow body ──

/**
 * A lighter index list for a skinned body: vertices merged on a grid per
 * dominant bone (so no triangle ever spans two limbs that weren't joined),
 * each new corner an EXISTING vertex (so its skin weights are real), and the
 * triangles that collapse dropped. Pure; cached per geometry.
 */
export function shadowBodyIndex(geo: any, cellShare = BODY_CELL): Uint32Array | null {
  const pos = geo.attributes?.position, si = geo.attributes?.skinIndex, sw = geo.attributes?.skinWeight;
  if (!pos || !si || !sw) return null;
  const n = pos.count;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cell = Math.max(x1 - x0, y1 - y0, z1 - z0) * cellShare;
  if (!(cell > 0)) return null;
  const rep = new Uint32Array(n);
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let bone = si.getX(i), bw = sw.getX(i);
    const ws = [sw.getY(i), sw.getZ(i), sw.getW(i)], bs = [si.getY(i), si.getZ(i), si.getW(i)];
    for (let k = 0; k < 3; k++) if (ws[k] > bw) { bw = ws[k]; bone = bs[k]; }
    const key = `${Math.floor((pos.getX(i) - x0) / cell)},${Math.floor((pos.getY(i) - y0) / cell)},${Math.floor((pos.getZ(i) - z0) / cell)},${bone}`;
    let r = map.get(key);
    if (r === undefined) { r = i; map.set(key, i); }
    rep[i] = r;
  }
  const src = geo.index;
  const tris = src ? src.count / 3 : n / 3;
  const out: number[] = [];
  const seen = new Set<string>();
  for (let t = 0; t < tris; t++) {
    const i0 = src ? src.getX(t * 3) : t * 3, i1 = src ? src.getX(t * 3 + 1) : t * 3 + 1, i2 = src ? src.getX(t * 3 + 2) : t * 3 + 2;
    const a = rep[i0], b = rep[i1], c = rep[i2];
    if (a === b || b === c || a === c) continue;
    // the same triangle twice (thin ones collapsing onto one): keep one; turned so its smallest corner leads, winding kept
    const kk = a < b && a < c ? `${a},${b},${c}` : b < c ? `${b},${c},${a}` : `${c},${a},${b}`;
    if (seen.has(kk)) continue;
    seen.add(kk);
    out.push(a, b, c);
  }
  return new Uint32Array(out);
}

/** The shadow body can stand in only when the shadow doesn't read a picture (no cut-out hair cards). */
const bodyOk = (o: any) => {
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  return ms.every((m: any) => m && !(m.alphaTest > 0) && !m.alphaMap && !(m.transparent && m.opacity < 1) && m.clipShadows !== true);
};

// ── the installer ──

interface Installed {
  stats: ShadowCacheStats;
  invalidate(): void;
  /** A light leaving for good (its scene closed): free its two kept maps now, not whenever the browser collects them. */
  forget(light: unknown): void;
}

// the address bar is read once per page (these ran every shadow frame)
const urlFlag = (() => {
  const seen = new Map<string, boolean>();
  return (k: string) => {
    let v = seen.get(k);
    if (v === undefined) { try { v = new URLSearchParams(window.location.search).get(k) === "0"; } catch { v = false; } seen.set(k, v); }
    return v;
  };
})();
export function shadowCacheOff(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).__shadowCacheOff) return true;
  return urlFlag("shadowcache");
}
function shadowBodyOff(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).__shadowBodyOff) return true;
  return urlFlag("shadowbody");
}

/**
 * Put the cache on a renderer (once; safe to call from every scene that
 * shares it). Returns the stats and a way to force a fresh cache picture
 * (the time of day changed a light's colour only: not needed; a still thing
 * was rebuilt in place: call it).
 */
export function installShadowCache(T: Three, renderer: THREE.WebGLRenderer): Installed {
  const r: any = renderer;
  if (r.__shadowCache) return r.__shadowCache;
  const sm: any = renderer.shadowMap;
  const orig = sm.render.bind(sm);
  const stats: ShadowCacheStats = { frames: 0, rebuilds: 0, overlays: 0, reused: 0, passed: 0, statics: 0, movers: 0, bodies: 0, bodyTris: { from: 0, to: 0 }, lastWhy: "" };
  const scenes = new WeakMap<object, SceneState>();
  const lights = new WeakMap<object, LightState>();
  let frame = 0;
  let forced = 0;

  // the kept picture is copied back with its depth: one triangle over the whole map
  const fsGeo = new T.BufferGeometry();
  fsGeo.setAttribute("position", new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const restoreMat = new T.ShaderMaterial({
    uniforms: { tCache: { value: null } },
    vertexShader: "varying vec2 vUv;\nvoid main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: "#include <packing>\nuniform sampler2D tCache;\nvarying vec2 vUv;\nvoid main(){ vec4 c = texture2D(tCache, vUv); gl_FragColor = c; gl_FragDepth = unpackRGBAToDepth(c); }",
    depthTest: true, depthWrite: true, blending: T.NoBlending, side: T.DoubleSide,
  });
  const restoreMain = new T.MeshBasicMaterial();
  (restoreMain as any).shadowSide = T.DoubleSide;
  const restore = new T.Mesh(fsGeo, restoreMain);
  restore.customDepthMaterial = restoreMat;
  restore.frustumCulled = false;
  restore.castShadow = true;
  restore.visible = false;
  restore.matrixAutoUpdate = false;
  restore.onBeforeShadow = (_r: any, _o: any, _c: any, shadowCamera: any) => {
    // the light whose map this is: its kept picture
    let tex = null;
    for (const l of current) if (l.shadow.camera === shadowCamera) { tex = lights.get(l)?.cacheRT?.texture ?? null; break; }
    restoreMat.uniforms.tCache.value = tex;
    restoreMat.uniformsNeedUpdate = true;
  };
  let current: any[] = [];

  // the root each pass draws: the restore triangle, the scene, the shadow bodies
  const fake: any = new T.Group();
  fake.matrixAutoUpdate = false;

  // ── shadow bodies ──
  const bodyIdx = new WeakMap<object, any>();
  const bodyOf = new WeakMap<object, any>();
  const bodyFor = (o: any): any => {
    let b = bodyOf.get(o);
    if (b !== undefined) return b;
    b = null;
    if (o.isSkinnedMesh && o.skeleton && bodyOk(o)) {
      let g = bodyIdx.get(o.geometry);
      if (g === undefined) {
        g = null;
        const idx = shadowBodyIndex(o.geometry);
        const from = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        if (idx && idx.length / 3 < from * 0.8) {
          g = new T.BufferGeometry();
          for (const k of Object.keys(o.geometry.attributes)) g.setAttribute(k, o.geometry.attributes[k]);
          g.setIndex(new T.BufferAttribute(idx, 1));
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          g.boundingSphere = o.geometry.boundingSphere;
          g.userData.from = from; g.userData.to = idx.length / 3;
        }
        bodyIdx.set(o.geometry, g);
      }
      if (g) {
        const mat = Array.isArray(o.material) ? o.material.find((m: any) => m) : o.material;
        b = new T.SkinnedMesh(g, mat);
        b.skeleton = o.skeleton; b.bindMatrix = o.bindMatrix; b.bindMatrixInverse = o.bindMatrixInverse; b.bindMode = o.bindMode;
        b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false;
        // culled against the shadow box (the real body never is): its rest sphere, made generous for reaching limbs
        const s = g.boundingSphere;
        b.boundingSphere = s ? new T.Sphere(s.center.clone(), s.radius * 2) : null;
        b.frustumCulled = !!s;
        b.visible = false;
        b.userData.shadowBody = true;
        stats.bodies++;
        stats.bodyTris.from += g.userData.from; stats.bodyTris.to += g.userData.to;
      }
    }
    bodyOf.set(o, b);
    return b;
  };

  const sceneState = (scene: any): SceneState => {
    let s = scenes.get(scene);
    if (!s) { s = { version: 0, statics: [], movers: [], lastSweep: -1e9, seen: 0 }; scenes.set(scene, s); }
    return s;
  };
  const sweep = (ss: SceneState, scene: any) => {
    const { statics, movers } = classifyCasters(scene);
    ss.statics = statics.map(entryOf);
    ss.movers = movers;
    ss.seen = statics.length + movers.length;
    ss.lastSweep = frame;
    ss.version++;
    stats.statics = statics.length; stats.movers = movers.length;
  };
  const countCasters = (scene: any) => { let n = 0; const w = (o: any) => { if (!o.visible) return; if (casts(o)) n++; for (const c of o.children) w(c); }; w(scene); return n; };
  /** Look for change in the still set; true when it was re-sorted (every cache must be redrawn). */
  const check = (ss: SceneState, scene: any): string | null => {
    let why: string | null = null;
    for (const e of ss.statics) {
      const c = entryChange(e, scene);
      if (!c) continue;
      if (c === "move" || ++e.flips > FLIP_LIMIT) MOVING.add(e.o);
      why = why ?? (c === "move" ? "a still thing moved" : "a still thing changed");
    }
    if (!why && frame - ss.lastSweep >= SWEEP_EVERY) {
      ss.lastSweep = frame;
      if (countCasters(scene) !== ss.seen) why = "casters added or removed";
    }
    if (why) {
      const flips = new Map(ss.statics.map((e) => [e.o, e.flips]));
      sweep(ss, scene);
      for (const e of ss.statics) e.flips = flips.get(e.o) ?? 0;
    }
    return why;
  };

  const makeRT = (w: number, h: number) => new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const lightState = (l: any): LightState => {
    let s = lights.get(l);
    if (!s) { s = { cacheRT: null, dynRT: null, sig: [], version: -1, scene: null, ready: false, rebuildAt: [], offUntil: -1 }; lights.set(l, s); }
    return s;
  };
  const ensureRTs = (l: any, s: LightState) => {
    const w = l.shadow.mapSize.x, h = l.shadow.mapSize.y;
    const mine = l.shadow.map && (l.shadow.map === s.cacheRT || l.shadow.map === s.dynRT);
    if (s.cacheRT && s.cacheRT.width === w && s.cacheRT.height === h && (mine || !l.shadow.map)) return false;
    if (l.shadow.map && !mine) l.shadow.map.dispose();
    s.cacheRT?.dispose(); s.dynRT?.dispose();
    s.cacheRT = makeRT(w, h); s.cacheRT.texture.name = `${l.name}.shadowCache`;
    s.dynRT = makeRT(w, h); s.dynRT.texture.name = `${l.name}.shadowMap`;
    l.shadow.map = s.dynRT;
    l.shadow.camera.updateProjectionMatrix();
    s.ready = false;
    return true;
  };

  /** One run of three's own pass over `ls` (it renders each light that wants it, into its current map). */
  const run = (ls: any[], root: any, camera: any) => {
    if (!ls.length) return;
    for (const l of ls) l.shadow.needsUpdate = true;
    sm.needsUpdate = true;
    current = ls;
    orig(ls, root, camera);
    current = [];
  };

  const uncached = (l: any) => !(l.isDirectionalLight || l.isSpotLight) || sm.type === T.VSMShadowMap;

  // a camera that only asks for the shadow pass (it sees a layer nothing is on) names the layers the casters are on
  const layersCam: any = { layers: new T.Layers() };
  sm.render = function (lightsIn: any[], scene: any, cam: any) {
    let camera = cam;
    if (cam?.userData?.shadowLayers !== undefined) { layersCam.layers.mask = cam.userData.shadowLayers; camera = layersCam; }
    if (sm.enabled === false) return;
    if (sm.autoUpdate === false && sm.needsUpdate === false) return;
    if (!lightsIn.length) return;
    const off = shadowCacheOff();
    if (off && shadowBodyOff()) return orig(lightsIn, scene, camera);
    frame++;
    stats.frames++;
    const todo = lightsIn.filter((l) => l.shadow && (l.shadow.autoUpdate || l.shadow.needsUpdate));
    if (!todo.length) { sm.needsUpdate = false; return; }

    // the shadow bodies stand in for the people inside this pass only
    const swaps: any[] = [];
    fake.children = [scene];
    if (!shadowBodyOff()) {
      const walk = (o: any) => {
        if (!o.visible) return;
        if (o.isSkinnedMesh && o.castShadow) {
          const b = bodyFor(o);
          if (b) {
            b.matrixWorld.copy(o.matrixWorld);
            b.layers.mask = o.layers.mask;
            b.visible = true; b.castShadow = true;
            if (o.customDepthMaterial) b.customDepthMaterial = o.customDepthMaterial;
            o.castShadow = false;
            swaps.push(o, b);
            fake.children.push(b);
          }
        }
        for (const c of o.children) walk(c);
      };
      walk(scene);
    }
    try {
      const cached: any[] = [], plain: any[] = [];
      for (const l of todo) {
        // a light that already redraws its shadow only on demand (shadow.autoUpdate false, e.g. the shop's car spot)
        // gains nothing from the cache, and the cache's own pass on its needsUpdate frames was an extra draw
        const s = off || uncached(l) || l.shadow.autoUpdate === false ? null : lightState(l);
        if (!s || frame < s.offUntil) plain.push(l); else cached.push(l);
      }
      stats.passed += plain.length ? 1 : 0;
      run(plain, fake, camera);
      if (!cached.length) return;

      const ss = sceneState(scene);
      const changed = check(ss, scene);
      const rebuild: any[] = [];
      for (const l of cached) {
        const s = lightState(l);
        const fresh = ensureRTs(l, s);
        const sig = lightSig(l);
        let why: string | null = null;
        if (fresh || !s.ready) why = "new map";
        else if (forced) why = "asked";
        else if (s.scene !== scene) why = "another scene";
        else if (s.version !== ss.version) why = changed ?? "still set re-sorted";
        else if (!sameSig(sig, s.sig)) why = "light or box moved";
        if (why) {
          s.sig = sig; s.scene = scene; s.version = ss.version; s.ready = true;
          s.rebuildAt.push(frame);
          while (s.rebuildAt.length && frame - s.rebuildAt[0] > 60) s.rebuildAt.shift();
          if (s.rebuildAt.length > THRASH_REBUILDS && why === "light or box moved") { s.offUntil = frame + 600; s.ready = false; s.rebuildAt.length = 0; }
          rebuild.push(l);
          stats.lastWhy = why;
        }
      }
      forced = 0;
      // the box keeps moving: three's own pass for a while
      const thrash = cached.filter((l) => frame < lightState(l).offUntil);
      if (thrash.length) {
        for (const l of thrash) { const s = lightState(l); l.shadow.map = s.dynRT; }
        run(thrash, fake, camera);
      }
      const live = cached.filter((l) => !thrash.includes(l));
      const rb = rebuild.filter((l) => live.includes(l));

      // 1. the still things, into the kept picture (anything new since the last look is sorted first)
      if (rb.length) {
        if (countCasters(scene) !== ss.seen) { sweep(ss, scene); for (const l of rb) lightState(l).version = ss.version; }
        const saved = ss.movers.map((o) => o.castShadow);
        for (const o of ss.movers) o.castShadow = false;
        const sb = swaps.filter((_x, i) => i % 2 === 1);
        for (const b of sb) b.castShadow = false;
        for (const l of rb) l.shadow.map = lightState(l).cacheRT;
        try { run(rb, fake, camera); } finally {
          ss.movers.forEach((o, i) => { o.castShadow = saved[i]; });
          for (const b of sb) b.castShadow = true;
        }
        stats.rebuilds++;
      }
      if (!live.length) return;

      // 2. the moving things, on top of it (or the kept picture as it is)
      let anyMover = swaps.length > 0;
      if (!anyMover) for (const o of ss.movers) if (o.castShadow && inScene(o, scene)) { anyMover = true; break; }
      if (!anyMover) {
        for (const l of live) l.shadow.map = lightState(l).cacheRT;
        stats.reused++;
        return;
      }
      const savedS = ss.statics.map((e) => e.o.castShadow);
      for (const e of ss.statics) e.o.castShadow = false;
      for (const l of live) l.shadow.map = lightState(l).dynRT;
      fake.children.unshift(restore);
      restore.visible = true;
      try { run(live, fake, camera); } finally {
        restore.visible = false;
        fake.children.shift();
        ss.statics.forEach((e, i) => { e.o.castShadow = savedS[i]; });
      }
      stats.overlays++;
    } finally {
      for (let i = 0; i < swaps.length; i += 2) { swaps[i].castShadow = true; swaps[i + 1].visible = false; }
      fake.children = [];
      sm.needsUpdate = false;
      if (typeof window !== "undefined") (window as any).__shadowCache = stats;
    }
  };

  const inst: Installed = {
    stats,
    invalidate() { forced = 1; },
    forget(l: any) {
      const s = lights.get(l);
      if (!s) return;
      if (l.shadow && (l.shadow.map === s.cacheRT || l.shadow.map === s.dynRT)) l.shadow.map = null;
      s.cacheRT?.dispose(); s.dynRT?.dispose();
      s.cacheRT = null; s.dynRT = null; s.ready = false;
      lights.delete(l);
    },
  };
  r.__shadowCache = inst;
  return inst;
}
