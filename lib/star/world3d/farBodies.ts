/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FAR PEOPLE COST LESS (the compound, 28 Nov 2026: a body is ~15-21k triangles; seven of them on screen
 * were 138k of a 144k frame, so the 90k phone budget could not hold with people on the pitch).
 *
 * Each skinned body gets a second, coarse set of triangles in the SAME buffer, made by vertex clustering:
 * every vertex snaps to the first vertex in its little cube (about 4 cm) that hangs off the same main bone,
 * and triangles that collapse are dropped. No vertex is new or moved, so the skinning, the clothes'
 * colours and the clips are untouched; vertices only merge with others on the same bone, so a hand can
 * never be welded to a thigh. A person farther than `far` metres from the camera draws the coarse range
 * (set per person just before he is drawn: the geometry is shared between clones, its draw range is not
 * left set). Nothing is loaded or rebuilt as he walks: it only changes which part of a buffer is drawn.
 * Pure geometry maths + three's own hooks; off with ?farbodies=0.
 */

/** The coarse triangles for one geometry: an index list into the same vertices. */
export function clusterTriangles(
  pos: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number },
  index: ArrayLike<number> | null,
  cell: number,
  bone?: (i: number) => number,
  /** The texture's island a vertex is on (its uv, coarsely): vertices on two sides of a seam never merge,
   *  or the shirt's picture smears across the cut (seen 28 Nov: dark streaks on far shirts). */
  uv?: { getX(i: number): number; getY(i: number): number },
  /** How finely the texture is split (cells per 1 of uv): finer keeps the kit's colours clean, coarser cuts more. */
  uvCells = 20,
  /** Filled with each kept corner's own (original) vertex, alongside the returned stand-in vertices. */
  origOut?: number[],
): number[] {
  const rep = new Int32Array(pos.count);
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.floor(pos.getX(i) / cell)},${Math.floor(pos.getY(i) / cell)},${Math.floor(pos.getZ(i) / cell)},${bone ? bone(i) : 0}${uv ? `,${Math.floor(uv.getX(i) * uvCells)},${Math.floor(uv.getY(i) * uvCells)}` : ""}`;
    const r = seen.get(k);
    if (r === undefined) { seen.set(k, i); rep[i] = i; } else rep[i] = r;
  }
  const n = index ? index.length : pos.count;
  const at = (k: number) => (index ? index[k] : k);
  const out: number[] = [];
  const tris = new Set<string>();
  for (let t = 0; t + 2 < n; t += 3) {
    const oa = at(t), ob = at(t + 1), oc = at(t + 2);
    const a = rep[oa], b = rep[ob], c = rep[oc];
    if (a === b || b === c || a === c) continue;
    // the same triangle once (whichever way round it was listed, keeping the first winding)
    const s = [a, b, c].sort((x, y) => x - y).join(",");
    if (tris.has(s)) continue;
    tris.add(s);
    out.push(a, b, c);
    origOut?.push(oa, ob, oc);
  }
  return out;
}

export function farBodiesOff(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("farbodies") === "0"; } catch { return false; }
}

/** The main bone of each vertex (the largest skin weight). */
function mainBone(g: any): ((i: number) => number) | undefined {
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  if (!si || !sw) return undefined;
  return (i: number) => {
    let best = 0;
    for (let c = 1; c < 4; c++) if (sw.getComponent(i, c) > sw.getComponent(i, best)) best = c;
    return si.getComponent(i, best);
  };
}

const prepared = new WeakMap<any, { full: number; far: number } | null>();

/** Give a geometry its coarse range (once per geometry, shared by every clone). */
function prepare(T: any, g: any, cellOfHeight: number): { full: number; far: number } | null {
  if (prepared.has(g)) return prepared.get(g)!;
  const pos = g.attributes.position;
  if (!pos || pos.count < 300) { prepared.set(g, null); return null; }
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  const h = Math.max(bb.max.y - bb.min.y, bb.max.x - bb.min.x, bb.max.z - bb.min.z) || 1;
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
  const fullCount = idx ? idx.length : pos.count;
  // Each coarse corner is a NEW vertex: the stand-in's place, normal and skin, but its OWN texture point. With
  // index-only clustering a corner took the stand-in's texture point too, and the kit (painted into the body's
  // picture) smeared: green and dark blotches on far shirts (28 Nov). Island seams still never merge (uv key).
  const orig: number[] = [];
  const cell = h / cellOfHeight;
  // no texture key any more (each corner keeps its own texture point); the bone key keeps limbs apart
  const far = clusterTriangles(pos, idx, cell, mainBone(g), undefined, 20, orig);
  if (far.length > fullCount * 0.7) { prepared.set(g, null); return null; } // not worth a second range
  const names = Object.keys(g.attributes);
  const morph = g.morphAttributes ?? {};
  const all0 = [...names.map((k) => g.attributes[k]), ...(Object.values(morph).flat() as any[])];
  if (all0.some((x: any) => x.isInterleavedBufferAttribute)) { console.warn("farBodies: interleaved, skipped"); prepared.set(g, null); return null; }
  const n0 = pos.count, m = far.length;
  /** A copy of `a` with the m new corners on the end (texture points from each corner's own vertex). */
  const grow = (a: any, own: boolean) => {
    const sz = a.itemSize;
    const Arr = a.array.constructor as any;
    const arr = new Arr((n0 + m) * sz);
    arr.set(a.array, 0);
    for (let j = 0; j < m; j++) { const src = own ? orig[j] : far[j]; for (let c = 0; c < sz; c++) arr[(n0 + j) * sz + c] = a.array[src * sz + c]; }
    const out = new T.BufferAttribute(arr, sz, a.normalized);
    out.name = a.name;
    return out;
  };
  for (const k of names) g.setAttribute(k, grow(g.attributes[k], k.startsWith("uv")));
  // every corner in one little cube stands at the cube's MEAN point, whichever bone it hangs off: two stand-ins in
  // one cube (a shoulder's arm side and its chest side) meet exactly, so the coarse body has no cracks (the cracks
  // showed the grass and the inside of the body through the shirt: "green and dark blotches", 28 Nov)
  {
    const sum = new Map<string, [number, number, number, number]>();
    const key = (i: number) => `${Math.floor(pos.getX(i) / cell)},${Math.floor(pos.getY(i) / cell)},${Math.floor(pos.getZ(i) / cell)}`;
    for (let i = 0; i < n0; i++) { const k = key(i); const e = sum.get(k) ?? [0, 0, 0, 0]; e[0] += pos.getX(i); e[1] += pos.getY(i); e[2] += pos.getZ(i); e[3]++; sum.set(k, e); }
    const P = g.attributes.position;
    for (let j = 0; j < m; j++) { const e = sum.get(key(far[j]))!; P.setXYZ(n0 + j, e[0] / e[3], e[1] / e[3], e[2] / e[3]); }
    P.needsUpdate = true;
  }
  for (const k of Object.keys(morph)) morph[k] = morph[k].map((x: any) => grow(x, false));
  const all = new Uint32Array(fullCount + m);
  if (idx) all.set(idx as any, 0); else for (let i = 0; i < fullCount; i++) all[i] = i;
  for (let j = 0; j < m; j++) all[fullCount + j] = n0 + j;
  g.setIndex(new T.BufferAttribute(all, 1));
  g.setDrawRange(0, fullCount);
  const r = { full: fullCount, far: far.length };
  prepared.set(g, r);
  return r;
}

export interface FarBodies {
  /** Each frame: who is far now (`camPos`: the camera, world space). */
  update(camPos: { x: number; y: number; z: number }): void;
  /** Triangles of the full and far ranges, summed over the people (for the report). */
  stats(): { people: number; meshes: number; full: number; far: number; farNow: number };
}

/**
 * Hook every mesh of each root (the skinned body, its cloth, its hair). `far`: metres from the camera
 * beyond which a person draws the coarse range. `cellOfHeight`: the cube is the mesh's height / this.
 */
export function farBodies(T: any, roots: { root: any; where: () => [number, number] }[], o: { far: number; cellOfHeight?: number }): FarBodies {
  const people = roots.map((r) => ({ ...r, isFar: false, meshes: [] as { m: any; r: { full: number; far: number } }[] }));
  let full = 0, farT = 0, meshes = 0;
  if (!farBodiesOff()) for (const p of people) {
    p.root.traverse((m: any) => {
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const r = prepare(T, m.geometry, o.cellOfHeight ?? 46);
      if (!r) return;
      p.meshes.push({ m, r });
      meshes++; full += r.full / 3; farT += r.far / 3;
      const set = () => { const g = m.geometry; if (p.isFar) g.setDrawRange(r.full, r.far); else g.setDrawRange(0, r.full); };
      const prevB = m.onBeforeRender, prevS = m.onBeforeShadow;
      m.onBeforeRender = function (...a: any[]) { set(); return prevB?.apply(this, a); };
      m.onBeforeShadow = function (...a: any[]) { set(); return prevS?.apply(this, a); };
    });
  }
  return {
    update(c) {
      for (const p of people) { const [x, z] = p.where(); p.isFar = Math.hypot(x - c.x, z - c.z) > o.far; }
    },
    stats: () => ({ people: people.length, meshes, full: Math.round(full), far: Math.round(farT), farNow: people.filter((p) => p.isFar).length }),
  };
}
