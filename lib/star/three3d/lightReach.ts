/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LIGHTS ONLY WHERE THEY REACH (9 Oct 2026, lag pass 2; Harry: "same picture,
 * less work"). Every lit pixel in a three.js scene works out EVERY light in
 * the scene, even a lamp 30 m away whose light ends at 5 m, and even a light
 * turned down to nothing. Two exact savings, no change to the picture:
 *
 *   1. DARK LIGHTS LEAVE THE SHADER. A light at intensity 0 (the garden's
 *      fill light by day, the stadium's three flood banks by day) adds
 *      exactly nothing, so it is hidden from the lighting while it is dark
 *      and shown again the moment it is turned up.
 *   2. FAR MATERIALS SKIP THE LAMPS. A point or spot light with a range
 *      (`distance`) gives exactly zero beyond it (three's cutoff). A material
 *      whose meshes are all still and all out of reach of every lamp has the
 *      lamp loop taken out of its shader. If any lamp or any of those meshes
 *      moves, the material is put back as built.
 *
 * A lamp that follows something (userData.moves) or has no range means no
 * material can skip the loop; nothing is patched.
 * Off: ?lightreach=0 or window.__lightReachOff. Tested in tests/star/lightReach.mts.
 */
import type * as THREE from "three";

type Three = typeof import("three");

export function lightReachOff(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).__lightReachOff) return true;
  try { return new URLSearchParams(window.location.search).get("lightreach") === "0"; } catch { return false; }
}

const LIT = (m: any) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial) && !m.isShaderMaterial;
const isLamp = (l: any) => (l.isPointLight || l.isSpotLight);

/** Is a world-space sphere wholly out of a lamp's reach? (pure) */
export function outOfReach(lampPos: { x: number; y: number; z: number }, distance: number, c: { x: number; y: number; z: number }, r: number): boolean {
  if (!(distance > 0)) return false;
  const d = Math.hypot(c.x - lampPos.x, c.y - lampPos.y, c.z - lampPos.z);
  return d - r > distance * 1.001;
}

/** The lighting chunk without the point and spot loops (directional, hemisphere, ambient and env stay). */
export function noLampsChunk(chunk: string): string | null {
  const a = "#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )", b = "#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )";
  if (!chunk.includes(a) || !chunk.includes(b)) return null;
  return chunk.replace(a, "#if 0").replace(b, "#if 0");
}

export interface LightReach {
  /** Look and patch (call BEFORE the scene's shaders are compiled: a patch is a new shader). */
  update(): void;
  /** Only put back what is no longer safe (a lamp or a mesh moved, a mesh added): never compiles anything new unless it must. */
  check(): void;
  stats: { darkHidden: number; materialsSkipping: number; materialsLit: number; lamps: number };
  dispose(): void;
}

