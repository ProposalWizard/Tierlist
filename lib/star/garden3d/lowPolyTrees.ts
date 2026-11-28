/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOW-POLY TREES (Harry, 28 Nov 2026: "this damn tree feature, I hate it. There must be a way to
 * have low polygon trees and leaves"). The garden's trees were crowns of ~340 flat leaf pictures
 * each (680 triangles a tree, 83 trees, 14 instanced draws of see-through cards): noisy up close,
 * and on an Android phone every see-through card is drawn pixel by pixel. Here a tree is a few
 * chunky clumps of leaves in solid geometry, painted in vertex colours (light on top and outside,
 * dark underneath and inside), on a tapered trunk. No pictures, nothing see-through.
 *
 *   clump  round, softly lit clumps (a crown that reads as a whole, lumps that read as leaf masses)
 *   facet  the same clumps with hard flat facets (classic "low poly" art)
 *   leafy  the clumps plus single folded leaves standing out round the edge (real leaf shapes)
 *
 * Each kind has three detail levels (`lod` 0 near, 1 middle, 2 far), so a far tree costs ~60
 * triangles and a near one ~400. Every tree and bush uses ONE shared material, so a whole zone of
 * them is one draw (./plantZones.ts). Sizes: a tree is `h` tall and `w` wide in the same units the
 * Kenney tree it replaces had, so every placement stays exactly where and how big it was.
 */

export type TreeStyle = "clump" | "facet" | "leafy";
export type TreeShape = "round" | "wide" | "tall" | "pine";
export type Lod = 0 | 1 | 2;

/** The style the game uses (picked from the three candidates, 28 Nov 2026): facet. At phone size its hard
 *  facets read as clusters of leaves catching the light; the soft "clump" read as smooth green blobs
 *  up close, and the single leaves of "leafy" were too small to see from the walking camera. */
export const TREE_STYLE: TreeStyle = "facet";

export interface TreeSpec { h: number; w: number; shape: TreeShape; seed: number; style: TreeStyle; lod: Lod; light?: string; dark?: string }

/** A geometry being built: plain arrays (position, normal, colour), every triangle its own three corners. */
export interface Bin { p: number[]; n: number[]; c: number[] }
export const newBin = (): Bin => ({ p: [], n: [], c: [] });

/** A tiny seeded random. */
export function rand(seed: number) {
  let s = (Math.floor(Math.abs(seed) * 2654435761) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** Same spot → same number (so corners shared by two faces move together and the clump stays closed). */
function hash3(x: number, y: number, z: number, seed: number) {
  const k = Math.sin(Math.round(x * 1000) * 12.9898 + Math.round(y * 1000) * 78.233 + Math.round(z * 1000) * 37.719 + seed * 4.1414) * 43758.5453;
  return k - Math.floor(k);
}

/** The corners of a unit icosahedron, subdivided `detail` times (0: 20 faces, 1: 80), as a triangle list. */
const icoCache = new Map<number, number[][]>();
function ico(detail: number): number[][] {
  const hit = icoCache.get(detail);
  if (hit) return hit;
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const norm = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  let tris: number[][][] = f.map(([a, b, c]) => [norm(v[a]), norm(v[b]), norm(v[c])]);
  for (let d = 0; d < detail; d++) {
    const next: number[][][] = [];
    for (const [a, b, c] of tris) {
      const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
      const bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]);
      const ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  const out = tris.flat();
  icoCache.set(detail, out);
  return out;
}

const lin = (T: any, hex: string) => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * One clump of leaves: a lumpy ball at (cx, cy, cz), radii (rx, ry, rz). Its light: `soft` bends
 * each corner's normal out from the crown's middle (cc), so the crown reads round; `flat` keeps
 * each face's own (facets). Colour from dark (low, inside) to light (high, outside).
 */
function clump(T: any, out: Bin, o: {
  c: number[]; r: number[]; detail: number; seed: number; flat: boolean; cc: number[]; crownR: number[];
  light: number[]; dark: number[]; jitter: number; bump: number; round?: number;
}) {
  const V = ico(o.detail);
  const pts: number[][] = V.map(([x, y, z]) => {
    const k = 1 + (hash3(x, y, z, o.seed) - 0.5) * 2 * o.bump;
    return [o.c[0] + x * o.r[0] * k, o.c[1] + y * o.r[1] * k * 0.92, o.c[2] + z * o.r[2] * k];
  });
  for (let i = 0; i < pts.length; i += 3) {
    const a = pts[i], b = pts[i + 1], c = pts[i + 2];
    // face normal
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k], s = V[i + k];
      out.p.push(p[0], p[1], p[2]);
      if (o.flat) out.n.push(fx, fy, fz);
      else {
        // out from the crown's middle (round crown) mixed with out from the clump (its lump)
        const cx = (p[0] - o.cc[0]) / o.crownR[0], cy = (p[1] - o.cc[1]) / o.crownR[1] + 0.2, cz = (p[2] - o.cc[2]) / o.crownR[2];
        const cl = Math.hypot(cx, cy, cz) || 1;
        const w = o.round ?? 0.55;
        let nx = w * cx / cl + (1 - w) * s[0], ny = w * cy / cl + (1 - w) * s[1], nz = w * cz / cl + (1 - w) * s[2];
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        out.n.push(nx, ny, nz);
      }
      // light on top and on the outside of the crown; a little per-corner variation (leaf masses)
      const up = clamp01((p[1] - (o.cc[1] - o.crownR[1])) / (2 * o.crownR[1]));
      const outward = clamp01(Math.hypot((p[0] - o.cc[0]) / o.crownR[0], (p[2] - o.cc[2]) / o.crownR[2], (p[1] - o.cc[1]) / o.crownR[1]));
      const tone = clamp01(0.15 + 0.55 * up + 0.35 * outward + (hash3(s[0], s[1], s[2], o.seed + 7) - 0.5) * o.jitter);
      const col = mix3(o.dark, o.light, tone);
      out.c.push(col[0], col[1], col[2]);
    }
  }
}

/** A tapered prism from `a` to `b` (radii ra → rb), `sides` faces, bark-coloured (darker at the foot). */
function limb(out: Bin, a: number[], b: number[], ra: number, rb: number, sides: number, colA: number[], colB: number[]) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const w = [d[0] / L, d[1] / L, d[2] / L];
  const ref = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  const ring = (c: number[], r: number, k: number) => { const t = (k / sides) * Math.PI * 2; const cs = Math.cos(t), sn = Math.sin(t); return [c[0] + (u[0] * cs + v[0] * sn) * r, c[1] + (u[1] * cs + v[1] * sn) * r, c[2] + (u[2] * cs + v[2] * sn) * r, u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn]; };
  for (let k = 0; k < sides; k++) {
    const p0 = ring(a, ra, k), p1 = ring(a, ra, k + 1), q0 = ring(b, rb, k), q1 = ring(b, rb, k + 1);
    for (const [P, col] of [[p0, colA], [q1, colB], [q0, colB], [p0, colA], [p1, colA], [q1, colB]] as [number[], number[]][]) {
      out.p.push(P[0], P[1], P[2]); out.n.push(P[3], P[4], P[5]); out.c.push(col[0], col[1], col[2]);
    }
  }
}

