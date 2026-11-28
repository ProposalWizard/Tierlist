/**
 * THE WALK BENCH, shared parts (Harry, Nov 2026: "legs like squeezing past each other", "the feet still seem
 * abnormally close together", "the quality is like jittering"). Node only, no browser, no GPU:
 *   - loadAll():   the real people file, the real clip files, as the game loads them (textures stripped)
 *   - person():    one Style A man, any head and build, dressed in his kit cloth (the shorts and socks count)
 *   - snapshot():  every vertex of his body and his cloth where the clip puts it at time t, with which part
 *                  of him it is (left leg, right leg, torso, arms, head)
 *   - measures:    feet spacing, leg clearance (signed: inside the other leg = overlap), foot slide, jitter,
 *                  arm clearance
 *   - render():    a flat-shaded picture (orthographic: no lens, sizes true) from the front, back or side,
 *                  left leg blue, right leg orange, so a leg passing through the other is plain to see
 * Used by scripts/walk3d/measure.mts and tests/star/gaitWidth.mts.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { loadPeople3d, makePerson3d, type Person3D } from "../../lib/star/people3d";
import { addClips, clipInfo, loadAnims3d } from "../../lib/star/three3d/footballAnims";
import { dressCloth } from "../../lib/star/style3d/toon/clothes";
import type { ToonBody, ToonHead } from "../../lib/star/style3d/toon/bodies";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

function strip(raw: Buffer): ArrayBuffer {
  const jl = raw.readUInt32LE(12);
  const js = JSON.parse(raw.subarray(20, 20 + jl).toString());
  delete js.textures; delete js.images; delete js.samplers;
  for (const m of js.materials ?? []) { delete m.occlusionTexture; delete m.normalTexture; delete m.emissiveTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } }
  js.extensionsUsed = (js.extensionsUsed ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  js.extensionsRequired = (js.extensionsRequired ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  const jb = Buffer.from(JSON.stringify(js)); const pad = Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20);
  const rest = raw.subarray(20 + jl);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + pad.length + rest.length, 8); head.writeUInt32LE(jb.length + pad.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([head, jb, pad, rest]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
}
export const nodeLoader = {
  setMeshoptDecoder() { return this; },
  async loadAsync(url: string) {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder as never);
    return new Promise((res, rej) => l.parse(strip(readFileSync("public" + url.split("?")[0])), "", res, rej));
  },
};

export interface Files { anims: GLTF; fb: GLTF }
export async function loadAll(): Promise<Files> {
  const anims = await loadPeople3d(nodeLoader as never, "anims", "new");
  const fb = await loadAnims3d(nodeLoader as never, "football");
  return { anims, fb };
}

const modelCache = new Map<string, GLTF>();
export interface Man { p: Person3D; meshes: THREE.SkinnedMesh[]; parts: Int8Array[]; k: number; head: ToonHead; build: ToonBody }
/** Parts: 0 torso, 1 left leg, 2 right leg, 3 left forearm+hand, 4 right forearm+hand, 5 head/neck, 6 / 7 upper arms. */
export const PART_NAMES = ["torso", "left leg", "right leg", "left forearm", "right forearm", "head", "left upper arm", "right upper arm"];
function partOf(bone: string): number {
  if (/^Left(UpLeg|Leg|Foot|ToeBase|Toe)/.test(bone)) return 1;
  if (/^Right(UpLeg|Leg|Foot|ToeBase|Toe)/.test(bone)) return 2;
  if (/^Left(ForeArm|Hand)/.test(bone)) return 3;
  if (/^Right(ForeArm|Hand)/.test(bone)) return 4;
  if (/^LeftArm/.test(bone)) return 6;
  if (/^RightArm/.test(bone)) return 7;
  if (/^(neck|Neck|Head|head)/.test(bone)) return 5;
  return 0;
}
export async function person(F: Files, head: ToonHead, build: ToonBody, cloth = true, who = "walk-bench"): Promise<Man> {
  let model = modelCache.get(head);
  if (!model) { model = await loadPeople3d(nodeLoader as never, "player", "new", [head]); modelCache.set(head, model); }
  const p = makePerson3d(THREE, SkeletonUtils as never, model, F.anims, { who: `${who}-${head}`, toonHead: head, toonBody: build, outline: 0 } as never);
  addClips(THREE, p, F.fb);
  if (cloth) { try { dressCloth(THREE, p, "kit", "walk-bench"); } catch { /* painted kit */ } }
  const meshes: THREE.SkinnedMesh[] = [];
  p.root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && (m.name === "Body" || m.name === "Cloth")) meshes.push(m); });
  const parts = meshes.map((m) => {
    const si = m.geometry.getAttribute("skinIndex"), sw = m.geometry.getAttribute("skinWeight");
    const names = m.skeleton.bones.map((b) => b.name);
    const out = new Int8Array(si.count);
    for (let i = 0; i < si.count; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } out[i] = partOf(names[best] ?? ""); }
    return out;
  });
  const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
  const k = hipsRest / ((F.fb.scene.userData as { hipsY?: number }).hipsY || hipsRest);
  return { p, meshes, parts, k, head, build };
}