export function lightReach(T: Three, scene: THREE.Object3D): LightReach {
  const stats = { darkHidden: 0, materialsSkipping: 0, materialsLit: 0, lamps: 0 };
  const chunk = noLampsChunk((T as any).ShaderChunk.lights_fragment_begin);
  const patched = new Map<any, { lamps: string; meshes: { o: any; m: Float64Array }[] }>();
  const dark = new Set<any>();
  let lampKey = "";
  let movedLamp = false;
  const sph = new T.Sphere();

  const patch = (m: any) => {
    if (m.userData.noLamps) return;
    m.userData.noLamps = true;
    if (!m.userData.noLampsWrapped) {
      m.userData.noLampsWrapped = true;
      const inner = m.onBeforeCompile;
      const innerKey = m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile = function (sh: any, r: any) {
        inner?.call(m, sh, r);
        if (m.userData.noLamps && chunk) sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_begin>", chunk);
      };
      m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-nolamps${m.userData.noLamps ? 1 : 0}`;
    }
    m.needsUpdate = true;
  };
  const unpatch = (m: any) => { if (!m.userData.noLamps) return; m.userData.noLamps = false; m.needsUpdate = true; };

  const update = (patchNew = true) => {
    if (lightReachOff() || !chunk) {
      for (const m of Array.from(patched.keys())) unpatch(m);
      patched.clear();
      for (const l of Array.from(dark)) l.visible = true;
      dark.clear();
      stats.darkHidden = 0; stats.materialsSkipping = 0;
      return;
    }
    scene.updateMatrixWorld();
    // 1. dark lights out of the shader (and back when turned up)
    const lamps: any[] = [];
    scene.traverse((o: any) => {
      if (!o.isLight) return;
      if (dark.has(o)) { if (o.intensity > 0) { o.visible = true; dark.delete(o); } }
      else if (patchNew && o.visible && o.intensity === 0 && !o.isAmbientLight && !o.castShadow) { o.visible = false; dark.add(o); }
    });
    scene.traverseVisible((o: any) => { if (o.isLight && isLamp(o)) lamps.push(o); });
    stats.darkHidden = dark.size;
    stats.lamps = lamps.length;
    // 2. lamps: all with a range, none moved since we looked
    const key = lamps.map((l) => { const e = l.matrixWorld.elements; return `${l.uuid}:${e[12].toFixed(3)},${e[13].toFixed(3)},${e[14].toFixed(3)},${l.distance}`; }).join("|");
    if (lampKey && key !== lampKey) { if (lamps.length && lampKey.split("|").length === lamps.length) movedLamp = true; }
    lampKey = key;
    const bad = movedLamp || lamps.some((l) => !(l.distance > 0) || l.userData?.moves);
    if (bad) { for (const m of Array.from(patched.keys())) unpatch(m); patched.clear(); stats.materialsSkipping = 0; return; }
    if (!lamps.length) return; // nothing to skip (an empty loop costs nothing)
    // materials → their meshes, and whether every one is still and out of reach
    const uses = new Map<any, any[]>();
    const unsafe = new Set<any>();
    const walk = (o: any, moving: boolean) => {
      const mv = moving || o.isSkinnedMesh || o.isBone || !!o.userData?.dynamic;
      if (o.isMesh) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if (!LIT(m)) continue;
          if (mv || o.isInstancedMesh) { unsafe.add(m); continue; }
          let a = uses.get(m); if (!a) uses.set(m, (a = [])); a.push(o);
        }
      }
      for (const c of o.children) walk(c, mv);
    };
    walk(scene, false);
    // a patched material whose meshes moved, grew in number, or whose lamps changed: put back first
    for (const [m, p] of Array.from(patched)) {
      const now = uses.get(m);
      if (unsafe.has(m) || !now || now.length !== p.meshes.length || p.lamps !== key || p.meshes.some((x) => !x.o.matrixWorld.elements.every((v: number, i: number) => v === x.m[i]))) { unpatch(m); patched.delete(m); }
    }
    if (!patchNew) { stats.materialsSkipping = patched.size; return; }
    const lp = lamps.map((l) => ({ p: new T.Vector3().setFromMatrixPosition(l.matrixWorld), d: l.distance }));
    let lit = 0;
    for (const [m, meshes] of Array.from(uses)) {
      lit++;
      if (unsafe.has(m) || patched.has(m)) continue;
      let far = true;
      for (const o of meshes) {
        const g = o.geometry; if (!g) { far = false; break; }
        if (!g.boundingSphere) g.computeBoundingSphere();
        sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
        if (lp.some((L) => !outOfReach(L.p, L.d, sph.center, sph.radius))) { far = false; break; }
      }
      if (!far) continue;
      patch(m);
      patched.set(m, { lamps: key, meshes: meshes.map((o) => ({ o, m: Float64Array.from(o.matrixWorld.elements) })) });
    }
    stats.materialsLit = lit;
    stats.materialsSkipping = patched.size;
  };

  return {
    update: () => update(true),
    check: () => update(false),
    stats,
    dispose() { for (const m of Array.from(patched.keys())) unpatch(m); patched.clear(); for (const l of Array.from(dark)) l.visible = true; dark.clear(); },
  };
}