/** One leaf, folded along its midrib, both sides drawn: base at `at`, pointing along `dir`, `len` long. */
function leaf(out: Bin, at: number[], dir: number[], side: number[], len: number, col: number[], colBack: number[]) {
  const wd = len * 0.55;
  const tip = [at[0] + dir[0] * len, at[1] + dir[1] * len, at[2] + dir[2] * len];
  const mid = [at[0] + dir[0] * len * 0.45, at[1] + dir[1] * len * 0.45, at[2] + dir[2] * len * 0.45];
  // the halves fold up a little from the midrib (a V), so the leaf has a shape from the side too
  const n = [dir[1] * side[2] - dir[2] * side[1], dir[2] * side[0] - dir[0] * side[2], dir[0] * side[1] - dir[1] * side[0]];
  const L = [mid[0] - side[0] * wd + n[0] * wd * 0.35, mid[1] - side[1] * wd + n[1] * wd * 0.35, mid[2] - side[2] * wd + n[2] * wd * 0.35];
  const R = [mid[0] + side[0] * wd + n[0] * wd * 0.35, mid[1] + side[1] * wd + n[1] * wd * 0.35, mid[2] + side[2] * wd + n[2] * wd * 0.35];
  const push = (pts: number[][], nn: number[], c: number[]) => { for (const P of pts) { out.p.push(P[0], P[1], P[2]); out.n.push(nn[0], nn[1], nn[2]); out.c.push(c[0], c[1], c[2]); } };
  // lit like the crown it grows from (mostly along the leaf), a little by its own face
  const nl = (sg: number) => { const v = [dir[0] * 0.65 + sg * n[0] * 0.35, dir[1] * 0.65 + sg * n[1] * 0.35 + 0.2, dir[2] * 0.65 + sg * n[2] * 0.35]; const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const up = nl(1), down = nl(-1);
  push([at, L, tip], up, col); push([at, tip, R], up, col);
  push([at, tip, L], down, colBack); push([at, R, tip], down, colBack);
}

const PALETTE: Record<string, [string, string]> = {
  round: ["#79a844", "#2d5a24"],
  wide: ["#6b9a3c", "#294f21"],
  tall: ["#86b04f", "#33622a"],
  pine: ["#4f7d42", "#1c3f22"],
};
const BARK = ["#55402f", "#7d6148"];

/**
 * One tree into `out`, standing at the origin, `h` tall and `w` wide. Returns its triangle count.
 * LOD 0: ~350–450 triangles; LOD 1: ~110; LOD 2: ~50.
 */
export function addTree(T: any, out: Bin, o: TreeSpec): number {
  const before = out.p.length / 9;
  const r = rand(o.seed);
  const H = o.h, W = o.w;
  const [lightHex, darkHex] = [o.light ?? PALETTE[o.shape][0], o.dark ?? PALETTE[o.shape][1]];
  const light = lin(T, lightHex), dark = lin(T, darkHex);
  const barkA = lin(T, BARK[0]), barkB = lin(T, BARK[1]);
  const flat = o.style === "facet";
  if (o.shape === "pine") {
    // a fir: stacked tiers, each a cone with a jagged, drooping skirt; a thin trunk through them
    const tiers = o.lod === 0 ? 4 : o.lod === 1 ? 3 : 2;
    const sides = o.lod === 0 ? 9 : o.lod === 1 ? 7 : 5;
    limb(out, [0, -0.05 * H, 0], [0, H * 0.35, 0], W * 0.05, W * 0.035, o.lod === 2 ? 3 : 5, barkA, barkB);
    const base = H * 0.14;
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers;
      const y0 = base + (H - base) * f * 0.9;
      const top = Math.min(H, y0 + (H - base) * (1.25 / tiers + 0.12));
      const rad = (W * 0.5) * (1 - f * 0.78) * (0.95 + r() * 0.1);
      const tone0 = 0.25 + 0.6 * f, tone1 = 0.55 + 0.45 * f;
      const rot = r() * Math.PI;
      const rim = (k: number) => {
        const a = rot + (k / sides) * Math.PI * 2;
        const jag = k % 2 ? 0.8 : 1.0;
        return [Math.cos(a) * rad * jag, y0 - (k % 2 ? 0 : rad * 0.12), Math.sin(a) * rad * jag];
      };
      const apex = [0, top, 0];
      for (let k = 0; k < sides; k++) {
        const a = rim(k), b = rim(k + 1);
        const fn = (P: number[]) => { const l = Math.hypot(P[0], rad * 0.75, P[2]) || 1; return [P[0] / l, rad * 0.75 / l, P[2] / l]; };
        const cA = mix3(dark, light, tone0 + (k % 2 ? 0 : 0.08)), cB = mix3(dark, light, tone0 + (k % 2 ? 0.08 : 0)), cT = mix3(dark, light, tone1);
        if (flat) {
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = apex[0] - a[0], vy = apex[1] - a[1], vz = apex[2] - a[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          if (nx * (a[0] + b[0]) + nz * (a[2] + b[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
          for (const [P, c] of [[a, cA], [apex, cT], [b, cB]] as [number[], number[]][]) { out.p.push(...P); out.n.push(nx, ny, nz); out.c.push(...c); }
        } else {
          const na = fn(a), nb = fn(b);
          const nt = [(na[0] + nb[0]) * 0.3, 1, (na[2] + nb[2]) * 0.3]; const ntl = Math.hypot(nt[0], nt[1], nt[2]);
          out.p.push(...a, ...apex, ...b); out.n.push(...na, nt[0] / ntl, nt[1] / ntl, nt[2] / ntl, ...nb); out.c.push(...cA, ...cT, ...cB);
        }
        // the underside of the skirt (seen from below / the side): dark, facing down
        const under = [0, y0 + rad * 0.25, 0];
        const cU = mix3(dark, light, 0.05);
        out.p.push(...a, ...b, ...under); out.n.push(0, -1, 0, 0, -1, 0, 0, -1, 0); out.c.push(...cU, ...cU, ...cU);
      }
    }
    return out.p.length / 9 - before;
  }
  // ── a broadleaf: trunk, a few branches into the crown, clumps of leaves ──
  const tall = o.shape === "tall", wide = o.shape === "wide";
  const trunkTop = H * (tall ? 0.24 : wide ? 0.36 : 0.33 + r() * 0.05);
  const cw = W * (tall ? 0.5 : wide ? 0.66 : 0.6);
  // a crown no more than ~1.25x as tall as it is wide (a lollipop stretched tall reads as a shard); its top stays at H
  const ry = Math.min((H - trunkTop) * 0.5, cw * (tall ? 2.4 : 1.45));
  const cy = H - ry * 1.02;
  const crownR = [cw, ry, cw];
  const tr = W * 0.075;
  const sides = o.lod === 0 ? 6 : o.lod === 1 ? 5 : 3;
  const lean = [(r() - 0.5) * W * 0.06, cy, (r() - 0.5) * W * 0.06];
  limb(out, [0, -0.05 * H, 0], lean, tr, tr * 0.5, sides, barkA, barkB);
  if (o.lod === 0) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + r();
      const from = [lean[0] * 0.5, trunkTop + (cy - trunkTop) * (0.2 + r() * 0.3), lean[2] * 0.5];
      limb(out, from, [Math.cos(a) * crownR[0] * 0.5, cy + crownR[1] * (0.05 + r() * 0.2), Math.sin(a) * crownR[2] * 0.5], tr * 0.5, tr * 0.22, 4, barkA, barkB);
    }
  }
  const cc = [lean[0], cy, lean[2]];
  // clumps: one big core, the rest round the top and sides (none hanging under the crown).
  // Far away: fewer clumps, and their light taken more from the crown's middle (it reads round, not cut).
  const n = o.lod === 0 ? 5 : o.lod === 1 ? 3 : 1;
  const detail = o.lod === 2 ? 0 : 1;
  const round = o.lod === 0 ? 0.55 : o.lod === 1 ? 0.72 : 0.85;
  const bump = flat ? 0.18 : 0.1;
  clump(T, out, { c: [cc[0], cy - crownR[1] * 0.08, cc[2]], r: crownR.map((x) => x * (o.lod === 2 ? 0.95 : 0.76)), detail: 1, seed: o.seed, flat, cc, crownR, light, dark, jitter: 0.25, bump, round });
  const ga = Math.PI * (3 - Math.sqrt(5));
  const spots: number[][] = [];
  for (let k = 0; k < n - 1; k++) {
    const yy = 0.8 - (k / Math.max(1, n - 2)) * 1.0; // from the top down to just under the middle
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const a = k * ga + r() * 0.6;
    spots.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]);
  }
  spots.forEach(([x, y, z], k) => {
    const s = (o.lod === 0 ? 0.52 : 0.56) + r() * 0.1;
    const c = [cc[0] + x * crownR[0] * 0.52, cy + y * crownR[1] * 0.55, cc[2] + z * crownR[2] * 0.52];
    clump(T, out, { c, r: crownR.map((q) => q * s), detail, seed: o.seed + 11 * (k + 1), flat, cc, crownR, light, dark, jitter: 0.3, bump, round });
  });
  if (o.style === "leafy" && o.lod === 0) {
    // single leaves growing out of each clump's outer face: a real leaf outline round the crown's edge
    const balls = [{ c: [cc[0], cy - crownR[1] * 0.08, cc[2]], k: 0.76 }, ...spots.map(([x, y, z]) => ({ c: [cc[0] + x * crownR[0] * 0.52, cy + y * crownR[1] * 0.55, cc[2] + z * crownR[2] * 0.52], k: 0.57 }))];
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < 52; tries++) {
      const ball = balls[tries % balls.length];
      const u = [r() * 2 - 1, r() * 1.6 - 0.5, r() * 2 - 1];
      const ul = Math.hypot(u[0], u[1], u[2]); if (ul < 0.2 || ul > 1) continue;
      const d = [u[0] / ul, u[1] / ul, u[2] / ul];
      const at = [ball.c[0] + d[0] * crownR[0] * ball.k * 0.9, ball.c[1] + d[1] * crownR[1] * ball.k * 0.85, ball.c[2] + d[2] * crownR[2] * ball.k * 0.9];
      // only where it stands on the crown's outside (not buried between two clumps)
      const ox = (at[0] - cc[0]) / crownR[0], oy = (at[1] - cy) / crownR[1], oz = (at[2] - cc[2]) / crownR[2];
      if (Math.hypot(ox, oy, oz) < 0.72) continue;
      // the leaf lies on the clump, its tip drooping a little out and down (leaves hang; they do not bristle)
      const tg = [-d[0] * d[1], 1 - d[1] * d[1], -d[2] * d[1]];
      const dir0 = [d[0] * 0.55 - tg[0] * 0.7, d[1] * 0.55 - tg[1] * 0.7, d[2] * 0.55 - tg[2] * 0.7]; const dl = Math.hypot(dir0[0], dir0[1], dir0[2]) || 1; const dir = [dir0[0] / dl, dir0[1] / dl, dir0[2] / dl];
      const sd0 = [-dir[2] + (r() - 0.5) * 0.6, (r() - 0.5) * 0.4, dir[0]]; const sl = Math.hypot(sd0[0], sd0[1], sd0[2]) || 1; const side = [sd0[0] / sl, sd0[1] / sl, sd0[2] / sl];
      const tone = clamp01(0.62 + 0.3 * (oy + 0.5) + (r() - 0.5) * 0.25);
      leaf(out, at, dir, side, W * (0.11 + r() * 0.04), mix3(dark, light, tone), mix3(dark, light, tone * 0.7));
      placed++;
    }
  }
  return out.p.length / 9 - before;
}

