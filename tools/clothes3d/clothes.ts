/**
 * CLOTHES AS CLOTH (research proof, 20 Nov 2026; docs/research/clothes-and-necks-2026-11-20.md).
 * Builds real garments from the body we already have, at load, on any head:
 *   1. a garment is a region of the body cut by smooth fields (neck line, sleeve end, hem, leg end),
 *      measured in the rest pose; triangles are CUT along the field's zero line, so every edge
 *      (collar, cuff, hem) is a clean line on the mesh, never a painted gradient;
 *   2. that region is copied, pushed off the skin (a shell with its own thickness lip at each edge),
 *      skinned to the SAME skeleton with the body's own weights (so every clip fits);
 *   3. the body under it is deleted (a small margin kept under the edge, so no gap and no poke-through);
 *   4. a collar / cuff / rib band is real geometry; trim, panels, crest and number are drawn from
 *      distance fields and rest-pose position, so they are crisp at any size (no texture blobs).
 * Nothing in the game uses this yet.
 */
import type * as THREE from "three";

type Three = typeof import("three");
type V3 = [number, number, number];

export interface Rig {
  /** rest-pose joints (metres, the body's own frame; +z front) */
  j: (n: string) => V3;
  /** per bone index: which part it moves */
  part: string[];
}

export interface FieldsAt {
  neck: number; sleeve: number; hem: number; leg: number;
  /** any other cut (a panel seam: the sleeve's armhole, a side panel); no band is drawn from it */
  cut?: number;
}

export interface GarmentSpec {
  name: string;
  /** distance-like fields (metres, negative inside) for a rest point; each garment picks which count */
  fields: (p: THREE.Vector3, arm: number, armS: number, leg: number, legS: number, side: number) => FieldsAt;
  offset: number;                 // metres off the skin
  lip: number;                    // thickness shown at an open edge
  collar?: { h: number; out: number; fold?: number; color: string };
  material: THREE.Material;
  /** shell relax: point passes, normal passes */
  relax?: [number, number];
}

/** Bone index → "torso" | "neck" | "head" | "armL" | "armR" | "legL" | "legR" and the segment (u upper, f fore, h hand). */
export function rigOf(T: Three, body: THREE.SkinnedMesh, joints: Record<string, V3>): Rig {
  const part = body.skeleton.bones.map((b) => {
    const n = b.name;
    const side = /Left/i.test(n) ? "L" : /Right/i.test(n) ? "R" : "";
    if (/Hand|Thumb|Index|Middle|Ring|Pinky|Little/i.test(n)) return `arm${side}:h`;
    if (/ForeArm/i.test(n)) return `arm${side}:f`;
    if (/Arm/i.test(n)) return `arm${side}:u`;
    if (/Shoulder/i.test(n)) return "torso";
    if (/UpLeg/i.test(n)) return `leg${side}:u`;
    if (/Leg/i.test(n)) return `leg${side}:f`;
    if (/Foot|Toe/i.test(n)) return `leg${side}:h`;
    if (/Head/i.test(n)) return "head";
    if (/neck/i.test(n)) return "neck";
    return "torso";
  });
  void T;
  return { j: (n) => joints[n] ?? [0, 0, 0], part };
}

/** Where a point sits along a limb: 0 at the top joint, 1 at the middle joint, 2 at the end joint. */
function along(p: THREE.Vector3, a: V3, b: V3, c: V3): number {
  const seg = (s: V3, e: V3) => {
    const dx = e[0] - s[0], dy = e[1] - s[1], dz = e[2] - s[2];
    const L2 = dx * dx + dy * dy + dz * dz;
    const t = ((p.x - s[0]) * dx + (p.y - s[1]) * dy + (p.z - s[2]) * dz) / L2;
    const q = [s[0] + dx * Math.max(0, Math.min(1, t)), s[1] + dy * Math.max(0, Math.min(1, t)), s[2] + dz * Math.max(0, Math.min(1, t))];
    return { t, d: Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]) };
  };
  const u = seg(a, b), f = seg(b, c);
  return u.d <= f.d ? Math.min(u.t, 1) : 1 + Math.max(0, f.t);
}

