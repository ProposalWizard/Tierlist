/**
 * THE FACE SCAN — a photo becomes a clean, straightened head, once.
 *
 * Harry, 28 Sep 2026, after uploading his own photo: the home avatar showed
 * "the photo's real room background … as an oval cut-out with a green
 * outline", the head "looks pasted on", "maybe we need to do some sort of
 * face scan technique". The old face fit (faceFit.ts) flood-fills the
 * background away from the photo's edges, which only works on a plain wall;
 * a real room fell back to an oval.
 *
 * This runs ONCE, when a photo is picked (PortraitPicker.tsx), or once for an
 * old save's photo the first time it is shown (scanLegacyPortrait). It uses
 * three small MediaPipe models, bundled in public/models/facescan (nothing
 * is fetched from anybody else's server):
 *
 *   face_landmarker.task   3.6 MB — 478 points on the face: eyes, chin,
 *                                   forehead, cheeks, jaw.
 *   selfie_segmenter       244 KB — which pixels are the person.
 *   hair_segmenter         764 KB — which pixels are hair.
 *   (+ the MediaPipe runtime, wasm/vision_wasm_internal.wasm, 12 MB.)
 *
 * Steps:
 *   1. FIND THE FACE — the landmarks. No face → a plain message, no scan.
 *   2. LINE IT UP — straighten the head (eyes level), scale it (eye line to
 *      chin is always the same length) and centre it: every scanned face
 *      sits in the same place (faceScanLayout.ts).
 *   3. CUT IT OUT — person + hair, whatever is behind. Below the mouth only
 *      the neck and any long hair survive, so no shirt or shoulders; the face
 *      itself is always solid (the landmarks' face outline), so glasses or a
 *      shadow can't punch holes in it. The edge is feathered and its colour
 *      taken from the inside, so no halo of the room is left round the hair.
 *   4. HAIR — if the photo cuts the top of the head off, the missing hair is
 *      drawn back on in the avatar's style (faceHair.ts).
 *   5. LEVEL THE LIGHT — a gentle exposure and white-balance nudge from the
 *      skin, so a dark or orange phone photo sits with everybody else.
 *
 * The result is a small transparent square (a data URL, same storage as
 * the old photo): the home avatar reads it with faceFit.ts, and every other
 * screen shows it as a head with no room behind it.
 */
import { SCAN_LAYOUT, SCAN_EYE_TO_CHIN } from "./faceScanLayout";
import { paintHair, pickHairStyle, type HairGeo, type HairStats, type HairStyle } from "./faceHair";
import { looksLikeSkin, medianColour } from "./faceFit";
import { MAX_PORTRAIT_BYTES, portraitBytes } from "./portrait";

/** Where the models and the runtime are served from (public/). */
export const FACE_SCAN_BASE = "/models/facescan/";

// ── Face-mesh point numbers (MediaPipe's 478-point face mesh) ───────────────
const IRIS_L = 468, IRIS_R = 473;
const EYE_L = [33, 133, 159, 145], EYE_R = [362, 263, 386, 374];
const CHIN = 152, FOREHEAD = 10, LOWER_LIP = 17, CHEEK_L = 234, CHEEK_R = 454;
const BROWS = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300];
const CHEEKS = [50, 280, 205, 425];
/** The face's outline, in order round the face. */
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

export interface Pt { x: number; y: number }

/** The work canvas the scan is done in (square, px). */
const WORK = 512;

// ── Pure geometry (tested in tests/star/faceScan.mts) ───────────────────────

/**
 * The transform that puts a face in its scanned spot: eyes level, eye line
 * to chin exactly `SCAN_EYE_TO_CHIN × size` long, the eye midpoint at
 * (cx, eyeY). Returns the rotation (radians, how much the head was tilted),
 * the scale, and a function mapping source pixels to output pixels.
 */