/** Put the man in one clip at time t (every other action off; bones back at rest first). */
export function pose(m: Man, clip: string, t: number) {
  const p = m.p;
  for (const a of Object.values(p.actions)) a.stop();
  p.rest.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
  const a = p.actions[clip]; a.enabled = true; a.play(); a.setEffectiveWeight(1); a.time = Math.max(1e-4, Math.min(t, a.getClip().duration - 1e-4));
  p.mixer.update(0); p.root.updateMatrixWorld(true);
  for (const me of m.meshes) me.skeleton.update();
}
export const dur = (m: Man, clip: string) => m.p.actions[clip].getClip().duration;
export const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

export interface Snap { pos: Float32Array[]; nrm: Float32Array[]; idx: (ArrayLike<number> | null)[] }
/** Every vertex (body + cloth), world metres, and its normal. */
export function snapshot(m: Man): Snap {
  const v = new THREE.Vector3();
  const pos: Float32Array[] = [], nrm: Float32Array[] = [], idx: (ArrayLike<number> | null)[] = [];
  for (const me of m.meshes) {
    const n = me.geometry.getAttribute("position").count;
    const P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { me.getVertexPosition(i, v).applyMatrix4(me.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const ix = me.geometry.index ? me.geometry.index.array : null;
    const N = new Float32Array(n * 3);
    const tri = ix ? ix.length / 3 : n / 3;
    for (let t = 0; t < tri; t++) {
      const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      for (const q of [a, b, c]) { N[q * 3] += nx; N[q * 3 + 1] += ny; N[q * 3 + 2] += nz; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
    pos.push(P); nrm.push(N); idx.push(ix);
  }
  return { pos, nrm, idx };
}

/**
 * Nearest approach of part A's skin to part B's, signed: negative = A's skin is INSIDE B (an overlap, metres).
 * Only vertices with y in [y0, y1]. A grid of 3 cm cells keeps it quick.
 */
export function clearance(m: Man, s: Snap, A: number[], B: number[], y0 = -1, y1 = 9, mesh = -1): { near: number; inside: number; at: number[] } {
  const cell = 0.03, key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, [number, number][]>();
  s.pos.forEach((P, mi) => { if (mesh >= 0 && mi !== mesh) return; const pt = m.parts[mi]; for (let i = 0; i < pt.length; i++) if (B.includes(pt[i]) && P[i * 3 + 1] >= y0 && P[i * 3 + 1] <= y1) { const k = key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); let g = grid.get(k); if (!g) grid.set(k, (g = [])); g.push([mi, i]); } });
  let near = 9, inside = 0, at: number[] = [];
  s.pos.forEach((P, mi) => {
    if (mesh >= 0 && mi !== mesh) return;
    const pt = m.parts[mi];
    for (let i = 0; i < pt.length; i++) {
      if (!A.includes(pt[i])) continue;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (y < y0 || y > y1) continue;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let bd = 9, bm = -1, bi = -1;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const g = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!g) continue;
        for (const [qm, qi] of g) { const Q = s.pos[qm]; const d = Math.hypot(Q[qi * 3] - x, Q[qi * 3 + 1] - y, Q[qi * 3 + 2] - z); if (d < bd) { bd = d; bm = qm; bi = qi; } }
      }
      if (bm < 0) continue;
      const Q = s.pos[bm], Nn = s.nrm[bm];
      const sd = (x - Q[bi * 3]) * Nn[bi * 3] + (y - Q[bi * 3 + 1]) * Nn[bi * 3 + 1] + (z - Q[bi * 3 + 2]) * Nn[bi * 3 + 2];
      if (bd < near) near = bd;
      // inside: on the inner side of B's nearest surface point, by more than 3 mm (cloth sits a few mm off skin)
      if (sd < -0.003 && bd < 0.04 && -sd > inside) { inside = -sd; at = [x, y, z, mi, i]; }
    }
  });
  return { near, inside, at };
}

// ── pictures ─────────────────────────────────────────────────────────────────────────────────────────────
export type View = "front" | "back" | "side";
const COLS: [number, number, number][] = [[205, 205, 200], [70, 120, 235], [240, 140, 40], [160, 200, 160], [200, 160, 200], [225, 190, 165], [160, 200, 160], [200, 160, 200]];
export class Img {
  d: Uint8Array;
  constructor(public w: number, public h: number, bg = 250) { this.d = new Uint8Array(w * h * 3).fill(bg); }
  px(x: number, y: number, c: [number, number, number]) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 3; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; }
  line(x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); }
  rect(x: number, y: number, w: number, h: number, c: [number, number, number]) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  blit(o: Img, x: number, y: number) { for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) { const s = (j * o.w + i) * 3; this.px(x + i, y + j, [o.d[s], o.d[s + 1], o.d[s + 2]]); } }
  text(s: string, x: number, y: number, c: [number, number, number] = [30, 30, 30], k = 2) {
    for (const ch of s.toUpperCase()) { const g = FONT[ch] ?? FONT["?"]; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if ((g[r] >> (4 - q)) & 1) this.rect(x + q * k, y + r * k, k, k, c); x += 6 * k; }
  }
  save(file: string) { writeFileSync(file, png(this.w, this.h, this.d)); }
}
/** One frame of the man, flat shaded, orthographic. pxm = pixels per metre; the floor at y = 0. */
export function render(m: Man, s: Snap, view: View, W: number, H: number, pxm: number, cx: number, cz: number, marks = true): Img {
  const img = new Img(W, H);
  const zb = new Float32Array(W * H).fill(-1e9);
  const proj = (x: number, y: number, z: number): [number, number, number] => {
    const sx = view === "front" ? x - cx : view === "back" ? -(x - cx) : -(z - cz);
    const dp = view === "front" ? z : view === "back" ? -z : x;
    return [W / 2 + sx * pxm, H - 14 - y * pxm, dp];
  };
  // floor
  const fy = H - 14;
  img.rect(0, fy, W, 14, [228, 226, 218]);
  for (let gx = -2; gx <= 2; gx += 0.1) { const X = W / 2 + gx * pxm; img.line(X, fy, X, fy + 3, [190, 188, 180]); }
  const L = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
  const lv = view === "front" ? L : view === "back" ? new THREE.Vector3(-L.x, L.y, -L.z) : new THREE.Vector3(L.z, L.y, -L.x);
  s.pos.forEach((P, mi) => {
    const ix = s.idx[mi]; const pt = m.parts[mi];
    const tri = ix ? ix.length / 3 : P.length / 9;
    for (let t = 0; t < tri; t++) {
      const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
      const A = proj(P[a * 3], P[a * 3 + 1], P[a * 3 + 2]), B = proj(P[b * 3], P[b * 3 + 1], P[b * 3 + 2]), C = proj(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]);
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
      const n = new THREE.Vector3(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx).normalize();
      const sh = 0.45 + 0.55 * Math.abs(n.dot(lv));
      const col = COLS[pt[a]];
      const cc: [number, number, number] = [col[0] * sh, col[1] * sh, col[2] * sh];
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den;
        const l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const z = l1 * A[2] + l2 * B[2] + l3 * C[2];
        const o = y * W + x;
        if (z > zb[o]) { zb[o] = z; img.px(x, y, cc); }
      }
    }
  });
  if (marks) {
    // ink edge where depth jumps (an outline, like the game's)
    const out = new Uint8Array(img.d);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const o = y * W + x, z = zb[o];
      const e = Math.max(Math.abs(z - zb[o - 1]), Math.abs(z - zb[o + 1]), Math.abs(z - zb[o - W]), Math.abs(z - zb[o + W]));
      if (e > 0.04 && (z > -1e8 || zb[o - 1] > -1e8 || zb[o + 1] > -1e8)) { out[o * 3] = 25; out[o * 3 + 1] = 25; out[o * 3 + 2] = 30; }
    }
    img.d = out;
  }
  return img;
}

// ── a tiny 5x7 font for labels ───────────────────────────────────────────────────────────────────────────
const FONT: Record<string, number[]> = {
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14], "2": [14, 17, 1, 2, 4, 8, 31], "3": [30, 1, 1, 14, 1, 1, 30], "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14], "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8], "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 2, 12],
  ".": [0, 0, 0, 0, 0, 12, 12], " ": [0, 0, 0, 0, 0, 0, 0], "-": [0, 0, 0, 31, 0, 0, 0], ":": [0, 12, 12, 0, 12, 12, 0], "/": [1, 1, 2, 4, 8, 16, 16], "%": [24, 25, 2, 4, 8, 19, 3],
  "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8], "_": [0, 0, 0, 0, 0, 0, 31], "+": [0, 4, 4, 31, 4, 4, 0], "=": [0, 0, 31, 0, 31, 0, 0], ",": [0, 0, 0, 0, 12, 4, 8], "?": [14, 17, 1, 2, 4, 0, 4],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
};

// ── PNG ──────────────────────────────────────────────────────────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(b: Buffer) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
export function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export { THREE, clipInfo };