/** A bush: three to five clumps on the ground, `rad` round. */
export function addBush(T: any, out: Bin, o: { x: number; z: number; s: number; seed: number; style: TreeStyle; lod: Lod; light?: string; dark?: string }) {
  const light = lin(T, o.light ?? "#6c9c40"), dark = lin(T, o.dark ?? "#24481d");
  const cc = [o.x, o.s * 0.42, o.z];
  const crownR = [o.s, o.s * 0.8, o.s];
  clump(T, out, { c: [o.x, o.s * 0.35, o.z], r: [o.s, o.s * 0.8, o.s], detail: o.lod === 0 ? 1 : 0, seed: o.seed, flat: o.style === "facet", cc, crownR, light, dark, jitter: 0.3, bump: o.style === "facet" ? 0.16 : 0.1 });
}

/** Translate / rotate / scale what was added to `out` since `from` (a placed tree). */
export function placeSince(out: Bin, from: number, x: number, y: number, z: number, s: number, ry: number) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (let i = from * 9; i < out.p.length; i += 3) {
    const px = out.p[i] * s, py = out.p[i + 1] * s, pz = out.p[i + 2] * s;
    out.p[i] = px * c + pz * sn + x; out.p[i + 1] = py + y; out.p[i + 2] = -px * sn + pz * c + z;
    const nx = out.n[i], nz = out.n[i + 2];
    out.n[i] = nx * c + nz * sn; out.n[i + 2] = -nx * sn + nz * c;
  }
}