export interface Built { meshes: THREE.SkinnedMesh[]; trimmedBody: THREE.BufferGeometry; stats: Record<string, number> }

/**
 * Cut, shell and bind. `garments` are drawn outermost last; the body keeps only what no garment covers.
 */
export function buildClothes(T: Three, body: THREE.SkinnedMesh, rig: Rig, garments: GarmentSpec[], outline: (w: number) => THREE.Material): Built {
  const g = body.geometry;
  const P = g.getAttribute("position"), N = g.getAttribute("normal"), UV = g.getAttribute("uv");
  const SI = g.getAttribute("skinIndex"), SW = g.getAttribute("skinWeight");
  const REST = (g.getAttribute("aRest") as THREE.BufferAttribute | undefined) ?? P;
  const idx = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: P.count }, (_, i) => i);
  const nV = P.count;

  // per vertex: rest point, arm/leg membership and where along the limb
  const rp = new T.Vector3();
  const L = (n: string) => rig.j(n);
  const armL = [L("LeftArm"), L("LeftForeArm"), L("LeftHand")] as const, armR = [L("RightArm"), L("RightForeArm"), L("RightHand")] as const;
  const legL = [L("LeftUpLeg"), L("LeftLeg"), L("LeftFoot")] as const, legR = [L("RightUpLeg"), L("RightLeg"), L("RightFoot")] as const;
  const vf: { arm: number; armS: number; leg: number; legS: number; side: number }[] = [];
  for (let i = 0; i < nV; i++) {
    rp.fromBufferAttribute(REST as THREE.BufferAttribute, i);
    let aL = 0, aR = 0, lL = 0, lR = 0;
    for (let k = 0; k < 4; k++) {
      const w = SW.getComponent(i, k); if (!w) continue;
      const pt = rig.part[SI.getComponent(i, k)] ?? "torso";
      if (pt.startsWith("armL")) aL += w; else if (pt.startsWith("armR")) aR += w;
      else if (pt.startsWith("legL")) lL += w; else if (pt.startsWith("legR")) lR += w;
    }
    const side = rp.x >= 0 ? 1 : -1;
    const armW = Math.max(aL, aR), legW = Math.max(lL, lR);
    const A = aL >= aR ? armL : armR, Lg = lL >= lR ? legL : legR;
    vf.push({ arm: armW, armS: armW > 0.02 ? along(rp, A[0], A[1], A[2]) : 0, leg: legW, legS: legW > 0.02 ? along(rp, Lg[0], Lg[1], Lg[2]) : 0, side });
  }

  const stats: Record<string, number> = { bodyTris: idx.length / 3 };
  const meshes: THREE.SkinnedMesh[] = [];
  const fieldOf = (gm: GarmentSpec, i: number) => {
    rp.fromBufferAttribute(REST as THREE.BufferAttribute, i);
    const v = vf[i];
    return gm.fields(rp, v.arm, v.armS, v.leg, v.legS, v.side);
  };
  const maxF = (f: FieldsAt) => Math.max(f.neck, f.sleeve, f.hem, f.leg, f.cut ?? -1);

  // a welded id per vertex (UV seams split vertices; the edges of a garment must not open at a seam)
  const weld = new Int32Array(nV);
  { const m = new Map<string, number>(); for (let i = 0; i < nV; i++) { const k = `${Math.round(P.getX(i) * 1000)},${Math.round(P.getY(i) * 1000)},${Math.round(P.getZ(i) * 1000)}`; const w = m.get(k); if (w === undefined) { m.set(k, i); weld[i] = i; } else weld[i] = w; } }

  /** Clip every triangle to the part where `keep(i) <= 0`, cutting edges at the zero line; returns a new geometry. */
  const clip = (val: Float32Array, extra?: (o: Out, i: number) => void, extraLerp?: (o: Out, a: number, b: number, t: number) => void) => {
    const out = new Out(T);
    const map = new Map<number, number>(), edgeMap = new Map<string, number>();
    const vert = (i: number) => { let o = map.get(i); if (o === undefined) { o = out.copy(P, N, UV, SI, SW, REST, i, weld[i]); extra?.(out, i); map.set(i, o); } return o; };
    const cut = (a: number, b: number) => {
      const [x, y] = weld[a] < weld[b] ? [a, b] : [b, a];
      const key = `${weld[x]}_${weld[y]}`;
      let o = edgeMap.get(key);
      if (o === undefined) {
        const t = val[x] / (val[x] - val[y]);
        o = out.lerp(P, N, UV, SI, SW, REST, x, y, t, `${key}`);
        extraLerp?.(out, x, y, t);
        edgeMap.set(key, o);
      }
      return o;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      const ins = tri.map((i) => val[i] <= 0);
      const n = ins.filter(Boolean).length;
      if (n === 0) continue;
      if (n === 3) { out.tri(vert(tri[0]), vert(tri[1]), vert(tri[2])); continue; }
      // walk the triangle's edges (Sutherland–Hodgman against one plane-like field)
      const poly: number[] = [];
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3];
        if (ins[e]) poly.push(vert(a));
        if (ins[e] !== ins[(e + 1) % 3]) poly.push(cut(a, b));
      }
      for (let k = 1; k + 1 < poly.length; k++) out.tri(poly[0], poly[k], poly[k + 1]);
    }
    return out;
  };

  // the body keeps what no garment covers (the garment's edge minus a 1.5 cm margin, hidden under its lip)
  const MARGIN = 0.015;
  const bodyVal = new Float32Array(nV).fill(-1);
  for (let i = 0; i < nV; i++) {
    let covered = Infinity;
    for (const gm of garments) covered = Math.min(covered, maxF(fieldOf(gm, i)));
    // keep where covered > -MARGIN  →  field = -(covered + MARGIN) <= 0
    bodyVal[i] = -(covered + MARGIN);
  }
  const bodyOut = clip(bodyVal);
  const trimmedBody = bodyOut.geometry(T, true);
  stats.bodyTrisAfter = trimmedBody.index!.count / 3;

  for (const gm of garments) {
    const val = new Float32Array(nV), fN = new Float32Array(nV), fS = new Float32Array(nV), fH = new Float32Array(nV), fL = new Float32Array(nV);
    for (let i = 0; i < nV; i++) { const f = fieldOf(gm, i); val[i] = maxF(f); fN[i] = f.neck; fS[i] = f.sleeve; fH[i] = f.hem; fL[i] = f.leg; }
    const o = clip(val,
      (out, i) => out.band.push(fN[i], fS[i], fH[i], fL[i]),
      (out, a, b, t) => out.band.push(fN[a] + (fN[b] - fN[a]) * t, fS[a] + (fS[b] - fS[a]) * t, fH[a] + (fH[b] - fH[a]) * t, fL[a] + (fL[b] - fL[a]) * t));
    // average the normals over welded points (no cracks where the file's UV seams split a vertex)
    o.smoothNormals();
    o.relax(gm.relax?.[0] ?? 3, 0.5, gm.relax?.[1] ?? 6);
    o.shell(gm.offset, gm.lip, gm.collar ? { ...gm.collar, neck: rig.j("neck"), head: rig.j("Head") } : undefined);
    const geo = o.geometry(T, false);
    const mesh = new T.SkinnedMesh(geo, gm.material);
    mesh.name = `cloth-${gm.name}`;
    mesh.frustumCulled = false;
    // the ink line skips the collar band and the hem lips: thin strips drew black flecks along every edge
    const og = geo.clone();
    { const B = geo.getAttribute("aBand"), Lp = geo.getAttribute("aLip"), I = geo.index!.array, keep: number[] = [];
      const thin = (v: number) => B.getX(v) > 0.45 || Lp.getX(v) > 0.75;
      for (let t = 0; t < I.length; t += 3) if (!thin(I[t]) && !thin(I[t + 1]) && !thin(I[t + 2])) keep.push(I[t], I[t + 1], I[t + 2]);
      og.setIndex(keep); }
    const ol = new T.SkinnedMesh(og, outline(0.0055));
    ol.name = `cloth-${gm.name}-outline`;
    ol.frustumCulled = false;
    body.parent!.add(mesh); body.parent!.add(ol);
    mesh.bind(body.skeleton, body.bindMatrix); ol.bind(body.skeleton, body.bindMatrix);
    meshes.push(mesh);
    stats[`${gm.name}Tris`] = geo.index!.count / 3;
  }
  return { meshes, trimmedBody, stats };
}

