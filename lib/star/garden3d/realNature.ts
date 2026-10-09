/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GARDEN'S REAL NATURE (Settings → Look → "3D look: H"; Old keeps today's
 * garden). Harry, 9 Oct 2026: "look at the trees, the hay, the back of the
 * player, the flowers" — the garden scored 3 against his benchmark picture.
 *
 *   trees    a bark trunk and branches, and a crown of ~110 leaf cards cut
 *            from real scanned leaves (Poly Haven island_tree_02, CC0); pines
 *            get real fir twigs (fir_tree_01, CC0). Each tree takes the size of
 *            the Kenney tree it replaces, so every placement stays put.
 *   hay      a round bale with soft shoulders in real straw (ambientCG, CC0)
 *   flowers  hydrangea bushes: leaf cards and flower heads (ours)
 *   paving   real square pavers (Poly Haven concrete_pavers_02, CC0)
 *
 * The maps (≈380 KB, public/star/garden3d/h, made by tools/garden3d/h_nature.py)
 * are fetched only in look H. Cards are alpha-tested (no sorting), instanced,
 * and their light comes from the crown's middle so a crown reads round, not
 * as a pile of flat planes.
 */
export const NATURE_BASE = "/star/garden3d/h/";

export interface NatureMaps { leaves: any; needles: any; bark: any; barkN: any; paving: any; pavingN: any; straw: any; strawN: any; blooms: any; tuft: any }

export async function loadRealNature(T: any, renderer: any): Promise<NatureMaps> {
  const an = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const load = (f: string, srgb = true, repeat = true) => new Promise<any>((res, rej) => {
    new T.TextureLoader().load(NATURE_BASE + f, (t: any) => {
      t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = an;
      res(t);
    }, undefined, rej);
  });
  const [leaves, needles, bark, barkN, paving, pavingN, straw, strawN, blooms, tuft] = await Promise.all([
    load("leaves.webp", true, false), load("needles.webp", true, false), load("bark.webp"), load("bark-nrm.webp", false),
    load("paving.webp"), load("paving-nrm.webp", false), load("straw.webp"), load("straw-nrm.webp", false), load("blooms.webp", true, false), load("tuft.webp", true, false),
  ]);
  return { leaves, needles, bark, barkN, paving, pavingN, straw, strawN, blooms, tuft };
}