/** The ONE material every low-poly tree and bush shares: vertex colours, a touch of light through the leaves. */
export function plantMaterial(T: any) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 });
  m.onBeforeCompile = (sh: any) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  {
    // a branch right against the camera (the walking camera backed into a crown at the edge of the
    // garden) thins out in a fine dither instead of filling the screen with one dark face
    float camD = length(vViewPosition);
    if (camD < 2.2) {
      float h = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
      if (h > (camD - 0.7) / 1.5) discard;
    }
  }`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
  {
    // leaves (green) let light through: the shaded side stays green, never black; bark (brown) does not
    float leafy = clamp((vColor.g - vColor.r) * 6.0, 0.0, 1.0);
    float lit = clamp(dot(reflectedLight.directDiffuse, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 1e-3), 0.0, 1.0);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.5, 0.72, 0.36) * (0.1 + 0.3 * (1.0 - lit)) * leafy;
  }`);
  };
  m.customProgramCacheKey = () => "lowpoly-plants-v2";
  m.userData.keep = true; // its own shader: never folded into another material (freezeStatic)
  return m;
}

/** A finished bin as a geometry. */
export function binGeometry(T: any, b: Bin) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(b.p, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(b.n, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(b.c, 3));
  g.computeBoundingSphere();
  return g;
}

/** Triangles of one tree of each shape and level (for the budget test and the README table). */
export function treeTriangles(T: any, style: TreeStyle = TREE_STYLE): Record<TreeShape, [number, number, number]> {
  const out: any = {};
  for (const shape of ["round", "wide", "tall", "pine"] as TreeShape[]) {
    out[shape] = [0, 1, 2].map((lod) => addTree(T, newBin(), { h: 1.6, w: 1.2, shape, seed: 7, style, lod: lod as Lod }));
  }
  return out;
}
