/**
 * CLOTHES AS CLOTH, the builder (Harry, 20 Nov 2026: "the kits look … painted on with blobs"; research and
 * proof: docs/research/clothes-and-necks-2026-11-20.md). A garment is the body's own surface cut along smooth
 * fields measured from landmarks of the rest pose (neck ring, shoulder seam, sleeve end, wrist, waist, hem,
 * shorts end, sock top, ankle), pushed off the skin, given a lip at every open edge, and skinned to the SAME
 * skeleton with the body's own weights. The body under it is cut away. Collars, lapels and ties are their own
 * pieces on the neck loop. All garments are merged into ONE geometry (aGarment = which slot), so a dressed
 * person is 4 draws: body, body ink, cloth, cloth ink. Pure geometry, no textures; outfits.ts says what to cut.
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

export type CollarKind = "crew" | "shirt" | "polo" | "lapel" | "hood";

export interface GarmentSpec {
  name: string;
  /** distance-like fields (metres, negative inside) for a rest point; each garment picks which count */
  fields: (p: THREE.Vector3, arm: number, armS: number, leg: number, legS: number, side: number) => FieldsAt;
  offset: number;                 // metres off the skin
  lip: number;                    // thickness shown at an open edge
  /** a collar piece built on the neck edge loop: crew (a ribbed band), shirt / polo (a stand that folds down, points at
   *  the front), lapel (a coat: a stand at the back, lapels lying open down the V) */
  collar?: { kind?: CollarKind; h: number; out: number; fold?: number; color?: string };
  /** legs as a smooth tube: fills the hollow under any bump the body has (the old shorts modelled into its thighs) */
  tube?: boolean;
  /** a tie down the front of this garment (drawn in the material's second trim colour) */
  tie?: { top: number; bottom: number; w: number };
  /** shell relax: point passes, normal passes */
  relax?: [number, number];
  /**
   * THE GARMENT'S OWN SHAPE (Harry: "why does every type of trouser and top keep the outline and shorts outline —
   * suits shouldn't look the same as hoodies"). Not an offset of the muscular body: legs and sleeves are lofted tubes
   * along the limb with their own radius profile, the torso is swept elliptical sections from the hem up to the
   * armpits with its own ease; each is made big enough to hold the body at every angle, so no pec, bicep or the old
   * shorts shape shows through. Shoulders, neck and seat blend back to the (smoothed) body.
   */
  shape?: {
    /** trouser legs: width as a multiple of the leg's own (smoothed) size at the thigh and at the hem; straight =
     *  never narrower than anything below (drapes over knee and calf) */
    legs?: { top: number; hem: number; straight?: boolean; cuff?: number };
    /** sleeves: width as a multiple of the arm's own size at the shoulder end and at the cuff */
    arms?: { top: number; cuff: number };
    /** shoes: a flat sole (the football boot's studs flattened to the ground) */
    shoe?: boolean;
    /** torso: the body's smoothed size times k at each height t (0 = hem line, 1 = armpits): [t, across, front-back];
     *  boxy 0..1 = held at the chest's size below it; pad = a structured shoulder (metres out and up) */
    torso?: { knots: [number, number, number][]; boxy?: number; pad?: number; hem?: number };
  };
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

export interface Built { cloth: THREE.BufferGeometry; ink: THREE.BufferGeometry; body: THREE.BufferGeometry; stats: Record<string, number> }

/**
 * Cut, shell and bind. `garments` are drawn outermost last; the body keeps only what no garment covers.
 */
