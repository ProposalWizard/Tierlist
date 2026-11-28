/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GARDEN SEEN FROM OUTSIDE ITS WALL: ONE FAR COPY (garden levels; 28 Nov 2026, the levels' draw budget:
 * looking back at the garden from the yard, the paddock or the field cost 101-120 draws against Medium's 90).
 *
 * Inside the garden every still piece is its own draw per material (freezeStatic already joined what shares a
 * material; what is left is ~60 different materials: a colour or a small picture each). From out past
 * FAR_FROM_X the garden is 25-90 m off, so those pieces are drawn from a merged LOW-DETAIL COPY instead: the same
 * shapes in the same places, each piece's colour (and a small picture's average colour) baked into its corners,
 * joined into a handful of draws: plain, metal, glowing, and one per cut-out picture (leaves and flowers keep
 * their picture, a hole is a hole). Shapes, sizes and places are the real ones, so the swap does not jump as
 * you walk back in.
 *
 *   - Only for drawing: the copy never casts a shadow (the sun's shadow still comes from the real pieces, which
 *     stay in the scene) and is never hit by a tap or the camera's blockers (raycast off): tap-to-walk and the
 *     camera's walls keep reading the real garden, whose groups are untouched.
 *   - Pieces no eye out there can see (wholly behind the wall from every spot in the new areas, or too small
 *     to matter from 25 m+) are left out of the copy.
 *   - Not in it (they keep drawing as before): the tree and bush zones (they have their own detail by distance),
 *     anything that moves, people, instanced meshes, the cars (their own far picture, scene.ts makeImpostor),
 *     see-through pieces (water, glass), the sky, a piece with a shader patch of its own (the foliage tint),
 *     and every material but the standard one (signs' pictures).
 *   - Low detail: corners within CELL of each other (12 cm; 30 cm for the field's copy, 40 m+ off) become one.
 *   - Two copies: the near one (camera west of FAR_FROM_X) and the field's (west of FIELD_FROM_X, level 3+).
 * Off: ?gardenfar=0. Built outside a render (./levelZones.ts update), the first time the camera leaves the garden.
 * Measure: scripts/perf3d/garden-outside.mjs.
 */
import { hiddenBehind, type Occluder } from "./plantZones";

export interface FarItem { m: any; c: number[]; r: number; corners: number[][] }

export interface FarGarden {
  /** The merged copy (added to the scene by the caller, hidden until shown). */
  group: any;
  /** The real pieces the copy stands in for (left out of the picture while it shows). */
  replaces: any[];
  /** Draws in the copy, pieces it stands in for, pieces left out as never seen, triangles; why pieces stayed real. */
  stats: { draws: number; pieces: number; dropped: number; triangles: number; trianglesReplaced: number; kept: Record<string, number> };
  dispose(): void;
}

/** A copy shows while the camera is west of this (the garden's middle ~25 m off and more); ±1 m so it does not flicker. */
export const FAR_FROM_X = -25;

/** A picture's average colour (linear), read off an 8×8 copy of it; null when it cannot be read (a data or packed texture). */
function averageColour(T: any, tex: any, cache: Map<any, any>): any | null {
  if (cache.has(tex)) return cache.get(tex);
  let out: any = null;
  try {
    const im = tex.image;
    if (im && (im.width || im.videoWidth) && typeof document !== "undefined" && !tex.isDataTexture && !tex.isCompressedTexture) {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(im, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data;
      let r = 0, gg = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; r += d[i] * a; gg += d[i + 1] * a; b += d[i + 2] * a; w += a; }
      if (w > 0) out = new T.Color().setRGB(r / w / 255, gg / w / 255, b / w / 255, tex.colorSpace === T.SRGBColorSpace ? T.SRGBColorSpace : T.LinearSRGBColorSpace);
    }
  } catch { out = null; }
  cache.set(tex, out);
  return out;
}

/**
 * Build the copy from the garden's still pieces (`items`, each with its world box corners). `eyes` are the camera
 * spots out in the new areas a piece must be seen from to be kept; `walls` the boxes that hide it; `small` the
 * share of the view across under which a piece is too small to draw from that eye; `skip` pieces that must stay
 * real (the plant zones).
 */
export function buildFarGarden(T: any, mergeGeometries: (g: any[]) => any, items: FarItem[], o: { eyes: number[][]; walls: Occluder[]; small: (eye: number[]) => number; skip?: (m: any) => boolean; cell?: number }): FarGarden {
  const std = (m: any) => m && !Array.isArray(m) && (m.type === "MeshStandardMaterial" || m.type === "MeshPhysicalMaterial");
  // the garden's lighting systems (the baked light, look/bakedLight.ts; the lamps' reach, three3d/lightReach.ts)
  // patch every material in the scene, the copy's new ones too, so a piece they wrapped joins the copy and the copy
  // gets its own wrap from them (never the original's: wrapped twice, the shader does not compile). A piece with a
  // patch of its own (the foliage tint, userData.noBake) stays real.
  const plainShader = (m: any) => m.onBeforeCompile === T.Material.prototype.onBeforeCompile || ((m.userData?.bakeWrapped || m.userData?.noLampsWrapped) && !m.userData?.noBake);
  const shown = (x: any) => { for (let p = x; p; p = p.parent) if (!p.visible) return false; return true; };
  const groups = new Map<string, { mat: any; geos: any[] }>();
  const replaces: any[] = [];
  const avg = new Map<any, any>();
  let dropped = 0, trianglesReplaced = 0;
  const v = new T.Vector3(), nm = new T.Matrix3(), col0 = new T.Color();
  const kept: Record<string, number> = {};
  const keep = (k: string) => { kept[k] = (kept[k] ?? 0) + 1; };
  for (const it of items) {
    const m = it.m;
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh) { keep("instanced or not a mesh"); continue; }
    if (o.skip?.(m)) { keep("own detail (plants)"); continue; }
    if (!std(m.material)) { keep("not the standard material"); continue; }
    if (!plainShader(m.material)) { keep("own shader"); continue; }
    if (!shown(m)) { keep("hidden"); continue; }
    if (!(m.layers.mask & 1)) { keep("own layer (cars)"); continue; }
    if (m.material.transparent) { keep("see-through"); continue; }
    if (it.c[1] > 12) { keep("sky"); continue; }
    const g = m.geometry;
    if (!g?.attributes?.position || !g.attributes.normal || g.morphAttributes?.position?.length) { keep("no normals"); continue; }
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    replaces.push(m);
    trianglesReplaced += tris;
    // seen from anywhere out there? (not wholly behind the wall, not a speck)
    const seen = o.eyes.some((e) => it.r / Math.hypot(it.c[0] - e[0], it.c[1] - e[1], it.c[2] - e[2]) >= o.small(e) && !o.walls.some((w) => hiddenBehind(e, it.corners, w)));
    if (!seen) { dropped++; continue; }
    const mat = m.material;
    // the piece's colour: its material colour × its picture's average (a cut-out keeps its picture: the holes matter)
    const cutout = !!mat.map && mat.alphaTest > 0;
    const pic = mat.map && !cutout ? averageColour(T, mat.map, avg) : null;
    const textured = cutout || (!!mat.map && !pic);
    col0.copy(mat.color);
    if (pic) col0.multiply(pic);
    const glow = mat.emissive && !mat.emissiveMap && (mat.emissive.r + mat.emissive.g + mat.emissive.b) * mat.emissiveIntensity > 0.05;
    const metal = mat.metalness >= 0.5;
    const key = textured ? `pic|${mat.map.uuid}|${mat.alphaTest}` : glow ? "glow" : metal ? "metal" : "plain";
    let grp = groups.get(key);
    if (!grp) {
      let fm: any;
      if (glow) fm = new T.MeshBasicMaterial({ vertexColors: true });
      else {
        // the clone without userData (the baked light keeps its textures there: not for copying) and without the
        // original's shader wraps (the lighting systems wrap the copy themselves)
        const ud = mat.userData;
        mat.userData = {};
        fm = mat.clone();
        mat.userData = ud;
        fm.onBeforeCompile = T.Material.prototype.onBeforeCompile;
        fm.customProgramCacheKey = T.Material.prototype.customProgramCacheKey;
        fm.color = new T.Color(1, 1, 1);
        fm.vertexColors = true;
        if (!textured) fm.map = null;
        fm.normalMap = null; fm.bumpMap = null; fm.roughnessMap = null; fm.metalnessMap = null; fm.aoMap = null; fm.lightMap = null;
        fm.displacementMap = null; fm.emissiveMap = null; fm.emissive = new T.Color(0, 0, 0); fm.alphaMap = null;
        // one shine for the group (25 m+ off a shine hardly reads)
        fm.roughness = metal ? 0.4 : textured ? mat.roughness : 0.82;
        fm.metalness = metal ? 0.8 : 0;
      }
      fm.side = T.DoubleSide; fm.flatShading = false;
      fm.name = `far-${key.split("|")[0]}`;
      grp = { mat: fm, geos: [] };
      groups.set(key, grp);
    }
    // a glowing piece: its glow plus a little of its colour, unlit
    if (glow) col0.multiplyScalar(0.25).add(new T.Color().copy(mat.emissive).multiplyScalar(Math.min(2, mat.emissiveIntensity)));
    // the piece in world space (float attributes: the GLB's packed ones are read, not copied)
    m.updateMatrixWorld();
    nm.getNormalMatrix(m.matrixWorld);
    const P = g.attributes.position, N = g.attributes.normal, U = textured ? g.attributes.uv : null, C = mat.vertexColors ? g.attributes.color : null;
    const n = P.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
      col[i * 3] = col0.r * (C ? C.getX(i) : 1); col[i * 3 + 1] = col0.g * (C ? C.getY(i) : 1); col[i * 3 + 2] = col0.b * (C ? C.getZ(i) : 1);
      if (U) { uv[i * 2] = U.getX(i); uv[i * 2 + 1] = U.getY(i); }
    }
    const ng = new T.BufferGeometry();
    ng.setAttribute("position", new T.BufferAttribute(pos, 3));
    ng.setAttribute("normal", new T.BufferAttribute(nor, 3));
    ng.setAttribute("color", new T.BufferAttribute(col, 3));
    ng.setAttribute("uv", new T.BufferAttribute(uv, 2));
    let idx = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
    // a mirrored piece (negative scale) turns its faces round
    if (m.matrixWorld.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    // low detail: corners closer than CELL (that face the same way) become one, and the triangles that shrink to
    // nothing go; only the big pieces (the shop, the house: a small one, the fountain, would lose its rim; a picture
    // keeps every corner: it would slide)
    if (!textured && tris > 1500) idx = cluster(pos, nor, idx, o.cell ?? CELL);
    ng.setIndex(idx);
    grp.geos.push(ng);
  }
  const group = new T.Group();
  group.name = "garden-far-copy";
  group.visible = false;
  let draws = 0, triangles = 0;
  groups.forEach((grp) => {
    const merged = mergeGeometries(grp.geos);
    grp.geos.forEach((x) => x.dispose());
    if (!merged) return;
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const mesh = new T.Mesh(merged, grp.mat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => {}; // only for drawing: taps and the camera's blockers read the real garden
    mesh.name = "garden-far-part";
    group.add(mesh);
    draws++;
    triangles += merged.index.count / 3;
  });
  group.matrixAutoUpdate = false;
  group.updateMatrixWorld(true);
  return {
    group, replaces,
    stats: { draws, pieces: replaces.length, dropped, triangles: Math.round(triangles), trianglesReplaced: Math.round(trianglesReplaced), kept },
    dispose() { group.traverse((x: any) => { if (x.isMesh) { x.geometry.dispose(); x.material.dispose(); } }); group.removeFromParent(); },
  };
}

/** The low-detail grid (m): ~2 pixels on a phone 25 m off. The field's copy (40 m+ off) is coarser: CELL_FIELD. */
export const CELL = 0.12;
export const CELL_FIELD = 0.3;
/** Past this (the field's gate and on) the field's copy shows instead of the near one (±1 m). */
export const FIELD_FROM_X = -48;

/**
 * Vertex clustering: every corner snaps to the first corner in its CELL-sized box that faces the same way
 * (normals in ~45° bins, so an edge between two faces stays sharp); triangles with two corners in one box go.
 */
export function cluster(pos: Float32Array, nor: Float32Array, idx: number[], cell: number): number[] {
  const rep = new Map<string, number>();
  const to = new Int32Array(pos.length / 3);
  for (let i = 0; i < to.length; i++) {
    const k = `${Math.floor(pos[i * 3] / cell)},${Math.floor(pos[i * 3 + 1] / cell)},${Math.floor(pos[i * 3 + 2] / cell)},${Math.round(nor[i * 3] * 1.5)},${Math.round(nor[i * 3 + 1] * 1.5)},${Math.round(nor[i * 3 + 2] * 1.5)}`;
    const r = rep.get(k);
    if (r === undefined) { rep.set(k, i); to[i] = i; } else to[i] = r;
  }
  const out: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = to[idx[t]], b = to[idx[t + 1]], c = to[idx[t + 2]];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  return out;
}

/** The spots the camera can be out in the new areas: a 6 m grid over [x0, x1] × [z0, z1], at camera D's height and higher. */
export function farEyes(x0: number, x1: number, z0: number, z1: number, heights = [2.2, 4.5]): number[][] {
  const out: number[][] = [];
  for (let x = x1; x >= x0; x -= 6) for (let z = z0; z <= z1; z += 6) for (const y of heights) out.push([x, y, z]);
  return out;
}
