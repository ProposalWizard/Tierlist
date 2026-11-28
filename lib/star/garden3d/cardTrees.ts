/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE TEXTURED TREES, MADE CHEAP (28 Nov 2026). Harry on the low-poly try: "nah the textured trees
 * so much better". So the garden keeps the scanned-leaf look of ./realNature.ts makeTree (a bark
 * trunk with branches, a crown of leaf sprays lit from the crown's middle, the "living green"
 * light through the leaves), built so it costs far less:
 *
 *   - ONE picture for everything (tools/garden3d/tree_atlas.py: leaves, fir sprays and bark side by
 *     side), so every tree and bush of a zone is one material and one draw (./plantZones.ts);
 *   - cut-out leaves (alpha TEST: depth-writing, no sorting, nothing blended);
 *   - fewer, larger sprays: CARDS per detail level below, each spray grown so the crown is as full
 *     as the old 340-spray one (same outline, same density at phone size);
 *   - three detail levels by distance and quality tier (200 / 90 / 40 sprays a broadleaf, on Low
 *     always the 40: the old tree was 340 at every distance);
 *
 * Sizes: a tree is `h` tall and `w` wide in the Kenney tree's own units (as before), so every
 * placement stays where and how big it was.
 */
import type { Lod } from "./lowPolyTrees";

export const ATLAS = "/star/garden3d/h/trees-atlas.webp";
export const ATLAS_NRM = "/star/garden3d/h/trees-atlas-nrm.webp";
/** Where each picture sits in the atlas (u0, v0, u1, v1; v up), with a hair of margin. */
const R_LEAVES: [number, number, number, number] = [0.002, 0.002, 0.498, 0.998];
const R_NEEDLES: [number, number, number, number] = [0.501, 0.501, 0.749, 0.998];
const R_BARK: [number, number, number, number] = [0.752, 0.002, 0.998, 0.998];

/** Sprays per crown at each detail level (the old tree: 340 broadleaf, 200 fir, at level 0 only). */
export const CARDS: Record<"broad" | "pine", [number, number, number]> = {
  broad: [200, 90, 40],
  pine: [120, 60, 26],
};
const OLD = { broad: 340, pine: 200 };

export interface CardBin { p: number[]; n: number[]; uv: number[]; c: number[] }
export const newCardBin = (): CardBin => ({ p: [], n: [], uv: [], c: [] });

function rand(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const linRGB = (T: any, hex: string) => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };

