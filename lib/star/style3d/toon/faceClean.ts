/**
 * A CLEAN FACE FOR THE DRAWN FACE (people round 2, 21 Nov 2026).
 *
 * Harry on the mentor: "His face looks really odd. His beard isn't really on his face. It's like the new
 * face changes are just kind of morphing over previous stuff." The cause: every head file has a face
 * painted into its picture (eyes, brows, lips, stubble, a beard, the "older, lined" head's wrinkles and
 * creases), and the drawn face (faceIdShader.ts) painted over it in the shader, only on the front, and
 * kept some of the file's own light and dark (round the nose most of all). From any angle but straight
 * on, and at every crease, the file's old face showed through the new one: two faces.
 *
 * The fix is at the source. Before a person's drawn face goes on, his head's picture is swapped for a
 * CLEAN copy of the file's picture: every texel of the face (the front of the head from under the jaw to
 * the forehead, round to the ears) is one even skin colour and called skin in the mask; the scalp hair,
 * the ears, the clothes and everything below the collar are the file's own. Age then comes only from the
 * drawn system (lines, grey brows, the hair's own colour), never from a baked picture.
 *
 * Built once per head file (about 1024x1024 + 512x512 texels, a few tens of ms), shared by everyone who
 * wears that head with a drawn face; nothing per frame, no draw call. People without a drawn face (the
 * match, far crowds) keep the file's own picture as before.
 */
import type * as THREE from "three";
import type { Person3D } from "../../people3d";
import type { ToonFaceLandmarks } from "./faceLandmarks";

type Three = typeof THREE;

interface Clean { map: THREE.Texture; mask: THREE.Texture }
const CACHE = new Map<string, Clean | null>();
const DBG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("facecleandbg") === "1";
const DBG_C: Record<number, number[]> = { 1: [0, 255, 0], 0: [255, 0, 0], [-1]: [255, 128, 0], [-2]: [255, 0, 255], [-3]: [0, 0, 255], [-4]: [0, 255, 255], [-5]: [255, 255, 0], [-6]: [128, 0, 255], [-7]: [128, 128, 128] };

/** linear → sRGB 0..255 */
const srgb = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)));

function pixels(img: CanvasImageSource & { width: number; height: number }): { d: Uint8ClampedArray; w: number; h: number; cv: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined" || !img || !img.width) return null;
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0);
  return { d: g.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height, cv, g };
}

/**
 * Where the clean skin goes: 1 paint it even skin, 0 leave the file's own paint.
 * r: the point on the head (the file's rest pose, metres); m: the mask (kit, skin, hair 0..1); c: the file's colour 0..1.
 */
export function faceCleanAt(
  r: [number, number, number], m: [number, number, number], c: [number, number, number],
  F: { chinY: number; eyeY: number; browY: number; noseY: number; noseZ: number; headZ: number; neckZ: number; collarY: number },
): number {
  const [x, y, z] = r, ax = Math.abs(x);
  if (y < F.collarY + 0.008 || y > F.browY + 0.07) return -1;
  if (m[0] > 0.5) return -2;                                   // kit: the collar, the shirt
  const hair = m[2] > 0.5 && m[2] >= m[1];
  const mx = Math.max(c[0], c[1], c[2], 1e-4);
  const warm = (c[0] - c[2]) / mx;
  // under the jaw, down to the collar: the painted beard on the throat
  if (y < F.chinY + 0.004) {
    if (z < F.neckZ - 0.01) return -3;
    // (only the hair: the throat's skin texels are left to the suit rules, which tell the collar from skin by the file's paint)
    return hair && warm > -0.2 ? 1 : -4;
  }
  // the forehead: its skin even (the wrinkles drawn in the older head's picture), the hair kept
  if (y > F.browY + 0.016) return !hair && z > F.headZ - 0.02 && ax < 0.085 ? 1 : 0;
  // the ears keep their own paint (their shape is painted, not drawn)
  const ear = ax > 0.066 && z < F.headZ + 0.018 && y > F.noseY - 0.02 && y < F.browY + 0.012;
  if (ear && !hair) return -5;
  if (z < F.headZ - 0.03) return -6;                          // behind the ears: the scalp's own
  if (hair) {
    // the brows go (the drawn brows replace them); the hair at the temples, above the cheekbone, stays
    const brow = y > F.eyeY - 0.03 && ax < 0.09 && z > F.noseZ - 0.085;
    if (y > F.eyeY - 0.01 && !brow) return -7;
    return 1;
  }
  return 1;
}