/** A tiny seeded random. */
function rand(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** A card (two triangles) whose light comes from `nrm`, appended to the arrays. */
function card(T: any, out: { p: number[]; n: number[]; uv: number[]; c: number[]; i: number[] }, centre: any, right: any, up: any, nrm: any, shade: number, uv: [number, number, number, number] = [0, 0, 1, 1]) {
  const base = out.p.length / 3;
  const [u0, v0, u1, v1] = uv;
  const corners: [number, number, number, number][] = [[-1, 0, u0, v0], [1, 0, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
  for (const [sx, sy, u, v] of corners) {
    const x = centre.x + right.x * sx + up.x * sy, y = centre.y + right.y * sx + up.y * sy, z = centre.z + right.z * sx + up.z * sy;
    out.p.push(x, y, z);
    out.n.push(nrm.x, nrm.y, nrm.z);
    out.uv.push(u, v);
    out.c.push(shade, shade, shade);
  }
  out.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function geomFrom(T: any, a: { p: number[]; n: number[]; uv: number[]; c: number[]; i: number[] }) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(a.p, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(a.n, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(a.uv, 2));
  g.setAttribute("color", new T.Float32BufferAttribute(a.c, 3));
  g.setIndex(a.i);
  g.computeBoundingSphere();
  return g;
}

const leafMats = new WeakMap<any, Map<string, any>>();
/** The card material for a map and a tint (shared). Alpha-tested; its shadow cut out by the same map. */
export function cardMaterial(T: any, map: any, tint: string) {
  let m = leafMats.get(map);
  if (!m) { m = new Map(); leafMats.set(map, m); }
  let mat = m.get(tint);
  if (!mat) {
    mat = new T.MeshStandardMaterial({ map, color: tint, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.82, metalness: 0, vertexColors: true });
    mat.userData.depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map, alphaTest: 0.3 });
    mat.userData.distance = new T.MeshDistanceMaterial({ map, alphaTest: 0.3 });
    m.set(tint, mat);
  }
  return mat;
}

export interface TreePart { geometry: any; material: any }

/**
 * A tree, `h` metres tall and `w` wide in its own units (the Kenney tree's
 * box). `pine`: a cone of fir sprays; else a round broadleaf crown.
 */
export function makeTree(T: any, maps: NatureMaps, o: { h: number; w: number; pine: boolean; seed: number; tint?: string }): TreePart[] {
  const r = rand(o.seed);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const H = o.h, W = o.w;
  // ── trunk and branches: tapered cylinders, bark wrapped round ──
  const barkMat = new T.MeshStandardMaterial({ map: maps.bark, normalMap: maps.barkN, normalScale: new T.Vector2(1.2, 1.2), color: "#d6cfc6", roughness: 0.95 });
  const limbs: any[] = [];
  const limb = (from: any, to: any, r0: number, r1: number) => {
    const len = from.distanceTo(to);
    const g = new T.CylinderGeometry(r1, r0, len, 9, 1, true);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, r0 * 14), uv.getY(i) * len * 2.2);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate(from.x, from.y, from.z);
    limbs.push(g);
  };
  const trunkTop = o.pine ? H * 0.92 : H * (0.42 + r() * 0.08);
  const tr = W * (o.pine ? 0.035 : 0.05);
  const lean = V((r() - 0.5) * W * 0.06, trunkTop, (r() - 0.5) * W * 0.06);
  limb(V(0, -0.05 * H, 0), lean, tr, tr * 0.62);
  if (!o.pine) {
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + r() * 0.8;
      const from = lean.clone().multiplyScalar(0.82 + r() * 0.15);
      const to = V(Math.cos(a) * W * (0.22 + r() * 0.12), trunkTop + H * (0.14 + r() * 0.16), Math.sin(a) * W * (0.22 + r() * 0.12));
      limb(from, to, tr * 0.45, tr * 0.18);
    }
  }
  const merged = mergeAll(T, limbs);
  // ── crown: cards facing every way, lit from the crown's middle ──
  const a = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] };
  const n = o.pine ? 150 : 210;
  const cy = o.pine ? H * 0.5 : trunkTop + (H - trunkTop) * 0.5;
  const ry = o.pine ? H * 0.48 : (H - trunkTop) * 0.55;
  const rx = W * 0.5;
  const size = o.pine ? W * 0.26 : W * 0.27;
  for (let k = 0; k < n; k++) {
    // a point in the crown, more of them near the surface
    let d: any, y: number;
    if (o.pine) {
      y = H * 0.12 + r() * H * 0.86;
      const rad = rx * (1 - (y - H * 0.12) / (H * 0.9)) * (0.55 + 0.45 * Math.sqrt(r()));
      const ang = r() * Math.PI * 2;
      d = V(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    } else {
      const u = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      if (u.lengthSq() > 1 || u.lengthSq() < 0.05) { k--; continue; }
      u.normalize().multiplyScalar(0.45 + 0.55 * Math.cbrt(r()));
      d = V(u.x * rx, cy + u.y * ry, u.z * rx);
    }
    const out = V(d.x, (d.y - cy) * (o.pine ? 0.4 : 1) + (o.pine ? 0.25 : 0.35) * ry, d.z).normalize();
    // the spray hangs from its twig: up roughly out and up, turned at random
    const upDir = out.clone().multiplyScalar(0.7).add(V((r() - 0.5) * 0.9, 0.5 + r() * 0.4, (r() - 0.5) * 0.9)).normalize();
    const side = V(r() - 0.5, r() - 0.5, r() - 0.5).cross(upDir).normalize();
    const s = size * (0.8 + r() * 0.45);
    const centre = d.clone().addScaledVector(upDir, -s * 0.5);
    // inner cards darker (light hardly gets in)
    const depth = o.pine ? Math.hypot(d.x, d.z) / Math.max(1e-3, rx * (1 - (d.y - H * 0.12) / (H * 0.9))) : d.clone().setY((d.y - cy) * rx / ry).length() / rx;
    const shade = 0.62 + 0.4 * Math.min(1, depth) + (d.y - cy) / H * 0.25;
    card(T, a, centre, side.multiplyScalar(s * 0.5), upDir.multiplyScalar(s), out, Math.min(1.1, shade));
  }
  const leafGeo = geomFrom(T, a);
  const leafMat = cardMaterial(T, o.pine ? maps.needles : maps.leaves, o.tint ?? (o.pine ? "#b4d0a4" : "#c6e09a"));
  barkMat.userData.isBark = true;
  return [{ geometry: merged, material: barkMat }, { geometry: leafGeo, material: leafMat }];
}

function mergeAll(T: any, geos: any[]) {
  // a tiny merge (positions, normals, uvs; all non-indexed)
  const p: number[] = [], nn: number[] = [], uv: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    p.push(...g.attributes.position.array); nn.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nn, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** A round hay bale (radius r, width w): flat-ish ends with soft rounded shoulders, real straw round it. */
export function makeBale(T: any, maps: NatureMaps, r = 0.55, w = 1.1) {
  const pts: any[] = [];
  const sh = 0.12;
  pts.push(new T.Vector2(0.001, -w / 2));
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new T.Vector2(r - sh + Math.sin(a) * sh, -w / 2 + sh - Math.cos(a) * sh)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new T.Vector2(r - sh + Math.cos(a) * sh, w / 2 - sh + Math.sin(a) * sh)); }
  pts.push(new T.Vector2(0.001, w / 2));
  const g = new T.LatheGeometry(pts, 40);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2.2);
  const straw = maps.straw.clone(); straw.needsUpdate = true;
  const m = new T.MeshStandardMaterial({ map: straw, normalMap: maps.strawN, normalScale: new T.Vector2(1.4, 1.4), color: "#f2dc9a", roughness: 1 });
  return new T.Mesh(g, m);
}