/** One spray card: two triangles, its light from `nrm`, colour = tint × shade. */
function card(out: CardBin, centre: any, right: any, up: any, nrm: any, col: number[], shade: number, r: [number, number, number, number]) {
  const [u0, v0, u1, v1] = r;
  const pts: [number, number, number, number][] = [[-1, 0, u0, v0], [1, 0, u1, v0], [1, 1, u1, v1], [-1, 0, u0, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
  for (const [sx, sy, u, v] of pts) {
    out.p.push(centre.x + right.x * sx + up.x * sy, centre.y + right.y * sx + up.y * sy, centre.z + right.z * sx + up.z * sy);
    out.n.push(nrm.x, nrm.y, nrm.z);
    out.uv.push(u, v);
    out.c.push(col[0] * shade, col[1] * shade, col[2] * shade);
  }
}

/** A tapered limb from `a` to `b`, the bark strip wrapped once round it and run once along it. */
function limb(T: any, out: CardBin, a: any, b: any, r0: number, r1: number, sides: number, col: number[]) {
  const d = b.clone().sub(a); const L = d.length() || 1; const w = d.clone().divideScalar(L);
  const ref = Math.abs(w.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
  const u = new T.Vector3().crossVectors(w, ref).normalize(), v = new T.Vector3().crossVectors(w, u);
  const [U0, V0, U1, V1] = R_BARK;
  // the bark's own scale: about one strip (two tiles) per 2.2 trunk-lengths of the old repeat
  const vSpan = Math.min(1, L * 1.1);
  const ring = (c: any, r: number, k: number) => { const t = (k / sides) * Math.PI * 2; const n = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)); return { p: c.clone().addScaledVector(n, r), n }; };
  for (let k = 0; k < sides; k++) {
    const p0 = ring(a, r0, k), p1 = ring(a, r0, k + 1), q0 = ring(b, r1, k), q1 = ring(b, r1, k + 1);
    const ua = U0 + (U1 - U0) * (k / sides), ub = U0 + (U1 - U0) * ((k + 1) / sides), va = V0, vb = V0 + (V1 - V0) * vSpan;
    for (const [P, uu, vv] of [[p0, ua, va], [q1, ub, vb], [q0, ua, vb], [p0, ua, va], [p1, ub, va], [q1, ub, vb]] as [any, number, number][]) {
      out.p.push(P.p.x, P.p.y, P.p.z); out.n.push(P.n.x, P.n.y, P.n.z); out.uv.push(uu, vv); out.c.push(col[0], col[1], col[2]);
    }
  }
}

/**
 * One textured tree into `out` at the origin, `h` tall and `w` wide: makeTree's shape (realNature.ts),
 * with `CARDS[kind][lod]` sprays grown so the crown covers what 340 (or 200) did. Returns its triangles.
 */
export function addCardTree(T: any, out: CardBin, o: { h: number; w: number; pine: boolean; seed: number; tint?: string; lod: Lod; cards?: number }): number {
  const before = out.p.length / 9;
  const r = rand(o.seed);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const H = o.h, W = o.w;
  const bark = linRGB(T, "#d6cfc6");
  const trunkTop = o.pine ? H * 0.92 : H * (0.42 + r() * 0.08);
  const tr = W * (o.pine ? 0.035 : 0.05);
  const lean = V((r() - 0.5) * W * 0.06, trunkTop, (r() - 0.5) * W * 0.06);
  const sides = o.lod === 0 ? 9 : o.lod === 1 ? 6 : 4;
  limb(T, out, V(0, -0.05 * H, 0), lean, tr, tr * 0.62, sides, bark);
  // the same random numbers as the old tree, whatever the level, so the crown sits the same
  const branches: [any, any][] = [];
  if (!o.pine) {
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + r() * 0.8;
      const from = lean.clone().multiplyScalar(0.82 + r() * 0.15);
      const to = V(Math.cos(a) * W * (0.22 + r() * 0.12), trunkTop + H * (0.14 + r() * 0.16), Math.sin(a) * W * (0.22 + r() * 0.12));
      branches.push([from, to]);
    }
    if (o.lod === 0) for (const [from, to] of branches) limb(T, out, from, to, tr * 0.45, tr * 0.18, 5, bark);
    else if (o.lod === 1) for (const [from, to] of branches.slice(0, 3)) limb(T, out, from, to, tr * 0.45, tr * 0.18, 3, bark);
  }
  const kind = o.pine ? "pine" : "broad";
  const n = o.cards ?? CARDS[kind][o.lod];
  // same cover as the old crown: each spray's area grows by old/new (so its side by the square root)
  const grow = Math.sqrt(OLD[kind] / n);
  const cy = o.pine ? H * 0.5 : trunkTop + (H - trunkTop) * 0.5;
  const ry = o.pine ? H * 0.48 : (H - trunkTop) * 0.55;
  const rx = W * 0.5;
  const size = (o.pine ? W * 0.27 : W * 0.29) * grow;
  const tint = linRGB(T, o.tint ?? (o.pine ? "#b4d0a4" : "#c6e09a"));
  const region = o.pine ? R_NEEDLES : R_LEAVES;
  for (let k = 0; k < n; k++) {
    let d: any;
    if (o.pine) {
      const y = H * 0.12 + r() * H * 0.86;
      const rad = rx * (1 - (y - H * 0.12) / (H * 0.9)) * (0.55 + 0.45 * Math.sqrt(r()));
      const ang = r() * Math.PI * 2;
      d = V(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    } else {
      const u = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      if (u.lengthSq() > 1 || u.lengthSq() < 0.05) { k--; continue; }
      // bigger sprays sit a little further in, so the crown's outline stays the old one
      u.normalize().multiplyScalar((0.45 + 0.55 * Math.cbrt(r())) * (1 - 0.12 * (grow - 1) / grow));
      d = V(u.x * rx, cy + u.y * ry, u.z * rx);
    }
    const outN = V(d.x, (d.y - cy) * (o.pine ? 0.4 : 1) + (o.pine ? 0.25 : 0.35) * ry, d.z).normalize();
    const upDir = outN.clone().multiplyScalar(0.7).add(V((r() - 0.5) * 0.9, 0.5 + r() * 0.4, (r() - 0.5) * 0.9)).normalize();
    const side = V(r() - 0.5, r() - 0.5, r() - 0.5).cross(upDir).normalize();
    const s = size * (0.8 + r() * 0.45);
    const centre = d.clone().addScaledVector(upDir, -s * 0.5);
    const depth = o.pine ? Math.hypot(d.x, d.z) / Math.max(1e-3, rx * (1 - (d.y - H * 0.12) / (H * 0.9))) : d.clone().setY((d.y - cy) * rx / ry).length() / rx;
    const shade = Math.min(1.1, 0.7 + 0.34 * Math.min(1, depth) + (d.y - cy) / H * 0.25);
    card(out, centre, side.multiplyScalar(s * 0.5), upDir.multiplyScalar(s), outN, tint, shade, region);
  }
  return out.p.length / 9 - before;
}

/** A bush: a low mound of leaf sprays (the same leaves as the trees), `s` round at (x, z). */
export function addCardBush(T: any, out: CardBin, o: { x: number; z: number; s: number; seed: number; lod: Lod; tint?: string }) {
  const r = rand(o.seed);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const tint = linRGB(T, o.tint ?? "#a9cf86");
  const n = [36, 18, 8][o.lod];
  const grow = Math.sqrt(36 / n);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2;
    const outN = V(Math.cos(a), 0.5 + r() * 0.6, Math.sin(a)).normalize();
    const d = V(o.x + outN.x * o.s * 0.55, outN.y * o.s * 0.62, o.z + outN.z * o.s * 0.55);
    const upDir = outN.clone().add(V(0, 0.6, 0)).normalize();
    const side = V(r() - 0.5, 0, r() - 0.5).cross(upDir).normalize();
    const s = o.s * (0.62 + r() * 0.2) * grow;
    card(out, d.clone().addScaledVector(upDir, -s * 0.45), side.multiplyScalar(s * 0.5), upDir.multiplyScalar(s), outN, tint, 0.78 + r() * 0.28, R_LEAVES);
  }
}