export function alignTransform(eyeA: Pt, eyeB: Pt, chin: Pt, size: number) {
  const [l, r] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];
  const theta = Math.atan2(r.y - l.y, r.x - l.x);
  const mid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  const c = Math.cos(-theta), s = Math.sin(-theta);
  const rot = (p: Pt) => ({ x: (p.x - mid.x) * c - (p.y - mid.y) * s, y: (p.x - mid.x) * s + (p.y - mid.y) * c });
  const D = rot(chin).y; // eye line to chin, straightened
  const k = D > 0 ? (SCAN_EYE_TO_CHIN * size) / D : 0;
  const ox = SCAN_LAYOUT.cx * size, oy = SCAN_LAYOUT.eyeY * size;
  const apply = (p: Pt): Pt => { const q = rot(p); return { x: ox + q.x * k, y: oy + q.y * k }; };
  return { theta, scale: k, D, mid, apply };
}

/** 0 below `a`, 1 above `b`, smooth between. */
export function ramp(v: number, a: number, b: number): number {
  if (v <= a) return 0;
  if (v >= b) return 1;
  const t = (v - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Separable box blur of a w×h float field, in place, `passes` times. */
function blur(f: Float32Array, w: number, h: number, rad: number, passes = 1): void {
  if (rad < 1) return;
  const tmp = new Float32Array(f.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -rad; x <= rad; x++) acc += f[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * rad + 1);
        acc += f[row + Math.min(w - 1, x + rad + 1)] - f[row + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        f[y * w + x] = acc / (2 * rad + 1);
        acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x];
      }
    }
  }
}

// ── The models ──────────────────────────────────────────────────────────────

type Vision = typeof import("@mediapipe/tasks-vision");
interface Models {
  landmarker: Awaited<ReturnType<Vision["FaceLandmarker"]["createFromOptions"]>>;
  person: Awaited<ReturnType<Vision["ImageSegmenter"]["createFromOptions"]>>;
  hair: Awaited<ReturnType<Vision["ImageSegmenter"]["createFromOptions"]>>;
}
let modelsP: Promise<Models> | null = null;