/**
 * Hydrangea bushes along a bed: per plant, a mound of leaf cards and three to
 * five flower heads on top. Returns two instanced meshes' worth of geometry as
 * one mesh each (leaves, heads) for the whole bed list.
 */
export function makeFlowerBeds(T: any, maps: NatureMaps, beds: [number, number, number][], seed: number) {
  const r = rand(seed);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const L = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] };
  const F = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] };
  for (const [x, zc, len] of beds) {
    const plants = Math.max(2, Math.round(len / 0.62));
    for (let k = 0; k < plants; k++) {
      const pz = zc - len / 2 + (k + 0.5) * (len / plants) + (r() - 0.5) * 0.12;
      const px = x + (r() - 0.5) * 0.16;
      const R = 0.3 + r() * 0.08;
      const colour = Math.floor(r() * 3);
      for (let q = 0; q < 16; q++) {
        const a = r() * Math.PI * 2;
        const out = V(Math.cos(a), 0.6 + r() * 0.5, Math.sin(a)).normalize();
        const d = V(px + out.x * R * 0.6, 0.12 + out.y * R * 0.55, pz + out.z * R * 0.6);
        const upDir = out.clone().add(V(0, 0.6, 0)).normalize();
        const side = V(r() - 0.5, 0, r() - 0.5).cross(upDir).normalize();
        const s = 0.26 + r() * 0.1;
        card(T, L, d.clone().addScaledVector(upDir, -s * 0.45), side.multiplyScalar(s * 0.5), upDir.multiplyScalar(s), out, 0.8 + r() * 0.25);
      }
      const heads = 5 + Math.floor(r() * 3);
      for (let q = 0; q < heads; q++) {
        const a = r() * Math.PI * 2, rr = r() * R * 0.55;
        const c = V(px + Math.cos(a) * rr, 0.4 + r() * 0.12, pz + Math.sin(a) * rr);
        const s = 0.2 + r() * 0.06;
        const u0 = colour / 3, u1 = (colour + 1) / 3;
        // two crossed cards: a round head from any side
        for (const turn of [0, Math.PI / 2]) {
          const t2 = r() * Math.PI + turn;
          card(T, F, c.clone().add(V(0, -s * 0.5, 0)), V(Math.cos(t2) * s * 0.5, 0, Math.sin(t2) * s * 0.5), V(0, s, 0), V(Math.cos(a), 0.8, Math.sin(a)).normalize(), 0.92 + r() * 0.1, [u0, 0, u1, 1]);
        }
      }
    }
  }
  const leaves = new T.Mesh(geomFrom(T, L), cardMaterial(T, maps.leaves, "#a9cf86"));
  const heads = new T.Mesh(geomFrom(T, F), new T.MeshStandardMaterial({ map: maps.blooms, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.7, vertexColors: true }));
  return { leaves, heads };
}

let contactT: any = null;
/** A soft dark disc (the shade where a thing meets the ground). */
function contactTex(T: any) {
  if (contactT) return contactT;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64);
  gr.addColorStop(0, "rgb(216,216,216)"); gr.addColorStop(0.5, "rgb(100,100,100)"); gr.addColorStop(1, "rgb(0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  contactT = new T.CanvasTexture(c);
  return contactT;
}

/**
 * Where things meet the ground: a soft dark ring under each (`spots`: x, z,
 * radius: trees, bushes, bales), and long-grass tufts round their feet and
 * along the inside of the boundary (`edge`: half the lawn's width). One mesh each.
 */
export function makeGroundDetail(T: any, maps: NatureMaps, spots: [number, number, number][], edge: number, seed: number) {
  const r = rand(seed);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const C = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] };
  const G = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] };
  const up = V(0, 1, 0);
  const tuftAt = (x: number, z: number, s: number) => {
    for (const turn of [0, Math.PI / 2]) {
      const a = r() * Math.PI + turn;
      card(T, G, V(x, 0, z), V(Math.cos(a) * s * 0.5, 0, Math.sin(a) * s * 0.5), V(0, s * 0.8, 0), up, 0.75 + r() * 0.3);
    }
  };
  for (const [x, z, rad] of spots) {
    const R = rad * 1.7;
    card(T, C, V(x, 0.02, z - R), V(R, 0, 0), V(0, 0, 2 * R), up, 1);
    const n = 4 + Math.floor(rad * 6);
    for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, d = rad * (0.7 + r() * 0.5); tuftAt(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.35 + r() * 0.3); }
  }
  for (let k = 0; k < 220; k++) {
    const side = Math.floor(r() * 4), t = (r() * 2 - 1) * edge, inset = edge - 0.25 - r() * 0.5;
    const [x, z] = side === 0 ? [t, -inset] : side === 1 ? [t, inset] : side === 2 ? [-inset, t] : [inset, t];
    tuftAt(x, z, 0.3 + r() * 0.35);
  }
  const contacts = new T.Mesh(geomFrom(T, C), new T.MeshBasicMaterial({ color: "#000000", alphaMap: contactTex(T), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  contacts.renderOrder = 1;
  const tufts = new T.Mesh(geomFrom(T, G), cardMaterial(T, maps.tuft, "#c8d8a8"));
  tufts.receiveShadow = true;
  return { contacts, tufts };
}