/** Swap this person's picture and mask for his head file's clean copy. False when it cannot (no DOM, no picture). */
export function cleanToonFace(T: Three, p: Person3D, lm: ToonFaceLandmarks): boolean {
  const mat = p.body.material as THREE.MeshStandardMaterial;
  const u = p.u as Record<string, { value: THREE.Texture }>;
  if (!mat.map || !u.uMask?.value) return false;
  const key = `${p.meta.file ?? p.toonHead}`;
  let clean = CACHE.get(key);
  if (clean === undefined) {
    clean = build(T, p, lm, mat.map, u.uMask.value);
    CACHE.set(key, clean);
  }
  if (!clean) return false;
  mat.map = clean.map;
  u.uMask.value = clean.mask;
  mat.needsUpdate = true;
  return true;
}

/** Grow the cleaned skin (texels set to exactly `skin`) up to 12 texels into texels no triangle covers. */
function grow(C: { w: number; h: number }, out: Uint8ClampedArray, uv: THREE.BufferAttribute, index: THREE.BufferAttribute, skin: number[]) {
  const { w, h } = C;
  const used = new Uint8Array(w * h);
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const u0 = uv.getX(a) * w, v0 = uv.getY(a) * h, u1 = uv.getX(b) * w, v1 = uv.getY(b) * h, u2 = uv.getX(c) * w, v2 = uv.getY(c) * h;
    const den = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(u0, u1, u2) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(v0, v1, v2) + 1));
    const tol = -1.2 / (Math.sqrt(Math.abs(den)) || 1);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w0 = ((v1 - v2) * (qx - u2) + (u2 - u1) * (qy - v2)) / den, w1 = ((v2 - v0) * (qx - u2) + (u0 - u2) * (qy - v2)) / den;
      if (w0 >= tol && w1 >= tol && 1 - w0 - w1 >= tol) used[py * w + px] = 1;
    }
  }
  const isSkin = (i: number) => out[i * 4] === skin[0] && out[i * 4 + 1] === skin[1] && out[i * 4 + 2] === skin[2];
  let front: number[] = [];
  for (let i = 0; i < w * h; i++) if (used[i] && isSkin(i)) front.push(i);
  for (let step = 0; step < 12 && front.length; step++) {
    const next: number[] = [];
    for (const i of front) {
      const x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || used[j]) continue;
        used[j] = 1;
        out[j * 4] = skin[0]; out[j * 4 + 1] = skin[1]; out[j * 4 + 2] = skin[2];
        next.push(j);
      }
    }
    front = next;
  }
}