/** Load (once) the three models. Safe to call early to warm them up. */
export function loadFaceScan(base = FACE_SCAN_BASE): Promise<Models> {
  if (!modelsP) {
    modelsP = (async () => {
      const v: Vision = await import("@mediapipe/tasks-vision");
      // Only the SIMD runtime is bundled (12 MB; every phone browser since
      // iOS 16.4 / Chrome 91 has SIMD). Without it the scan reports
      // "unsupported" and the picker falls back to cropping by hand.
      if (!(await v.FilesetResolver.isSimdSupported())) throw new Error("no wasm SIMD");
      const files = { wasmLoaderPath: `${base}wasm/vision_wasm_internal.js`, wasmBinaryPath: `${base}wasm/vision_wasm_internal.wasm` };
      const landmarker = await v.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}face_landmarker.task`, delegate: "CPU" },
        runningMode: "IMAGE", numFaces: 1, minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4,
      });
      const person = await v.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}selfie_segmenter.tflite`, delegate: "CPU" },
        runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false,
      });
      const hair = await v.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}hair_segmenter.tflite`, delegate: "CPU" },
        runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false,
      });
      return { landmarker, person, hair };
    })();
    modelsP.catch(() => { modelsP = null; });
  }
  return modelsP;
}

/** One confidence mask from a segmenter, as floats at the input's size. */
function maskOf(seg: Models["person"], img: HTMLCanvasElement, pick: "last" | "first"): Float32Array {
  const res = seg.segment(img);
  const masks = res.confidenceMasks ?? [];
  const m = pick === "last" ? masks[masks.length - 1] : masks[0];
  const out = m ? new Float32Array(m.getAsFloat32Array()) : new Float32Array(img.width * img.height);
  res.close?.();
  return out;
}

// ── The scan ────────────────────────────────────────────────────────────────

export type ScanFailure = "unsupported" | "noface" | "small" | "error";

export interface ScanSuccess {
  ok: true;
  /** The portrait to store (transparent WebP, or PNG where WebP can't be written). */
  dataUrl: string;
  /** The same picture as a canvas. */
  canvas: HTMLCanvasElement;
  /** Face points in the SOURCE picture, 0…1 (for the scanning animation). */
  points: Pt[];
  /** How much the head was tilted, degrees. */
  tiltDeg: number;
  hair: { stats: HairStats; style: HairStyle | null; why: string; colour: string };
  skin: string;
  ms: number;
}
export interface ScanFail { ok: false; reason: ScanFailure; message: string }
export type ScanOutcome = ScanSuccess | ScanFail;

export const SCAN_MESSAGES: Record<ScanFailure, string> = {
  noface: "We couldn't find a face — try a front-on photo with good light.",
  small: "Your face is too small in that photo — get closer, or crop in first.",
  unsupported: "This browser can't run the face scan — you can still crop the photo by hand.",
  error: "The face scan went wrong on that photo — try another, or crop it by hand.",
};

const fail = (reason: ScanFailure): ScanFail => ({ ok: false, reason, message: SCAN_MESSAGES[reason] });

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) throw new Error("no 2d context");
  return [c, x];
}

const hexOf = (c: [number, number, number]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/**
 * Scan a picture. `onPoints` is called as soon as the face is found (before
 * the slow part), with its points in the source picture, so the animation
 * can show them.
 */
export async function scanFace(
  source: CanvasImageSource & { width?: number; height?: number },
  opts: { onPoints?: (pts: Pt[]) => void; base?: string } = {},
): Promise<ScanOutcome> {
  if (typeof document === "undefined") return fail("unsupported");
  const t0 = performance.now();
  let models: Models;
  try { models = await loadFaceScan(opts.base); } catch { return fail("unsupported"); }
  try {
    // ── The source, at most 1280 px on its long side ──
    const sw0 = (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width || 0;
    const sh0 = (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height || 0;
    if (!sw0 || !sh0) return fail("error");
    const k0 = Math.min(1, 1280 / Math.max(sw0, sh0));
    const [src, sx] = canvasOf(Math.round(sw0 * k0), Math.round(sh0 * k0));
    sx.drawImage(source, 0, 0, src.width, src.height);

    // ── 1. Find the face ──
    const lmRes = models.landmarker.detect(src);
    const lm = lmRes.faceLandmarks?.[0];
    if (!lm || lm.length < 468) return fail("noface");
    const P = (i: number): Pt => ({ x: lm[i].x * src.width, y: lm[i].y * src.height });
    const avg = (ids: number[]): Pt => { let x = 0, y = 0; for (const i of ids) { const p = P(i); x += p.x; y += p.y; } return { x: x / ids.length, y: y / ids.length }; };
    const eyeA = lm.length > IRIS_R ? P(IRIS_L) : avg(EYE_L);
    const eyeB = lm.length > IRIS_R ? P(IRIS_R) : avg(EYE_R);
    const faceWsrc = Math.hypot(P(CHEEK_L).x - P(CHEEK_R).x, P(CHEEK_L).y - P(CHEEK_R).y);
    if (faceWsrc < 36) return fail("small");
    opts.onPoints?.(lm.map((p) => ({ x: p.x, y: p.y })));

    // ── 2. Line it up, in a WORK×WORK canvas ──
    const T = alignTransform(eyeA, eyeB, P(CHIN), WORK);
    if (!(T.D > 4)) return fail("noface");
    const W = WORK, N = W * W;
    const [work, wx] = canvasOf(W, W);
    const place = (ctx: CanvasRenderingContext2D) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(SCAN_LAYOUT.cx * W, SCAN_LAYOUT.eyeY * W);
      ctx.rotate(-T.theta);
      ctx.scale(T.scale, T.scale);
      ctx.translate(-T.mid.x, -T.mid.y);
    };
    wx.imageSmoothingQuality = "high";
    place(wx); wx.drawImage(src, 0, 0);
    const photo = wx.getImageData(0, 0, W, W);
    const px = photo.data;
    // Which work pixels the photo actually covers.
    const [vc, vx] = canvasOf(W, W);
    place(vx); vx.fillStyle = "#fff"; vx.fillRect(0, 0, src.width, src.height);
    const vd = vx.getImageData(0, 0, W, W).data;
    const valid = new Float32Array(N);
    for (let i = 0; i < N; i++) valid[i] = vd[i * 4 + 3] / 255;
    void vc;
    // What the segmenters see: the lined-up photo on grey.
    const [segC, segX] = canvasOf(W, W);
    segX.fillStyle = "#7f7f7f"; segX.fillRect(0, 0, W, W);
    segX.drawImage(work, 0, 0);
    const person = maskOf(models.person, segC, "last");
    const hairM = maskOf(models.hair, segC, "last");

    // Face points in work space.
    const Q = (i: number) => T.apply(P(i));
    const D = SCAN_EYE_TO_CHIN * W;
    const chin = Q(CHIN), fore = Q(FOREHEAD), lip = Q(LOWER_LIP);
    const cheekL = Q(CHEEK_L), cheekR = Q(CHEEK_R);
    const fw = Math.hypot(cheekR.x - cheekL.x, cheekR.y - cheekL.y);
    const cx = (cheekL.x + cheekR.x) / 2;
    const eyeY = SCAN_LAYOUT.eyeY * W;

    // The face outline, slightly shrunk and feathered: always solid.
    const [oc, ox] = canvasOf(W, W);
    const oval = FACE_OVAL.map(Q);
    const ocx = oval.reduce((s, p) => s + p.x, 0) / oval.length, ocy = oval.reduce((s, p) => s + p.y, 0) / oval.length;
    ox.fillStyle = "#fff";
    ox.beginPath();
    oval.forEach((p, i) => { const x = ocx + (p.x - ocx) * 0.95, y = ocy + (p.y - ocy) * 0.96; if (i) ox.lineTo(x, y); else ox.moveTo(x, y); });
    ox.closePath(); ox.fill();
    const od = ox.getImageData(0, 0, W, W).data;
    const ovalF = new Float32Array(N);
    for (let i = 0; i < N; i++) ovalF[i] = od[i * 4 + 3] / 255;
    blur(ovalF, W, W, 2, 2);
    void oc;

    // Hair must sit on or next to the person (a dark shelf behind is not hair).
    const near = new Float32Array(person);
    blur(near, W, W, 6, 2);

    // ── 3. Cut it out ──
    const alpha = new Float32Array(N);
    const hairR = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Hair runs red ≥ green ≥ blue in every natural colour (black, brown,
      // blond, ginger, grey); a clearly green or blue patch next to the head
      // is something behind it that the hair model half-believed.
      const j = i * 4, off = Math.max(px[j + 1] - px[j] - 18, px[j + 2] - px[j] - 28, 0);
      hairR[i] = ramp(hairM[i], 0.2, 0.62) * Math.min(1, near[i] * 3) * valid[i] * (1 - ramp(off, 0, 30));
    }
    // …and far brighter than the hair's own middle tone is a highlight on
    // something behind (a lamp, a white frame), not a highlight in the hair.
    {
      const lumOf = (i: number) => 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
      const ls: number[] = [];
      for (let i = 0; i < N; i += 3) if (hairR[i] > 0.8) ls.push(lumOf(i));
      if (ls.length > 60) {
        ls.sort((a, b) => a - b);
        const med = ls[ls.length >> 1];
        for (let i = 0; i < N; i++) if (hairR[i] > 0) hairR[i] *= 1 - ramp(lumOf(i) - med, 95, 140);
      }
    }
    // Above the brows, "person" that is not hair only counts right at the
    // face's edge (the forehead); anything further out must be hair.
    const ovalNear = new Float32Array(ovalF);
    blur(ovalNear, W, W, Math.round(0.05 * D), 2);
    const browY = SCAN_LAYOUT.eyeY * W - 0.1 * D;
    // The person mask is only trusted close to the face or the hair: a
    // hood-shaped thing behind someone (a chair back, a doorframe, the old
    // oval cut-out in Harry's screenshot) reads as "person" to the model.
    const nearHead = new Float32Array(N);
    for (let i = 0; i < N; i++) nearHead[i] = Math.max(ovalF[i], hairR[i] > 0.5 ? 1 : 0);
    blur(nearHead, W, W, Math.round(0.08 * D), 2);
    const neckHalf = 0.34 * fw;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // (Up there the forehead and a bald scalp sit straight above the face,
      // inside the face's own width, so that column is always allowed.)
      const upper = y < browY && ovalF[i] < 0.5;
      const column = 1 - ramp(Math.abs(x - cx), 0.4 * fw, 0.5 * fw);
      const pr = ramp(person[i], 0.3, 0.72) * (upper ? Math.max(column, ramp(ovalNear[i], 0.05, 0.3)) : ramp(nearHead[i], 0.02, 0.2));
      const hr = hairR[i];
      let a: number;
      if (y > lip.y && ovalF[i] < 0.5) {
        // Under the mouth: the neck (a column under the chin, fading out
        // before the collar) and any long hair — never the shirt.
        const col = 1 - ramp(Math.abs(x - chin.x), neckHalf, neckHalf + 0.12 * D);
        const fadeNeck = 1 - ramp(y, chin.y + 0.12 * D, chin.y + 0.45 * D);
        const fadeHair = 1 - ramp(y, chin.y + 0.55 * D, W - 2);
        a = Math.max(ramp(person[i], 0.3, 0.72) * col * fadeNeck, hr * fadeHair);
      } else {
        a = Math.max(pr, hr);
      }
      a = Math.max(a, ovalF[i]);
      alpha[i] = a * valid[i] * (px[i * 4 + 3] / 255);
    }
    blur(alpha, W, W, 1, 1);

    // ── Does the photo cut off the top of the head? ──
    const validTop = new Int32Array(W).fill(W);
    for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) if (valid[y * W + x] > 0.5) { validTop[x] = y; break; }
    let touch = 0, cols = 0;
    for (let x = Math.round(cx - 0.45 * fw); x <= Math.round(cx + 0.45 * fw); x++) {
      if (x < 0 || x >= W) continue;
      cols++;
      const y = Math.min(W - 1, validTop[x] + 2);
      if (alpha[y * W + x] > 0.5) touch++;
    }
    const topAtFore = validTop[Math.max(0, Math.min(W - 1, Math.round(fore.x)))];
    const foreheadRoom = (fore.y - topAtFore) / D;
    const cropped = (cols > 0 && touch / cols > 0.35) || foreheadRoom < 0.3;

    // ── 5 (before sampling colours). Level the light from the skin ──
    const skinPx: [number, number, number][] = [];
    for (const id of CHEEKS) {
      const c = Q(id), rad = Math.max(2, Math.round(0.05 * D));
      for (let y = Math.round(c.y) - rad; y <= c.y + rad; y++) for (let x = Math.round(c.x) - rad; x <= c.x + rad; x++) {
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const i = (y * W + x) * 4;
        if (looksLikeSkin(px[i], px[i + 1], px[i + 2])) skinPx.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
    const skin0 = medianColour(skinPx) ?? [190, 145, 115];
    const lum0 = 0.299 * skin0[0] + 0.587 * skin0[1] + 0.114 * skin0[2];
    // Exposure: only a badly under- or over-exposed photo is corrected
    // (never more than ±25%), so dark skin stays dark and light stays light.
    const want = lum0 < 55 ? 75 : lum0 > 205 ? 185 : lum0;
    const expo = Math.max(0.8, Math.min(1.25, Math.sqrt(want / Math.max(1, lum0))));
    // White balance: skin runs red > green > blue in every tone; a photo
    // under orange or blue light is nudged back halfway.
    const g0 = Math.max(1, skin0[1]);
    const kr = Math.max(0.92, Math.min(1.08, Math.sqrt(1.24 / Math.max(0.5, skin0[0] / g0))));
    const kb = Math.max(0.9, Math.min(1.1, Math.sqrt(0.84 / Math.max(0.3, skin0[2] / g0))));
    for (let i = 0; i < N; i++) {
      if (alpha[i] <= 0.01) continue;
      const j = i * 4;
      px[j] = px[j] * expo * kr; px[j + 1] = px[j + 1] * expo; px[j + 2] = px[j + 2] * expo * kb;
    }
    const skin: [number, number, number] = [skin0[0] * expo * kr, skin0[1] * expo, skin0[2] * expo * kb];

    // ── Edge colour: an edge pixel takes the colour of the head just inside
    // it, so no room colour is left in the feathered rim. ──
    const fr = new Float32Array(N * 3), filled = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (alpha[i] > 0.92) { filled[i] = 1; fr[i * 3] = px[i * 4]; fr[i * 3 + 1] = px[i * 4 + 1]; fr[i * 3 + 2] = px[i * 4 + 2]; }
    for (let pass = 0; pass < 6; pass++) {
      const add: number[] = [];
      for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (filled[i] || alpha[i] <= 0.01) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) if (filled[j] === 1) { r += fr[j * 3]; g += fr[j * 3 + 1]; b += fr[j * 3 + 2]; n++; }
        if (n) { fr[i * 3] = r / n; fr[i * 3 + 1] = g / n; fr[i * 3 + 2] = b / n; add.push(i); }
      }
      for (const i of add) filled[i] = 1;
    }
    for (let i = 0; i < N; i++) {
      const a = alpha[i];
      if (a > 0.92 || a <= 0.01 || !filled[i]) continue;
      const t = ramp(a, 0.55, 0.92);
      const j = i * 4;
      px[j] = fr[i * 3] + (px[j] - fr[i * 3]) * t;
      px[j + 1] = fr[i * 3 + 1] + (px[j + 1] - fr[i * 3 + 1]) * t;
      px[j + 2] = fr[i * 3 + 2] + (px[j + 2] - fr[i * 3 + 2]) * t;
    }

    // ── 4. Hair: measure what shows ──
    const headCol = (x: number) => Math.abs(x - cx) < 0.75 * fw;
    let area = 0, hairTop = W, below = 0, sides = 0, tex = 0, texN = 0, denS = 0, denN = 0, skinTop = 0;
    let widest = 0;
    const hairPx: [number, number, number][] = [];
    for (let y = 1; y < W - 1; y++) {
      let minX = W, maxX = -1;
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x, h = hairR[i];
        if (h > 0.5) {
          area++;
          if (headCol(x) && y < hairTop) hairTop = y;
          if (y > chin.y && Math.abs(x - cx) > 0.3 * fw) below++;
          if (y > eyeY && y < chin.y && Math.abs(x - cx) > 0.55 * fw) sides++;
          if (y < eyeY - 0.1 * D && Math.abs(x - cx) < 1.3 * fw) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
        }
        if (h > 0.8 && y < eyeY) {
          const j = i * 4;
          hairPx.push([px[j], px[j + 1], px[j + 2]]);
          const L = (k: number) => 0.3 * px[k] + 0.59 * px[k + 1] + 0.11 * px[k + 2];
          const lap = Math.abs(4 * L(j) - L(j - 4) - L(j + 4) - L(j - W * 4) - L(j + W * 4));
          tex += lap / (L(j) + 25); texN++;
        }
        if (y > fore.y - 0.3 * D && y < fore.y && Math.abs(x - cx) < 0.4 * fw && valid[i] > 0.5) {
          denS += h; denN++;
          const j = i * 4;
          if (person[i] > 0.5 && h < 0.3 && looksLikeSkin(px[j], px[j + 1], px[j + 2])) skinTop++;
        }
      }
      if (maxX > minX) widest = Math.max(widest, maxX - minX);
    }
    const stats: HairStats = {
      cropped,
      area: area / (D * D),
      topAbove: hairTop < W ? Math.max(0, (fore.y - hairTop) / D) : 0,
      width: widest / Math.max(1, fw),
      below: below / (D * D),
      sides: sides / (D * D),
      texture: texN ? Math.min(1, (tex / texN) / 0.6) : 0,
      density: denN ? denS / denN : 0,
      scalpVisible: !cropped && denN > 0 && skinTop / denN > 0.45,
    };
    const choice = pickHairStyle(stats);
    // The hair colour: the visible hair, else the eyebrows (a touch darker).
    let hairCol = medianColour(hairPx);
    if (!hairCol || hairPx.length < 40) {
      const bp: [number, number, number][] = [];
      for (const id of BROWS) {
        const c = Q(id);
        const i = (Math.round(c.y) * W + Math.round(c.x)) * 4;
        if (i >= 0 && i < px.length) bp.push([px[i], px[i + 1], px[i + 2]]);
      }
      const b = medianColour(bp) ?? [40, 30, 25];
      hairCol = [b[0] * 0.8, b[1] * 0.8, b[2] * 0.8];
    }

    // ── Put it together at WORK size ──
    for (let i = 0; i < N; i++) px[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha[i])) * 255);
    const [headC, headX] = canvasOf(W, W);
    const [outC, outX] = canvasOf(W, W);
    // The dome's base: the photo's cut, as wide as the head is just under it.
    let baseL = { x: cx - 0.5 * fw, y: fore.y + 0.05 * D }, baseR = { x: cx + 0.5 * fw, y: fore.y + 0.05 * D };
    if (cropped) {
      const dy = Math.round(0.06 * D);
      let xl = -1, xr = -1;
      for (let x = Math.max(0, Math.round(cx - 0.9 * fw)); x <= Math.min(W - 1, Math.round(cx + 0.9 * fw)); x++) {
        const y = Math.min(W - 1, validTop[x] + dy);
        if (alpha[y * W + x] > 0.5) { if (xl < 0) xl = x; xr = x; }
      }
      if (xl >= 0 && xr - xl > 0.3 * fw) { baseL = { x: xl, y: validTop[xl] }; baseR = { x: xr, y: validTop[xr] }; }
    }
    const geo: HairGeo = { foreheadY: fore.y, D, baseL, baseR };
    const seed = Math.round(fw * 7 + D * 13 + (hairCol[0] | 0));
    // The drawn piece is coloured from the hair right where it joins (just
    // under the cut), so there is no colour step at the seam.
    let joinCol = hairCol;
    if (cropped) {
      const jp: [number, number, number][] = [];
      for (let x = Math.round(baseL.x); x <= Math.round(baseR.x); x++) {
        for (let y = validTop[x] + 2; y < Math.min(W, validTop[x] + 0.15 * D); y++) {
          const i = y * W + x;
          if (hairR[i] > 0.7) jp.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
        }
      }
      if (jp.length > 40) joinCol = medianColour(jp) ?? hairCol;
      // A shade darker: the drawn piece adds its own shine and highlights.
      joinCol = [joinCol[0] * 0.88, joinCol[1] * 0.88, joinCol[2] * 0.88];
    }
    /** Paint the piece on its own layer with a soft (feathered) edge; `edgeAt`
     *  optionally fades it out below a line (the front band over the seam). */
    const hairLayer = (edgeAt?: (x: number) => number, fb = 0) => {
      const [hc, hx] = canvasOf(W, W);
      paintHair(hx, choice.style!, geo, joinCol, skin, seed);
      const hd = hx.getImageData(0, 0, W, W);
      const a = new Float32Array(N);
      for (let i = 0; i < N; i++) a[i] = hd.data[i * 4 + 3];
      blur(a, W, W, 1, 2);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = a[i];
        if (edgeAt) v *= 1 - ramp(y, edgeAt(x) - fb * 0.7, edgeAt(x));
        hd.data[i * 4 + 3] = Math.round(v);
      }
      hx.putImageData(hd, 0, 0);
      return hc;
    };
    if (choice.style) {
      // Feather the photo into the drawn hair where the photo was cut.
      const band = 0.05 * D;
      for (let x = 0; x < W; x++) for (let y = validTop[x]; y < Math.min(W, validTop[x] + band + 1); y++) {
        const i = y * W + x;
        px[i * 4 + 3] = Math.round(px[i * 4 + 3] * ramp(y - validTop[x], 0, band));
      }
      outX.drawImage(hairLayer(), 0, 0);
    }
    headX.putImageData(photo, 0, 0);
    outX.drawImage(headC, 0, 0);
    if (choice.style) {
      // A thin band of drawn hair over the seam (or, with no hair found at
      // all, over the top of the head down to the hairline), fading out
      // downwards.
      const fb = 0.08 * D;
      outX.drawImage(hairLayer((x) => (cropped
        ? validTop[x] + fb
        : fore.y + 0.02 * D + 0.4 * D * Math.min(1, ((x - cx) / (0.55 * fw)) ** 2)), fb), 0, 0);
    }

    // ── Downscale and encode ──
    const S = SCAN_LAYOUT.size;
    const [fin, finX] = canvasOf(S, S);
    finX.imageSmoothingQuality = "high";
    finX.drawImage(outC, 0, 0, S, S);
    const dataUrl = encodeCutout(fin);
    if (!dataUrl) return fail("error");
    return {
      ok: true, dataUrl, canvas: fin,
      points: lm.map((p) => ({ x: p.x, y: p.y })),
      tiltDeg: (T.theta * 180) / Math.PI,
      hair: { stats, style: choice.style, why: choice.why, colour: hexOf(hairCol) },
      skin: hexOf(skin),
      ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    if (typeof console !== "undefined") console.error("[faceScan]", e);
    return fail("error");
  }
}

/**
 * A transparent picture as a small data URL. WebP keeps the see-through
 * edge at a fraction of PNG's size; a browser that cannot write WebP gets
 * PNG, shrunk until it fits the portrait budget (portrait.ts).
 */
export function encodeCutout(c: HTMLCanvasElement): string | null {
  const webp = c.toDataURL("image/webp", 0.86);
  if (webp.startsWith("data:image/webp") && portraitBytes(webp) <= MAX_PORTRAIT_BYTES) return webp;
  let png = c.toDataURL("image/png");
  if (portraitBytes(png) <= MAX_PORTRAIT_BYTES) return png;
  for (const s of [256, 224, 192]) {
    const [d, dx] = canvasOf(s, s);
    dx.imageSmoothingQuality = "high";
    dx.drawImage(c, 0, 0, s, s);
    png = d.toDataURL("image/png");
    if (portraitBytes(png) <= MAX_PORTRAIT_BYTES) return png;
  }
  return null;
}

// ── Old saves: scan an old cropped photo once, the first time it's shown ────

const CACHE_KEY = "star-facescan-v1:";
const memo = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

/** A short, stable key for a (long) data URL. */
export function portraitKey(url: string): string {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < url.length; i++) { const c = url.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 33) ^ c; }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${url.length.toString(36)}`;
}

