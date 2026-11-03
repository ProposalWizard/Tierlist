/**
 * lib/star/three3d/realBall.ts — the one 3D football: a real black-and-white
 * ball, 12 black pentagons and 20 white hexagons with thin dark seams
 * (a truncated icosahedron blown up onto a sphere).
 *
 * Harry, 1 Nov 2026 (live share): the old ball was a white sphere with six
 * black dots stuck on, "so unrealistic … why hasn't [it] just created a model
 * which has the exact pattern of a regular black and white football".
 *
 * One sphere, one material, one draw call. The pattern is painted once into a
 * shared picture (equirectangular, exact per pixel: each pixel is the panel
 * whose flat face the ray from the centre meets first), then every ball reuses it.
 */
import type * as THREE from "three";

type Three = typeof import("three");
type V = [number, number, number];

const norm = (v: V): V => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The 32 panels: unit normal, distance of the flat face from the centre, and kind. */
function panels(): { n: V; d: number; black: boolean }[] {
  const p = (1 + Math.sqrt(5)) / 2;
  const ico: V[] = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    ico.push([0, s1, s2 * p], [s1, s2 * p, 0], [s2 * p, 0, s1]);
  }
  // icosahedron faces: triples of vertices all at edge length 2
  const faces: [number, number, number][] = [];
  const edge = (i: number, j: number) => Math.abs(Math.hypot(ico[i][0] - ico[j][0], ico[i][1] - ico[j][1], ico[i][2] - ico[j][2]) - 2) < 1e-6;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (edge(i, j) && edge(j, k) && edge(i, k)) faces.push([i, j, k]);
  }
  // A truncated-icosahedron vertex: one third of the way along an edge.
  const a = ico[0], b = ico[faces.find((f) => f.includes(0))!.find((x) => x !== 0)!];
  const tv: V = [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[2] + (b[2] - a[2]) / 3];
  const pentN = norm(a);
  const dPent = dot(tv, pentN);
  const f0 = faces.find((f) => f.includes(0) && f.includes(ico.indexOf(b)))!;
  const hexN = norm([0, 1, 2].map((q) => (ico[f0[0]][q] + ico[f0[1]][q] + ico[f0[2]][q]) / 3) as V);
  const dHex = dot(tv, hexN);
  return [
    ...ico.map((v) => ({ n: norm(v), d: dPent, black: true })),
    ...faces.map((f) => ({ n: norm([0, 1, 2].map((q) => ico[f[0]][q] + ico[f[1]][q] + ico[f[2]][q]) as V), d: dHex, black: false })),
  ];
}

let shared: HTMLCanvasElement | null = null;

/** The ball's picture, painted once (1024 × 512, wrapped round a sphere). */
export function realBallCanvas(): HTMLCanvasElement {
  if (shared) return shared;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const img = x.createImageData(W, H);
  const P = panels();
  for (let py = 0; py < H; py++) {
    // three.js SphereGeometry: v = 1 at the top (+y); phi runs round from -x
    const theta = ((py + 0.5) / H) * Math.PI;
    const y = Math.cos(theta), sr = Math.sin(theta);
    for (let px = 0; px < W; px++) {
      const phi = ((px + 0.5) / W) * Math.PI * 2;
      const dir: V = [-Math.cos(phi) * sr, y, Math.sin(phi) * sr];
      // the face the ray meets first has the largest dot/d
      let best = -1, second = -1, bi = 0;
      for (let i = 0; i < P.length; i++) {
        const s = dot(dir, P[i].n) / P[i].d;
        if (s > best) { second = best; best = s; bi = i; } else if (s > second) second = s;
      }
      const gap = (best - second) / best; // 0 on a seam
      const seam = Math.min(1, gap / 0.012);
      const black = P[bi].black;
      // panel colour, a touch of curve shading towards its edges, dark seam
      const base = black ? 30 : 246;
      const edgeShade = black ? 0 : Math.round((1 - Math.min(1, gap / 0.08)) * 14);
      const v = Math.round((base - edgeShade) * seam + 40 * (1 - seam));
      const o = (py * W + px) * 4;
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = black ? v + 3 : v - 2; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  shared = c;
  return c;
}

/** A real football of `radius` metres. One mesh; `dispose()` frees its geometry, material and texture copy. */
export function makeRealBall(T: Three, radius = 0.11, opts: { roughness?: number; segments?: number } = {}): THREE.Mesh & { dispose(): void } {
  const tex = new T.CanvasTexture(realBallCanvas());
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new T.MeshStandardMaterial({ map: tex, roughness: opts.roughness ?? 0.42 });
  const seg = opts.segments ?? 32;
  const mesh = new T.Mesh(new T.SphereGeometry(radius, seg, Math.round(seg * 0.75)), mat) as unknown as THREE.Mesh & { dispose(): void };
  mesh.dispose = () => { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); };
  return mesh;
}