export function buildClothes(T: Three, body: THREE.SkinnedMesh, rig: Rig, garments: GarmentSpec[]): Built {
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
  const geos: THREE.BufferGeometry[] = [];
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

  // the body's own size along each limb and up the torso (used to size garments so they hold it)
  let bodyStats: BodyStats | undefined;
  const bodyProfile = (): BodyStats => {
    const LRl: number[][][] = [0, 1].map(() => Array.from({ length: BIN }, () => [] as number[])), ARl: number[][][] = [0, 1].map(() => Array.from({ length: BIN }, () => [] as number[]));
    const tor = { a: new Float64Array(BIN), f: new Float64Array(BIN), b: new Float64Array(BIN), cz: new Float64Array(BIN), n: new Float64Array(BIN) };
    const y0 = L("Hips")[1] - 0.35, y1 = L("LeftArm")[1];
    for (let i = 0; i < nV; i++) {
      rp.fromBufferAttribute(REST as THREE.BufferAttribute, i);
      const v = vf[i];
      if (v.leg > 0.5 && v.legS < 1.97) { const A = rp.x >= 0 === (legL[0][0] >= 0) ? legL : legR, k = A === legL ? 0 : 1; const b = Math.min(BIN - 1, Math.max(0, Math.floor((v.legS / 2) * BIN))); LRl[k][b].push(perp(rp, A, v.legS)); }
      if (v.arm > 0.5 && v.armS < 1.97) { const A = rp.x >= 0 === (armL[0][0] >= 0) ? armL : armR, k = A === armL ? 0 : 1; const b = Math.min(BIN - 1, Math.max(0, Math.floor((v.armS / 2) * BIN))); ARl[k][b].push(perp(rp, A, v.armS)); }
      if (v.arm < 0.5 && rp.y > y0 && rp.y < y1) { const b = Math.min(BIN - 1, Math.floor(((rp.y - y0) / (y1 - y0)) * BIN)); tor.cz[b] += rp.z; tor.n[b]++; }
    }
    for (let b = 0; b < BIN; b++) tor.cz[b] = tor.n[b] ? tor.cz[b] / tor.n[b] : 0;
    for (let i = 0; i < nV; i++) {
      rp.fromBufferAttribute(REST as THREE.BufferAttribute, i);
      const v = vf[i];
      if (v.arm < 0.5 && rp.y > y0 && rp.y < y1) { const b = Math.min(BIN - 1, Math.floor(((rp.y - y0) / (y1 - y0)) * BIN)); tor.a[b] = Math.max(tor.a[b], Math.abs(rp.x)); const dz = rp.z - tor.cz[b]; if (dz > 0) tor.f[b] = Math.max(tor.f[b], dz); else tor.b[b] = Math.max(tor.b[b], -dz); }
    }
    // each slice's size: the 55th percentile of the distances (a stray seat or armpit point does not set it)
    const p90 = (L2: number[][][]) => L2.map((bins) => Float64Array.from(bins.map((v) => { if (!v.length) return 0; v.sort((x, y) => x - y); return v[Math.floor(v.length * 0.55)]; })));
    return { legR: p90(LRl), armR: p90(ARl), tor, y0, y1, crotch: L("LeftUpLeg")[1] - 0.06, armpit: L("LeftArm")[1] - 0.09 };
  };

  for (const gm of garments) {
    const val = new Float32Array(nV), fN = new Float32Array(nV), fS = new Float32Array(nV), fH = new Float32Array(nV), fL = new Float32Array(nV);
    for (let i = 0; i < nV; i++) { const f = fieldOf(gm, i); val[i] = maxF(f); fN[i] = f.neck; fS[i] = f.sleeve; fH[i] = f.hem; fL[i] = f.leg; }
    const o = clip(val,
      (out, i) => out.band.push(fN[i], fS[i], fH[i], fL[i]),
      (out, a, b, t) => out.band.push(fN[a] + (fN[b] - fN[a]) * t, fS[a] + (fS[b] - fS[a]) * t, fH[a] + (fH[b] - fH[a]) * t, fL[a] + (fL[b] - fL[a]) * t));
    // average the normals over welded points (no cracks where the file's UV seams split a vertex)
    o.smoothNormals();
    o.relax(gm.relax?.[0] ?? 3, 0.5, gm.relax?.[1] ?? 6);
    if (gm.shape) shapeGarment(o, gm.shape, { rig, legL, legR, armL, armR, stats: bodyStats ??= bodyProfile() });
    if (gm.tube) {
      // per leg, per slice along the leg: the radius from the leg's own axis; each slice is raised to a smoothed
      // envelope of its neighbours' radii (never lowered), so a step in the body becomes a gentle taper
      const BINS = 48, ax = (s: number, A: readonly V3[]) => { const k = s <= 1 ? 0 : 1, t = s <= 1 ? s : s - 1; return [0, 1, 2].map((q) => A[k][q] + (A[k + 1][q] - A[k][q]) * Math.max(0, Math.min(1, t))); };
      for (const [A, sg] of [[legL, Math.sign(legL[0][0]) || 1], [legR, Math.sign(legR[0][0]) || -1]] as [readonly V3[], number][]) {
        const rec: { i: number; b: number; d: number[]; r: number }[] = [];
        const env = new Float64Array(BINS);
        for (let i = 0; i < o.n; i++) {
          const rx = o.rest[i * 3], ry = o.rest[i * 3 + 1], rz = o.rest[i * 3 + 2];
          if (Math.sign(rx) !== sg || ry > A[0][1] - 0.02) continue;
          rp.set(rx, ry, rz);
          const s = along(rp, A[0], A[1], A[2]);
          const c = ax(s, A), d = [o.pos[i * 3] - c[0], 0, o.pos[i * 3 + 2] - c[2]];
          const r = Math.hypot(d[0], d[2]); if (r < 1e-4) continue;
          const b = Math.max(0, Math.min(BINS - 1, Math.floor((s / 2) * BINS)));
          if (s < 0.4) continue;      // the upper thigh and seat keep their own shape
          rec.push({ i, b, d: [d[0] / r, 0, d[2] / r], r });
        }
        // each slice's typical radius (the 75th percentile), then a smoothed envelope along the leg
        for (let b = 0; b < BINS; b++) { const rs = rec.filter((q) => q.b === b).map((q) => q.r).sort((x, y) => x - y); env[b] = rs.length ? rs[Math.floor(rs.length * 0.75)] : 0; }
        const sm = new Float64Array(BINS);
        for (let b = 0; b < BINS; b++) { let m = 0, w = 0; for (let k = -4; k <= 4; k++) { const v = env[b + k]; if (v) { m += v; w++; } } sm[b] = w ? m / w : 0; }
        for (const q of rec) { const r2 = Math.max(q.r, Math.min(sm[q.b], q.r + 0.018)); o.pos[q.i * 3] += q.d[0] * (r2 - q.r); o.pos[q.i * 3 + 2] += q.d[2] * (r2 - q.r); }
      }
    }
    o.shell(gm.offset, gm.lip, gm.collar ? { ...gm.collar, neck: rig.j("neck") } : undefined);
    if (gm.tie) o.addTie(gm.tie);
    const geo = o.geometry(T, false);
    stats[`${gm.name}Tris`] = geo.index!.count / 3;
    geos.push(geo);
  }
  const cloth = mergeGarments(T, geos);
  // the ink line skips the collar pieces, the tie and the hem lips: thin strips drew black flecks along every edge
  const ink = cloth.clone();
  { const B = cloth.getAttribute("aBand"), Lp = cloth.getAttribute("aLip"), I = cloth.index!.array, keep: number[] = [];
    const thin = (v: number) => B.getX(v) > 0.45 || B.getW(v) > 0.25 || Lp.getX(v) > 0.75;
    for (let t = 0; t < I.length; t += 3) if (!thin(I[t]) && !thin(I[t + 1]) && !thin(I[t + 2])) keep.push(I[t], I[t + 1], I[t + 2]);
    ink.setIndex(keep); }
  stats.clothTris = cloth.index!.count / 3;
  return { cloth, ink, body: trimmedBody, stats };
}