function build(T: Three, p: Person3D, lm: ToonFaceLandmarks, map: THREE.Texture, mask: THREE.Texture): Clean | null {
  const C = pixels(map.image as HTMLImageElement), M = pixels(mask.image as HTMLImageElement);
  if (!C || !M) return null;
  const geo = p.body.geometry;
  const rest = (geo.getAttribute("aRest") ?? geo.getAttribute("position")) as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const index = geo.index;
  if (!uv || !index) return null;
  const kit = p.meta.kit as { collarY?: number };
  const F = {
    chinY: lm.chinY, eyeY: (lm.eyes[0][1] + lm.eyes[1][1]) / 2, browY: lm.browY, noseY: lm.nose[1], noseZ: lm.nose[2],
    headZ: p.meta.joints.Head?.[2] ?? 0.045, neckZ: p.meta.joints.neck?.[2] ?? 0.02,
    collarY: kit.collarY ?? p.meta.face.chinY - 0.03,
  };
  const S = p.meta.skinAvg;
  const skin = [srgb(S[0]), srgb(S[1]), srgb(S[2])];
  const outC = new Uint8ClampedArray(C.d.length), outM = new Uint8ClampedArray(M.d.length);
  outC.set(C.d); outM.set(M.d);
  const tri = (a: number, b: number, cc: number, img: { w: number; h: number }, onPx: (i: number, r: [number, number, number], px: number, py: number) => void) => {
    const u0 = uv.getX(a) * img.w, v0 = uv.getY(a) * img.h, u1 = uv.getX(b) * img.w, v1 = uv.getY(b) * img.h, u2 = uv.getX(cc) * img.w, v2 = uv.getY(cc) * img.h;
    const den = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(den) < 1e-9) return;
    // a texel and a half past each edge, so the seam's filtering never reads the old paint
    const x0 = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 2)), x1 = Math.min(img.w - 1, Math.ceil(Math.max(u0, u1, u2) + 2));
    const y0 = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 2)), y1 = Math.min(img.h - 1, Math.ceil(Math.max(v0, v1, v2) + 2));
    const per = Math.sqrt(Math.abs(den)) || 1, tol = -1.6 / per;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w0 = ((v1 - v2) * (qx - u2) + (u2 - u1) * (qy - v2)) / den;
      const w1 = ((v2 - v0) * (qx - u2) + (u0 - u2) * (qy - v2)) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < tol || w1 < tol || w2 < tol) continue;
      const r: [number, number, number] = [
        rest.getX(a) * w0 + rest.getX(b) * w1 + rest.getX(cc) * w2,
        rest.getY(a) * w0 + rest.getY(b) * w1 + rest.getY(cc) * w2,
        rest.getZ(a) * w0 + rest.getZ(b) * w1 + rest.getZ(cc) * w2,
      ];
      onPx(py * img.w + px, r, px, py);
    }
  };
  const n = index.count;
  for (let t = 0; t < n; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), cc = index.getX(t + 2);
    const ymax = Math.max(rest.getY(a), rest.getY(b), rest.getY(cc)), ymin = Math.min(rest.getY(a), rest.getY(b), rest.getY(cc));
    if (ymax < F.collarY || ymin > F.browY + 0.08) continue;
    // the picture: read the mask at the same spot (its own size)
    tri(a, b, cc, C, (i, r, px, py) => {
      const mi = (Math.min(M.h - 1, Math.floor((py / C.h) * M.h)) * M.w + Math.min(M.w - 1, Math.floor((px / C.w) * M.w))) * 4;
      const m: [number, number, number] = [M.d[mi] / 255, M.d[mi + 1] / 255, M.d[mi + 2] / 255];
      const c: [number, number, number] = [C.d[i * 4] / 255, C.d[i * 4 + 1] / 255, C.d[i * 4 + 2] / 255];
      const k = faceCleanAt(r, m, c, F);
      if (DBG) { const col = DBG_C[k] ?? [0, 0, 0]; outC[i * 4] = col[0]; outC[i * 4 + 1] = col[1]; outC[i * 4 + 2] = col[2]; }
      else if (k > 0) { outC[i * 4] = skin[0]; outC[i * 4 + 1] = skin[1]; outC[i * 4 + 2] = skin[2]; }
    });
    tri(a, b, cc, M, (i, r, px, py) => {
      const ci = (Math.min(C.h - 1, Math.floor((py / M.h) * C.h)) * C.w + Math.min(C.w - 1, Math.floor((px / M.w) * C.w))) * 4;
      const m: [number, number, number] = [M.d[i * 4] / 255, M.d[i * 4 + 1] / 255, M.d[i * 4 + 2] / 255];
      const c: [number, number, number] = [C.d[ci] / 255, C.d[ci + 1] / 255, C.d[ci + 2] / 255];
      if (faceCleanAt(r, m, c, F) > 0) { outM[i * 4] = 0; outM[i * 4 + 1] = 255; outM[i * 4 + 2] = 0; }
    });
  }
  // the padding round each island (texels no triangle uses) still holds the old paint, and the smaller mip
  // levels average it into the face's edge (a dark rim on the jaw from far): the clean skin is grown into it
  grow(C, outC, uv, index, skin);
  const tex = (src: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; w: number; h: number }, data: Uint8ClampedArray, like: THREE.Texture) => {
    src.g.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, src.w, src.h), 0, 0);
    const t = new T.CanvasTexture(src.cv);
    t.flipY = like.flipY; t.colorSpace = like.colorSpace; t.wrapS = like.wrapS; t.wrapT = like.wrapT;
    t.minFilter = like.minFilter; t.magFilter = like.magFilter; t.anisotropy = like.anisotropy; t.channel = like.channel;
    t.needsUpdate = true;
    return t;
  };
  const out = { map: tex(C, outC, map), mask: tex(M, outM, mask) };
  if (typeof window !== "undefined") ((window as unknown as { __faceClean?: Record<string, HTMLCanvasElement[]> }).__faceClean ??= {})[String(p.meta.file ?? p.toonHead)] = [C.cv, M.cv];
  return out;
}