/** A growing mesh: positions, normals, uv, skin, rest point, band fields; welded ids for edges. */
class Out {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; si: number[] = []; sw: number[] = []; rest: number[] = []; band: number[] = []; lip: number[] = [];
  wid: string[] = []; ind: number[] = [];
  constructor(private T: Three) {}
  get n() { return this.pos.length / 3; }
  copy(P: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, N: typeof P, UV: typeof P, SI: typeof P, SW: typeof P, R: typeof P, i: number, w: number) {
    this.pos.push(P.getX(i), P.getY(i), P.getZ(i)); this.nor.push(N.getX(i), N.getY(i), N.getZ(i));
    this.uv.push(UV ? UV.getX(i) : 0, UV ? UV.getY(i) : 0);
    for (let k = 0; k < 4; k++) { this.si.push(SI.getComponent(i, k)); this.sw.push(SW.getComponent(i, k)); }
    this.rest.push(R.getX(i), R.getY(i), R.getZ(i)); this.lip.push(0);
    this.wid.push(`v${w}`);
    return this.n - 1;
  }
  lerp(P: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, N: typeof P, UV: typeof P, SI: typeof P, SW: typeof P, R: typeof P, a: number, b: number, t: number, key: string) {
    const l = (A: typeof P, c: (i: number) => number[]) => { const x = c(a), y = c(b); return x.map((v, k) => v + (y[k] - v) * t); void A; };
    this.pos.push(...l(P, (i) => [P.getX(i), P.getY(i), P.getZ(i)]));
    this.nor.push(...l(N, (i) => [N.getX(i), N.getY(i), N.getZ(i)]));
    this.uv.push(...(UV ? l(UV, (i) => [UV.getX(i), UV.getY(i)]) : [0, 0]));
    this.rest.push(...l(R, (i) => [R.getX(i), R.getY(i), R.getZ(i)]));
    // skin: the two vertices' influences mixed, the four strongest kept, summing to one
    const inf = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      inf.set(SI.getComponent(a, k), (inf.get(SI.getComponent(a, k)) ?? 0) + SW.getComponent(a, k) * (1 - t));
      inf.set(SI.getComponent(b, k), (inf.get(SI.getComponent(b, k)) ?? 0) + SW.getComponent(b, k) * t);
    }
    const top = Array.from(inf.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4);
    const s = top.reduce((q, e) => q + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(top[k]?.[0] ?? 0); this.sw.push((top[k]?.[1] ?? 0) / s); }
    this.lip.push(0);
    this.wid.push(`e${key}`);
    return this.n - 1;
  }
  tri(a: number, b: number, c: number) { this.ind.push(a, b, c); }
  dup(i: number) {
    const p3 = (arr: number[], k: number) => arr.push(...arr.slice(i * k, i * k + k));
    p3(this.pos, 3); p3(this.nor, 3); p3(this.uv, 2); p3(this.si, 4); p3(this.sw, 4); p3(this.rest, 3); p3(this.band, 4); this.lip.push(0); this.wid.push(`${this.wid[i]}'`);
    return this.n - 1;
  }
  /** Cloth bridges the body's small bumps (muscle, rib, the generated mesh's lumps): relax the shell's points and
   *  normals over their welded neighbours. Edges stay put so the cut line keeps its shape. */
  relax(iters: number, lambda: number, normalIters: number) {
    const ids = Array.from(new Set(this.wid)), at = new Map(ids.map((w, k) => [w, k] as const));
    const nb: Set<number>[] = ids.map(() => new Set());
    const cnt = new Map<string, number>();
    for (let t = 0; t < this.ind.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = at.get(this.wid[this.ind[t + e]])!, b = at.get(this.wid[this.ind[t + (e + 1) % 3]])!;
      nb[a].add(b); nb[b].add(a);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`; cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    const edge = new Uint8Array(ids.length);
    cnt.forEach((c, k) => { if (c === 1) { const [a, b] = k.split("|").map(Number); edge[a] = 1; edge[b] = 1; } });
    const P = new Float64Array(ids.length * 3), Nn = new Float64Array(ids.length * 3);
    for (let i = 0; i < this.n; i++) { const k = at.get(this.wid[i])!; for (let c = 0; c < 3; c++) { P[k * 3 + c] = this.pos[i * 3 + c]; Nn[k * 3 + c] += this.nor[i * 3 + c]; } }
    const step = (A: Float64Array, lam: number, keepEdge: boolean) => {
      const B = A.slice();
      for (let k = 0; k < ids.length; k++) {
        if (keepEdge && edge[k]) continue;
        const s = [0, 0, 0]; nb[k].forEach((j) => { s[0] += A[j * 3]; s[1] += A[j * 3 + 1]; s[2] += A[j * 3 + 2]; });
        const n = nb[k].size || 1;
        for (let c = 0; c < 3; c++) B[k * 3 + c] = A[k * 3 + c] + lam * (s[c] / n - A[k * 3 + c]);
      }
      return B;
    };
    let Q = P; for (let i = 0; i < iters; i++) Q = step(Q, lambda, true);
    let M = Nn; for (let i = 0; i < normalIters; i++) M = step(M, 0.7, false);
    for (let i = 0; i < this.n; i++) {
      const k = at.get(this.wid[i])!;
      const l = Math.hypot(M[k * 3], M[k * 3 + 1], M[k * 3 + 2]) || 1;
      // the relaxed point moves only along the normal (in or out): a sideways slide would drag the trim lines and
      // decals, which are drawn from each vertex's own rest point, into zigzags
      const n0 = [M[k * 3] / l, M[k * 3 + 1] / l, M[k * 3 + 2] / l];
      const d = (Q[k * 3] - P[k * 3]) * n0[0] + (Q[k * 3 + 1] - P[k * 3 + 1]) * n0[1] + (Q[k * 3 + 2] - P[k * 3 + 2]) * n0[2];
      const dd = Math.max(0, d);           // only ever outwards: cloth bridges hollows, never sinks into the body
      for (let c = 0; c < 3; c++) { this.pos[i * 3 + c] = P[k * 3 + c] + n0[c] * dd; this.nor[i * 3 + c] = n0[c]; }
    }
  }
  smoothNormals() {
    const acc = new Map<string, number[]>();
    for (let i = 0; i < this.n; i++) { const a = acc.get(this.wid[i]) ?? [0, 0, 0]; a[0] += this.nor[i * 3]; a[1] += this.nor[i * 3 + 1]; a[2] += this.nor[i * 3 + 2]; acc.set(this.wid[i], a); }
    for (let i = 0; i < this.n; i++) { const a = acc.get(this.wid[i])!; const l = Math.hypot(a[0], a[1], a[2]) || 1; this.nor[i * 3] = a[0] / l; this.nor[i * 3 + 1] = a[1] / l; this.nor[i * 3 + 2] = a[2] / l; }
  }
  /** Push off the skin; a thickness lip down to the skin at every open edge; a standing collar on the neck edge. */
  shell(off: number, lip: number, collar?: { h: number; out: number; fold?: number; color: string; neck: V3; head: V3 }) {
    const n0 = this.n;
    for (let i = 0; i < n0; i++) for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.nor[i * 3 + k] * off;
    // open edges: an edge used once (on welded ids)
    const count = new Map<string, number>(), dir = new Map<string, [number, number]>();
    for (let t = 0; t < this.ind.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = this.ind[t + e], b = this.ind[t + (e + 1) % 3];
      const ka = this.wid[a], kb = this.wid[b];
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      count.set(key, (count.get(key) ?? 0) + 1); dir.set(key, [a, b]);
    }
    const ring: [number, number][] = [];
    count.forEach((c, k) => { if (c === 1) ring.push(dir.get(k)!); });
    const inner = new Map<number, number>(), up = new Map<number, number>(), flap = new Map<number, number>();
    const nearNeck = (i: number) => Math.abs(this.band[i * 4]) < 0.004;
    for (const [a, b] of ring) {
      for (const v of [a, b]) if (!inner.has(v)) {
        const d = this.dup(v);
        for (let k = 0; k < 3; k++) this.pos[d * 3 + k] -= this.nor[v * 3 + k] * (off + lip);
        this.lip[d] = 1; this.lip[v] = Math.max(this.lip[v], 0.5);
        inner.set(v, d);
      }
      this.ind.push(a, inner.get(a)!, b, b, inner.get(a)!, inner.get(b)!);
      if (collar && nearNeck(a) && nearNeck(b)) {
        for (const v of [a, b]) if (!up.has(v)) {
          const d = this.dup(v);
          // up the neck, leaning in a touch towards it
          const nx = collar.neck[0] - this.pos[v * 3], nz = collar.neck[2] - this.pos[v * 3 + 2];
          const hl = Math.hypot(nx, nz) || 1;
          this.pos[d * 3] += (nx / hl) * collar.out; this.pos[d * 3 + 1] += collar.h; this.pos[d * 3 + 2] += (nz / hl) * collar.out;
          this.band[d * 4] = 0.5; // marks collar cloth for the shader
          up.set(v, d);
          if (collar.fold) {
            // a shirt collar: the band folds down and out over itself
            const f = this.dup(v);
            this.pos[f * 3] -= (nx / hl) * collar.fold; this.pos[f * 3 + 1] += collar.h * 0.1; this.pos[f * 3 + 2] -= (nz / hl) * collar.fold;
            this.band[f * 4] = 0.5;
            flap.set(v, f);
          }
        }
        this.ind.push(a, b, up.get(a)!, up.get(a)!, b, up.get(b)!);
        if (collar.fold) this.ind.push(up.get(a)!, up.get(b)!, flap.get(a)!, flap.get(a)!, up.get(b)!, flap.get(b)!);
      }
    }
  }
  geometry(T: Three, plain: boolean) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(this.sw, 4));
    g.setAttribute("aRest", new T.Float32BufferAttribute(this.rest, 3));
    if (!plain) { g.setAttribute("aBand", new T.Float32BufferAttribute(this.band, 4)); g.setAttribute("aLip", new T.Float32BufferAttribute(this.lip, 1)); }
    g.setIndex(this.ind);
    void this.T;
    return g;
  }
}

/** Decal pictures: a crest and a number, drawn big on a canvas so they stay sharp (no texel blobs). */
export function crestTexture(T: Three, a: string, b: string, letters: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, 256, 256);
  x.beginPath(); x.moveTo(28, 20); x.lineTo(228, 20); x.lineTo(228, 120); x.quadraticCurveTo(228, 200, 128, 240); x.quadraticCurveTo(28, 200, 28, 120); x.closePath();
  x.fillStyle = b; x.fill(); x.lineWidth = 14; x.strokeStyle = a; x.stroke();
  x.fillStyle = a; x.font = "bold 96px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(letters, 128, 118);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function numberTexture(T: Three, n: string, fill: string, edge: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const x = c.getContext("2d")!;
  x.font = "bold 380px Arial Black, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 22; x.strokeStyle = edge; x.strokeText(n, 256, 276); x.fillStyle = fill; x.fillText(n, 256, 276);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function wordTexture(T: Three, s: string, fill: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const x = c.getContext("2d")!;
  x.font = "bold 150px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = fill; x.fillText(s, 512, 136);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

export interface FabricOpts {
  kind: "poly" | "wool" | "cotton";
  color: string; trim: string; trim2?: string;
  /** trim bands, metres from each edge: neck, cuff, hem, leg (0 = none) */
  bands?: [number, number, number, number];
  crest?: { tex: THREE.Texture; at: V3; size: number };
  number?: { tex: THREE.Texture; at: V3; size: number };
  front?: { tex: THREE.Texture; at: V3; size: [number, number] };
  /** stripes (vertical, rest x) or hoops (rest y): a crisp line from position, never texels; width in metres */
  pattern?: { kind: "stripes" | "hoops"; color: string; width: number; centre?: number };
}

/** Fabric: a toon ramp (2 or 3 flat bands), a sheen at grazing angles (polyester shine), wool's soft rim and knit, crisp decals. */
export function fabricMaterial(T: Three, o: FabricOpts): THREE.Material {
  const ramp = o.kind === "poly" ? [150, 205, 255] : o.kind === "wool" ? [170, 220, 255] : [160, 215, 255];
  const gm = new T.DataTexture(new Uint8Array(ramp), ramp.length, 1, T.RedFormat);
  gm.minFilter = gm.magFilter = T.NearestFilter; gm.needsUpdate = true;
  const m = new T.MeshToonMaterial({ color: o.color, gradientMap: gm, side: T.DoubleSide });
  const lin = (h: string) => new T.Color(h);
  const u = {
    uTrim: { value: lin(o.trim) }, uTrim2: { value: lin(o.trim2 ?? o.trim) },
    uBands: { value: new T.Vector4(...(o.bands ?? [0, 0, 0, 0])) },
    uCrest: { value: o.crest?.tex ?? null }, uCrestB: { value: new T.Vector4(...(o.crest?.at ?? [0, 0, 0]), o.crest?.size ?? 0) },
    uNum: { value: o.number?.tex ?? null }, uNumB: { value: new T.Vector4(...(o.number?.at ?? [0, 0, 0]), o.number?.size ?? 0) },
    uWord: { value: o.front?.tex ?? null }, uWordB: { value: new T.Vector4(...(o.front?.at ?? [0, 0, 0]), o.front?.size[0] ?? 0) }, uWordH: { value: o.front?.size[1] ?? 0 },
    uKind: { value: o.kind === "poly" ? 0 : o.kind === "wool" ? 1 : 2 },
    uPat: { value: new T.Vector3(o.pattern ? (o.pattern.kind === "stripes" ? 1 : 2) : 0, o.pattern?.width ?? 0.05, o.pattern?.centre ?? 0) }, uPatC: { value: lin(o.pattern?.color ?? o.color) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aRest; attribute vec4 aBand; attribute float aLip; varying vec3 vRest; varying vec4 vBand; varying float vLip; varying vec3 vNrmV;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest; vBand = aBand; vLip = aLip;")
      .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\nvNrmV = normalize(transformedNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vRest; varying vec4 vBand; varying float vLip; varying vec3 vNrmV;
uniform vec3 uTrim, uTrim2; uniform vec4 uBands; uniform sampler2D uCrest, uNum, uWord; uniform vec4 uCrestB, uNumB, uWordB; uniform float uWordH, uKind; uniform vec3 uPat, uPatC;
// a decal laid flat on the front (dirZ 1) or back (dirZ -1), from the rest pose: it moves with the cloth, sharp at any size
vec4 tnDecal(sampler2D t, vec4 b, float hgt, float dirZ) {
  if (b.w <= 0.0) return vec4(0.0);
  vec2 q = (vRest.xy - b.xy) / vec2(b.w, hgt > 0.0 ? hgt : b.w) + 0.5;
  if (dirZ < 0.0) q.x = 1.0 - q.x;
  if (any(lessThan(q, vec2(0.0))) || any(greaterThan(q, vec2(1.0))) || vRest.z * dirZ < 0.0) return vec4(0.0);
  return texture2D(t, q);
}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec3 c = diffuseColor.rgb;
  // trim: a crisp band a fixed distance from each edge (the field is linear in the triangle: a straight, clean line)
  float aaw = 0.0015;
  float collar = step(0.25, vBand.x);
  float bn = uBands.x > 0.0 ? smoothstep(-uBands.x - aaw, -uBands.x + aaw, vBand.x) : 0.0;
  float bs = uBands.y > 0.0 ? smoothstep(-uBands.y - aaw, -uBands.y + aaw, vBand.y) : 0.0;
  float bh = uBands.z > 0.0 ? smoothstep(-uBands.z - aaw, -uBands.z + aaw, vBand.z) : 0.0;
  float bl = uBands.w > 0.0 ? smoothstep(-uBands.w - aaw, -uBands.w + aaw, vBand.w) : 0.0;
  float band = max(max(bn, bs), max(bh, bl));
  // stripes / hoops: a square wave on rest position, its edge anti-aliased by the pixel's own footprint
  if (uPat.x > 0.5) {
    float u = (uPat.x < 1.5 ? vRest.x : vRest.y - uPat.z) / (2.0 * uPat.y) + (uPat.x < 1.5 ? 0.25 : 0.0);
    float w = fwidth(u) * 0.75 + 1e-4;
    float sq = smoothstep(0.25 - w, 0.25 + w, abs(fract(u) - 0.5));
    c = mix(c, uPatC, sq);
  }
  c = mix(c, uTrim, max(band, collar));
  // wool: a fine knit (rows of small Vs), faded out before it can shimmer
  if (uKind > 0.5 && uKind < 1.5) {
    float rows = vRest.y * 260.0, cols = (vRest.x + vRest.z) * 220.0;
    float k = abs(fract(cols + abs(fract(rows) - 0.5)) - 0.5);
    float fw = fwidth(rows) + fwidth(cols);
    c *= 1.0 - 0.035 * smoothstep(0.15, 0.35, k) * (1.0 - smoothstep(0.25, 0.6, fw));
    // ribbed cuffs and hem
    float rib = smoothstep(0.35, 0.5, abs(fract((vRest.x * 0.7 + vRest.z) * 140.0) - 0.5) * 2.0);
    c *= 1.0 - 0.10 * max(bs, bh) * rib * (1.0 - smoothstep(0.3, 0.7, fwidth((vRest.x + vRest.z) * 140.0)));
  }
  // the edge's thickness reads as a thin darker lip
  c *= mix(1.0, 0.62, smoothstep(0.6, 1.0, vLip));
  vec4 cr = tnDecal(uCrest, uCrestB, 0.0, 1.0); c = mix(c, cr.rgb, cr.a);
  vec4 nu = tnDecal(uNum, uNumB, 0.0, -1.0); c = mix(c, nu.rgb, nu.a);
  vec4 wd = tnDecal(uWord, uWordB, uWordH, 1.0); c = mix(c, wd.rgb, wd.a);
  diffuseColor.rgb = c;
}`)
      .replace("#include <opaque_fragment>", `{
  // fabric sheen: polyester shines in a thin bright band at grazing angles; wool a wide soft fuzz; cotton almost none
  vec3 V = normalize(vViewPosition);
  float fr = 1.0 - abs(dot(normalize(vNrmV), V));
  float sheen = uKind < 0.5 ? smoothstep(0.62, 0.78, fr) * 0.22 : uKind < 1.5 ? smoothstep(0.35, 1.0, fr) * 0.12 : smoothstep(0.7, 0.9, fr) * 0.06;
  outgoingLight += diffuseColor.rgb * sheen + vec3(sheen * 0.25);
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `clothes-fabric-${o.kind}`;
  return m;
}