/** Move what was added since `from` (in triangles): scale `s`, turn `ry`, then put at (x, y, z). */
export function placeCardsSince(out: CardBin, from: number, x: number, y: number, z: number, s: number, ry: number) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (let i = from * 9; i < out.p.length; i += 3) {
    const px = out.p[i] * s, py = out.p[i + 1] * s, pz = out.p[i + 2] * s;
    out.p[i] = px * c + pz * sn + x; out.p[i + 1] = py + y; out.p[i + 2] = -px * sn + pz * c + z;
    const nx = out.n[i], nz = out.n[i + 2];
    out.n[i] = nx * c + nz * sn; out.n[i + 2] = -nx * sn + nz * c;
  }
}

export function cardGeometry(T: any, b: CardBin) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(b.p, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(b.n, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(b.uv, 2));
  g.setAttribute("color", new T.Float32BufferAttribute(b.c, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * The ONE material of every textured tree and bush: the atlas, cut-out (alpha test), both sides,
 * vertex colours (tint × shade), the bark's bumps from the atlas normal picture, and the old
 * foliage light on the leaves only (realNature.ts foliageLight: a living green, light through the
 * leaf on the shaded side). Its shadow is cut out by the same picture.
 */
export function cardMaterial(T: any, map: any, nrm: any | null) {
  const m = new T.MeshStandardMaterial({ map, normalMap: nrm ?? null, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.84, metalness: 0, vertexColors: true });
  if (nrm) m.normalScale = new T.Vector2(1.2, 1.2);
  m.onBeforeCompile = (sh: any) => {
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <map_fragment>", `#include <map_fragment>
  float leafy = step(vMapUv.x, 0.75); // the bark strip is u > 0.75
  {
    float fl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 fg = diffuseColor.rgb * vec3(0.86, 1.04, 0.8);
    diffuseColor.rgb = mix(diffuseColor.rgb, max(mix(vec3(fl), fg, 1.25), vec3(0.0)), leafy);
  }`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
  {
    float back = 1.0 - clamp(dot(reflectedLight.directDiffuse, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 1e-3), 0.0, 1.0);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.55, 0.75, 0.35) * (0.12 + 0.28 * back) * leafy;
  }`);
  };
  m.customProgramCacheKey = () => "garden-card-trees-v1";
  m.userData.keep = true;
  // no baked light (look/bakedLight.ts): the old instanced trees never really got it (the bake read each
  // instance at its own middle, open sky), so with it these read darker than the trees they replace
  m.userData.noBake = true;
  m.userData.depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map, alphaTest: 0.3, side: T.DoubleSide });
  m.userData.distance = new T.MeshDistanceMaterial({ map, alphaTest: 0.3, side: T.DoubleSide });
  return m;
}

/** Load the atlas (a packed .ktx2 twin when there is one, else the WebP). */
export async function loadCardAtlas(T: any, renderer: any): Promise<{ map: any; nrm: any }> {
  const { loadPicture3d, useKtx2With } = await import("../three3d/ktx2");
  if (renderer) useKtx2With(renderer);
  const an = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const load = (f: string, srgb: boolean) => loadPicture3d(f, () => new Promise<any>((res, rej) => new T.TextureLoader().load(f, res, undefined, rej))).then((t: any) => {
    t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    t.anisotropy = an;
    t.needsUpdate = true;
    return t;
  });
  const [map, nrm] = await Promise.all([load(ATLAS, true), load(ATLAS_NRM, false).catch(() => null)]);
  return { map, nrm };
}

/** Triangles of one tree at each level (for the budget test). */
export function cardTreeTriangles(T: any): { broad: number[]; pine: number[] } {
  return {
    broad: [0, 1, 2].map((lod) => addCardTree(T, newCardBin(), { h: 1.3, w: 0.75, pine: false, seed: 5, lod: lod as Lod })),
    pine: [0, 1, 2].map((lod) => addCardTree(T, newCardBin(), { h: 1.4, w: 0.7, pine: true, seed: 5, lod: lod as Lod })),
  };
}