const BIN = 40;
interface BodyStats { legR: Float64Array[]; armR: Float64Array[]; tor: { a: Float64Array; f: Float64Array; b: Float64Array; cz: Float64Array; n: Float64Array }; y0: number; y1: number; crotch: number; armpit: number }
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The point on a limb's axis at s (0 top joint, 1 middle, 2 end). */
function axisAt(A: readonly V3[], s: number): V3 { const k = s <= 1 ? 0 : 1, t = Math.max(0, Math.min(1, s <= 1 ? s : s - 1)); return [0, 1, 2].map((q) => A[k][q] + (A[k + 1][q] - A[k][q]) * t) as V3; }
function axisDir(A: readonly V3[], s: number): V3 { const k = s <= 1 ? 0 : 1; const d = [0, 1, 2].map((q) => A[k + 1][q] - A[k][q]); const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; }
/** Distance from a point to the limb's axis, across the limb. */
function perp(p: THREE.Vector3, A: readonly V3[], s: number): number {
  const c = axisAt(A, s), d = axisDir(A, s);
  const v = [p.x - c[0], p.y - c[1], p.z - c[2]], t = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
  return Math.hypot(v[0] - d[0] * t, v[1] - d[1] * t, v[2] - d[2] * t);
}
/** Re-shape a cut garment to its own silhouette (see GarmentSpec.shape). Edits base points before the shell. */
function shapeGarment(o: Out, sh: NonNullable<GarmentSpec["shape"]>, k: { rig: Rig; legL: readonly V3[]; legR: readonly V3[]; armL: readonly V3[]; armR: readonly V3[]; stats: BodyStats }) {
  const { rig, legL, legR, armL, armR, stats: S } = k;
  const p = { x: 0, y: 0, z: 0 } as THREE.Vector3;
  // ONE straight tube per limb: on the line from the top joint to the end joint (hip → ankle, shoulder → wrist),
  // radius a straight taper from top to hem (a trouser leg's inner and outer edges are straight lines; no knee pinch,
  // no calf bulge, no rings at the elbow). The size comes from the limb's own slices, averaged.
  const sizeAt = (R: Float64Array, s: number) => { let m = 0, n = 0; for (let q = -3; q <= 3; q++) { const b = Math.floor(((s + q * 0.03) / 2) * BIN); if (b >= 0 && b < BIN && R[b]) { m += R[b]; n++; } } return n ? m / n : 0.05; };
  const tube = (R: Float64Array, sTop: number, sMid: number, sEnd: number, kTop: number, kHem: number, straight: boolean, cuff?: number) => {
    const top = sizeAt(R, sTop) * kTop;
    const hem = Math.max(sizeAt(R, sEnd) * kHem, straight ? sizeAt(R, sMid) * kTop * 0.92 : 0);
    return (u: number) => { const r = top + (hem - top) * u; return cuff && u > 0.9 ? r + (sizeAt(R, sEnd) * cuff - r) * ss(0.9, 0.99, u) : r; };
  };
  const legLine = sh.legs ? [0, 1].map((i) => tube(S.legR[i], 0.55, 1.3, 1.88, sh.legs!.top, sh.legs!.hem, sh.legs!.straight ?? false, sh.legs!.cuff)) : null;
  const armLine = sh.arms ? [0, 1].map((i) => tube(S.armR[i], 0.45, 1.2, 1.85, sh.arms!.top, sh.arms!.cuff, false)) : null;
  /** The straight limb line: param u (0 top joint .. 1 end joint), the point on it and the way across. */
  const onLine = (A: readonly V3[], q: number[]) => {
    const a = A[0], b = A[2], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const t = ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1] + (q[2] - a[2]) * d[2]) / L2;
    const c = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], r = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], rl = Math.hypot(r[0], r[1], r[2]) || 1;
    return { u: Math.max(0, Math.min(1, t)), c, r: [r[0] / rl, r[1] / rl, r[2] / rl], s: t * 2 };
  };
  // the torso's ellipse per slice: the body's extents, smoothed into an envelope; boxy = held at the chest's size below it
  const T0 = S.tor;
  const env = (arr: Float64Array) => {
    const o2 = new Float64Array(BIN); for (let b = 0; b < BIN; b++) { let m = 0; for (let q = -1; q <= 1; q++) m = Math.max(m, arr[b + q] ?? 0); o2[b] = m; }
    const o3 = new Float64Array(BIN); for (let b = 0; b < BIN; b++) { let m = 0, n = 0; for (let q = -3; q <= 3; q++) { const v = o2[b + q]; if (v) { m += v; n++; } } o3[b] = n ? m / n : 0; }
    return o3;
  };
  const ea = env(T0.a), ef = env(T0.f), eb = env(T0.b);
  const czS = new Float64Array(BIN); for (let b = 0; b < BIN; b++) { let m = 0, n = 0; for (let q = -4; q <= 4; q++) { const v = T0.cz[b + q]; if (T0.n[b + q]) { m += v; n++; } } czS[b] = n ? m / n : 0; }
  const chestBin = Math.floor(((S.armpit - S.y0) / (S.y1 - S.y0)) * BIN);
  const lerpBin = (arr: Float64Array, y: number) => { const fb = Math.min(BIN - 1.001, Math.max(0, ((y - S.y0) / (S.y1 - S.y0)) * BIN - 0.5)), b = Math.floor(fb), t = fb - b; return arr[b] * (1 - t) + arr[b + 1] * t; };
  const hemLine = sh.torso?.hem ?? (S.crotch + 0.02);
  const knot = (t: number): [number, number] => {
    const K = sh.torso?.knots ?? [[0, 1.05, 1.05], [1, 1.05, 1.05]];
    if (t <= K[0][0]) return [K[0][1], K[0][2]];
    for (let q = 1; q < K.length; q++) if (t <= K[q][0]) { const u = (t - K[q - 1][0]) / (K[q][0] - K[q - 1][0]); return [K[q - 1][1] + (K[q][1] - K[q - 1][1]) * u, K[q - 1][2] + (K[q][2] - K[q - 1][2]) * u]; }
    const L2 = K[K.length - 1]; return [L2[1], L2[2]];
  };
  const sliceAt = (y: number) => {
    const box = sh.torso?.boxy ?? 0, cb = Math.min(BIN - 1, Math.max(0, chestBin));
    const t = (y - hemLine) / (S.armpit - hemLine);
    const [kx, kz] = knot(t);
    const a = Math.max(lerpBin(ea, y), box * ea[cb]) * kx, f = Math.max(lerpBin(ef, y), box * ef[cb]) * kz, bk = Math.max(lerpBin(eb, y), box * eb[cb]) * kz;
    return { a, f, bk, cz: lerpBin(czS, y) };
  };
  for (let i = 0; i < o.n; i++) {
    p.x = o.rest[i * 3]; p.y = o.rest[i * 3 + 1]; p.z = o.rest[i * 3 + 2];
    let aL = 0, aR = 0, lL = 0, lR = 0;
    for (let q = 0; q < 4; q++) { const w = o.sw[i * 4 + q]; if (!w) continue; const pt = rig.part[o.si[i * 4 + q]] ?? "torso"; if (pt.startsWith("armL")) aL += w; else if (pt.startsWith("armR")) aR += w; else if (pt.startsWith("legL")) lL += w; else if (pt.startsWith("legR")) lR += w; }
    const base = [o.pos[i * 3], o.pos[i * 3 + 1], o.pos[i * 3 + 2]];
    const P0 = base.slice();
    let target: number[] | null = null, w = 0;
    // the torso: on the ray from the slice's centre, out to the ellipse
    let torsoT: number[] | null = null, wt = 0;
    const armW = Math.max(aL, aR);
    if (sh.torso && armW < 0.3) {
      const sl = sliceAt(p.y);
      const dx = base[0], dz = base[2] - sl.cz, bb = dz > 0 ? sl.f : sl.bk;
      const kk = 1 / (Math.hypot(dx / sl.a, dz / bb) || 1);
      torsoT = [dx * kk, base[1], sl.cz + dz * kk];
      wt = 1 - ss(S.armpit - 0.02, S.armpit + 0.07, p.y);
    }
    if (legLine && Math.max(lL, lR) > 0.5) {
      const A = lL >= lR ? legL : legR, ki = A === legL ? 0 : 1;
      const L3 = onLine(A, base);
      // the leg is the garment's own tube (the body under it is cut away, so a muscle or the old shorts edge never shows)
      let R = legLine[ki](L3.u);
      // never past the body's middle line (the two legs stay two legs)
      if (L3.r[0] * Math.sign(L3.c[0]) < -0.05) R = Math.min(R, (Math.abs(L3.c[0]) - 0.006) / Math.abs(L3.r[0]));
      const legT = [L3.c[0] + L3.r[0] * R, L3.c[1] + L3.r[1] * R, L3.c[2] + L3.r[2] * R];
      const wl = 1 - ss(S.crotch - 0.08, S.crotch + 0.02, p.y);
      target = torsoT ? legT.map((x, q) => torsoT![q] + (x - torsoT![q]) * wl) : legT;
      w = torsoT ? Math.max(wl, wt) : wl;
    } else if (armLine && armW >= 0.3) {
      const A = aL >= aR ? armL : armR, ki = A === armL ? 0 : 1;
      const L3 = onLine(A, base);
      const R = armLine[ki](L3.u);
      target = [L3.c[0] + L3.r[0] * R, L3.c[1] + L3.r[1] * R, L3.c[2] + L3.r[2] * R];
      w = ss(0.04, 0.16, L3.u) * ss(0.3, 0.55, armW);
    } else if (torsoT) { target = torsoT; w = wt; }
    if (target) for (let q = 0; q < 3; q++) o.pos[i * 3 + q] = P0[q] + (target[q] - P0[q]) * w;
    // a structured shoulder (a suit): the top of the shoulder lifted and squared out
    if (sh.torso?.pad && p.y > S.armpit && Math.abs(p.x) > 0.08) { const k2 = ss(S.armpit, S.armpit + 0.08, p.y) * ss(0.08, 0.2, Math.abs(p.x)); o.pos[i * 3] += Math.sign(p.x) * sh.torso.pad * k2; o.pos[i * 3 + 1] += sh.torso.pad * 0.5 * k2; }
  }
  if (sh.shoe) for (let i = 0; i < o.n; i++) { const y = o.pos[i * 3 + 1]; if (y < 0.035) { o.pos[i * 3 + 1] = Math.max(0.002, (y - 0.0) * 0.4); const sx = Math.sign(o.pos[i * 3]); o.pos[i * 3] += sx * 0.004; } }
  o.faceNormals();
  o.relax(0, 0.5, 12);
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
  /** Normals from the faces (after re-shaping), averaged over welded points. */
  faceNormals() {
    const acc = new Map<string, number[]>();
    for (let t = 0; t < this.ind.length; t += 3) {
      const a = this.ind[t], b = this.ind[t + 1], c = this.ind[t + 2];
      const ux = this.pos[b * 3] - this.pos[a * 3], uy = this.pos[b * 3 + 1] - this.pos[a * 3 + 1], uz = this.pos[b * 3 + 2] - this.pos[a * 3 + 2];
      const vx = this.pos[c * 3] - this.pos[a * 3], vy = this.pos[c * 3 + 1] - this.pos[a * 3 + 1], vz = this.pos[c * 3 + 2] - this.pos[a * 3 + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const v of [a, b, c]) { const k = this.wid[v]; const q = acc.get(k) ?? [0, 0, 0]; q[0] += n[0]; q[1] += n[1]; q[2] += n[2]; acc.set(k, q); }
    }
    for (let i = 0; i < this.n; i++) {
      const q = acc.get(this.wid[i]); if (!q) continue;
      let l = Math.hypot(q[0], q[1], q[2]) || 1;
      // keep the file's facing (outwards): flip if the faces wind the other way
      if (q[0] * this.nor[i * 3] + q[1] * this.nor[i * 3 + 1] + q[2] * this.nor[i * 3 + 2] < 0) l = -l;
      this.nor[i * 3] = q[0] / l; this.nor[i * 3 + 1] = q[1] / l; this.nor[i * 3 + 2] = q[2] / l;
    }
  }
  smoothNormals() {
    const acc = new Map<string, number[]>();
    for (let i = 0; i < this.n; i++) { const a = acc.get(this.wid[i]) ?? [0, 0, 0]; a[0] += this.nor[i * 3]; a[1] += this.nor[i * 3 + 1]; a[2] += this.nor[i * 3 + 2]; acc.set(this.wid[i], a); }
    for (let i = 0; i < this.n; i++) { const a = acc.get(this.wid[i])!; const l = Math.hypot(a[0], a[1], a[2]) || 1; this.nor[i * 3] = a[0] / l; this.nor[i * 3 + 1] = a[1] / l; this.nor[i * 3 + 2] = a[2] / l; }
  }
  /** Push off the skin; a thickness lip down to the skin at every open edge; a collar piece on the neck edge loop. */
  shell(off: number, lip: number, collar?: { kind?: CollarKind; h: number; out: number; fold?: number; neck: V3 }) {
    const n0 = this.n;
    this.n0 = n0;
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
    const inner = new Map<number, number>();
    for (const [a, b] of ring) {
      for (const v of [a, b]) if (!inner.has(v)) {
        const d = this.dup(v);
        for (let k = 0; k < 3; k++) this.pos[d * 3 + k] -= this.nor[v * 3 + k] * (off + lip);
        this.lip[d] = 1; this.lip[v] = Math.max(this.lip[v], 0.5);
        inner.set(v, d);
      }
      this.ind.push(a, inner.get(a)!, b, b, inner.get(a)!, inner.get(b)!);
    }
    if (collar) this.addCollar(ring.filter(([a, b]) => Math.abs(this.band[a * 4]) < 0.004 && Math.abs(this.band[b * 4]) < 0.004), collar);
  }
  n0 = 0;
  /** The collar as its own piece: the neck edge walked into one ordered loop, resampled evenly and smoothed (so its
   *  width and height are even whatever the triangles did), then a profile swept along it. Skinned like the nearest edge point. */
  addCollar(edges: [number, number][], c: { kind?: CollarKind; h: number; out: number; fold?: number; neck: V3 }) {
    if (edges.length < 4) return;
    const adj = new Map<string, Set<string>>(), rep = new Map<string, number>();
    for (const [a, b] of edges) {
      const ka = this.wid[a], kb = this.wid[b];
      if (!adj.has(ka)) adj.set(ka, new Set()); if (!adj.has(kb)) adj.set(kb, new Set());
      adj.get(ka)!.add(kb); adj.get(kb)!.add(ka); rep.set(ka, a); rep.set(kb, b);
    }
    // walk the longest path from the back of the neck (lowest z) both ways
    let start = Array.from(rep.keys())[0];
    for (const k of Array.from(rep.keys())) if (this.pos[rep.get(k)! * 3 + 2] < this.pos[rep.get(start)! * 3 + 2]) start = k;
    const walk = (from: string, not: Set<string>) => { const out: string[] = []; let cur: string | undefined = from; while (cur) { out.push(cur); not.add(cur); cur = Array.from(adj.get(cur) ?? []).find((n) => !not.has(n)); } return out; };
    const seen = new Set<string>([start]);
    const nb = Array.from(adj.get(start) ?? []);
    const left = nb[0] ? walk(nb[0], seen) : [], right = nb[1] ? walk(nb[1], seen) : [];
    const chain = [...left.reverse(), start, ...right].map((k) => rep.get(k)!);
    const closed = chain.length > 6 && (adj.get(this.wid[chain[0]])?.has(this.wid[chain[chain.length - 1]]) ?? false);
    // resample by arc length, then smooth (the cut edge zigzags a little across triangles)
    const P = chain.map((i) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]);
    if (closed) { P.push(P[0]); chain.push(chain[0]); }
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    const N = Math.max(12, Math.round(L[L.length - 1] / 0.006));
    let S: { p: number[]; src: number }[] = [];
    for (let k = 0; k <= N; k++) {
      const t = (L[L.length - 1] * k) / N; let i = 1; while (i < L.length - 1 && L[i] < t) i++;
      const u = (t - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      S.push({ p: [0, 1, 2].map((q) => P[i - 1][q] + (P[i][q] - P[i - 1][q]) * u), src: u < 0.5 ? chain[i - 1] : chain[i] });
    }
    for (let it = 0; it < 4; it++) S = S.map((s, k) => {
      const a = S[k - 1] ?? (closed ? S[S.length - 2] : s), b = S[k + 1] ?? (closed ? S[1] : s);
      return { p: s.p.map((v, q) => v * 0.5 + (a.p[q] + b.p[q]) * 0.25), src: s.src };
    });
    const kind = c.kind ?? "crew";
    const C = c.neck;
    const rows: number[][] = [];
    for (const s of S) {
      const [x, y, z] = s.p;
      let ix = C[0] - x, iz = C[2] - z; const hl = Math.hypot(ix, iz) || 1; ix /= hl; iz /= hl;
      const front = Math.max(0, Math.min(1, (z - C[2]) / 0.06));
      const n = [this.nor[s.src * 3], this.nor[s.src * 3 + 1], this.nor[s.src * 3 + 2]];
      const pts: number[][] = [[x, y, z]];
      const lapelZone = kind === "lapel" && front > 0.45;
      if (kind === "hood") {
        // a hood lying down: a rounded pouch that rises behind the neck and rests on the upper back
        const back = Math.max(0, Math.min(1, (C[2] - z) / 0.045)), r = 0.045 * back + 0.003;
        for (const th of [0.5, 1.1, 1.7, 2.3, 2.9]) pts.push([x - ix * r * (1 - Math.cos(th)) * 1.2, y + r * Math.sin(th) * 1.1 - (th > 2 ? 0.02 * back * (th - 2) : 0), z - iz * r * (1 - Math.cos(th)) * 1.2]);
        pts.push([x - ix * r * 2.1, y - 0.11 * back, z - iz * r * 2.1]);
      } else if (lapelZone) {
        // a lapel: lies open on the coat, outward from the V edge, widest at the top, nothing at the V's foot
        const side = Math.sign(x - C[0]) || 1;
        const wl = (c.fold ?? 0.05) * Math.max(0, Math.min(1, (y - (C[1] - 0.32)) / 0.12));
        pts.push([x + side * wl + n[0] * 0.007, y + 0.012 + n[1] * 0.007, z + n[2] * 0.007 - wl * 0.25]);
      } else {
        const lean = kind === "crew" ? c.out : c.out * 0.5;
        const top = [x + ix * lean, y + c.h, z + iz * lean];
        pts.push(top);
        if (kind === "shirt" || kind === "polo" || kind === "lapel") {
          const w = (c.fold ?? 0.012) * (kind === "lapel" ? 0.6 : 1) + (kind === "shirt" ? 0.018 * front * front : 0.006 * front);
          const drop = kind === "shirt" ? 0.02 * front * front : 0.005 * front;
          pts.push([top[0] - ix * w, top[1] - c.h * 0.95 - drop, top[2] - iz * w + 0.004 * front]);
        }
      }
      const row: number[] = [];
      for (const q of pts) { const d = this.dup(s.src); this.pos[d * 3] = q[0]; this.pos[d * 3 + 1] = q[1]; this.pos[d * 3 + 2] = q[2]; this.band[d * 4] = 0.5; this.lip[d] = 0; row.push(d); }
      row.push(front);
      rows.push(row);
    }
    const gap = kind === "shirt" ? 0.012 : kind === "polo" ? 0.006 : 0;
    for (let k = 0; k + 1 < rows.length; k++) {
      const A = rows[k], B = rows[k + 1];
      const cols = Math.min(A.length, B.length) - 1;
      // the shirt collar opens at the front: no quad across the middle
      if (gap && A[A.length - 1] > 0.6 && Math.abs(this.pos[A[0] * 3] - C[0]) < gap && Math.abs(this.pos[B[0] * 3] - C[0]) < gap) continue;
      for (let r = 0; r + 1 < cols; r++) this.ind.push(A[r], B[r], A[r + 1], A[r + 1], B[r], B[r + 1]);
    }
  }
  /** A tie down the centre front, laid on this garment's outer surface (skinned like the surface under it). */
  addTie(t: { top: number; bottom: number; w: number }) {
    const rows: number[][] = [];
    const steps = Math.max(6, Math.round((t.top - t.bottom) / 0.012));
    for (let k = 0; k <= steps; k++) {
      const y = t.top - ((t.top - t.bottom) * k) / steps;
      let best = -1, bz = -1e9;
      for (let i = 0; i < this.n0; i++) { const px = this.pos[i * 3], py = this.pos[i * 3 + 1], pz = this.pos[i * 3 + 2]; if (Math.abs(px) < 0.03 && Math.abs(py - y) < 0.012 && pz > bz) { bz = pz; best = i; } }
      if (best < 0) continue;
      const f = k / steps;
      const w = k === 0 ? t.w * 0.9 : k === 1 ? t.w * 0.55 : f > 0.96 ? 0.001 : t.w * (0.6 + 0.6 * f);
      const z = bz + 0.006, row: number[] = [];
      for (const sx of [-1, 1]) { const d = this.dup(best); this.pos[d * 3] = sx * w; this.pos[d * 3 + 1] = y; this.pos[d * 3 + 2] = z; this.nor[d * 3] = 0; this.nor[d * 3 + 1] = 0; this.nor[d * 3 + 2] = 1; this.band[d * 4] = -1; this.band[d * 4 + 3] = 0.5; this.lip[d] = 0; row.push(d); }
      rows.push(row);
    }
    for (let k = 0; k + 1 < rows.length; k++) this.ind.push(rows[k][0], rows[k + 1][0], rows[k][1], rows[k][1], rows[k + 1][0], rows[k + 1][1]);
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

/** A lanyard and pass: two straps from the neck to a card (drawn sharp, laid on the shirt front). */
export function lanyardTexture(T: Three, strap: string, word: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 768;
  const x = c.getContext("2d")!;
  x.strokeStyle = strap; x.lineWidth = 26; x.lineCap = "round";
  x.beginPath(); x.moveTo(40, 0); x.lineTo(236, 430); x.moveTo(472, 0); x.lineTo(276, 430); x.stroke();
  x.fillStyle = "#fafafa"; x.strokeStyle = "#9aa3ad"; x.lineWidth = 6;
  x.fillRect(146, 420, 220, 300); x.strokeRect(146, 420, 220, 300);
  x.fillStyle = strap; x.fillRect(146, 420, 220, 80);
  x.fillStyle = "#ffffff"; x.font = "bold 54px Arial, sans-serif"; x.textAlign = "center"; x.fillText(word, 256, 480);
  x.fillStyle = "#c9ced6"; x.fillRect(176, 530, 80, 100); x.fillStyle = "#6b7280"; x.fillRect(270, 545, 70, 14); x.fillRect(270, 575, 70, 14); x.fillRect(270, 605, 50, 14);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** A zip down the front: a line in the trim colour with a pull at the top. */
export function zipTexture(T: Three, col: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 1024;
  const x = c.getContext("2d")!;
  x.fillStyle = col; x.fillRect(26, 0, 12, 1024); x.fillRect(18, 10, 28, 60);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Every garment's geometry in one, with `aGarment` (its slot) on each vertex. */
function mergeGarments(T: Three, geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ["position", "normal", "uv", "skinIndex", "skinWeight", "aRest", "aBand", "aLip"];
  const out: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const gid: number[] = [], ind: number[] = [];
  let base = 0;
  geos.forEach((g, k) => {
    for (const n of names) { const a = g.getAttribute(n).array as ArrayLike<number>, o = out[n]; for (let i = 0; i < a.length; i++) o.push(a[i]); }
    const cnt = g.getAttribute("position").count;
    for (let i = 0; i < cnt; i++) gid.push(k);
    for (const i of Array.from(g.index!.array as ArrayLike<number>)) ind.push(i + base);
    base += cnt;
  });
  const m = new T.BufferGeometry();
  const size: Record<string, number> = { position: 3, normal: 3, uv: 2, skinIndex: 4, skinWeight: 4, aRest: 3, aBand: 4, aLip: 1 };
  for (const n of names) m.setAttribute(n, n === "skinIndex" ? new T.Uint16BufferAttribute(out[n], 4) : new T.Float32BufferAttribute(out[n], size[n]));
  m.setAttribute("aGarment", new T.Float32BufferAttribute(gid, 1));
  m.setIndex(ind);
  return m;
}