/** Is this an old-style photo (a solid cropped square from before the scan)
 *  that could be scanned? Fake faces and database photos never are. */
export function isScannablePortrait(url: string | undefined | null): url is string {
  return !!url && /^data:image\/(webp|jpeg|jpg|png)/.test(url);
}

/** The cached scan of an old photo, if one has been made (sync). */
export function cachedScanOf(url: string): string | null | undefined {
  if (memo.has(url)) return memo.get(url);
  try {
    const v = localStorage.getItem(CACHE_KEY + portraitKey(url));
    if (v) { memo.set(url, v); return v; }
  } catch { /* private mode */ }
  return undefined;
}

/**
 * Scan an old photo (once per photo, cached in this browser). Resolves to
 * the scanned portrait, or null if it can't be scanned (then the old face
 * fit keeps drawing it). A photo that is already a scan resolves to itself.
 */
export function scanLegacyPortrait(url: string): Promise<string | null> {
  const hit = cachedScanOf(url);
  if (hit !== undefined) return Promise.resolve(hit);
  const running = inflight.get(url);
  if (running) return running;
  const p = new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = async () => {
      // Already a scan (see-through corners): nothing to do.
      const [c, x] = canvasOf(img.naturalWidth, img.naturalHeight);
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const corner = (cx: number, cy: number) => d[(cy * c.width + cx) * 4 + 3];
      if ([corner(0, 0), corner(c.width - 1, 0), corner(0, c.height - 1), corner(c.width - 1, c.height - 1)].every((a) => a < 8)) {
        resolve(url); return;
      }
      const r = await scanFace(img);
      resolve(r.ok ? r.dataUrl : null);
    };
    img.src = url;
  }).then((v) => {
    memo.set(url, v);
    if (v && v !== url) { try { localStorage.setItem(CACHE_KEY + portraitKey(url), v); } catch { /* full: memory only */ } }
    inflight.delete(url);
    return v;
  });
  inflight.set(url, p);
  return p;
}
