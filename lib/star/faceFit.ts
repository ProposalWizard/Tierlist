/**
 * FACE FIT — turn any face picture into a head that belongs on the A2 body.
 *
 * Harry, 28 Sep 2026, picking the A2 "Pseudo-3D" avatar: "make the face fit
 * onto the body and match the body, need to find a way to morph users photos
 * onto the same idea like a fifa scan face thing". Before this the head was
 * the photo crop pasted on top: its own shirt collar showing, a white sticker
 * outline, a different skin tone from the drawn neck and arms, and a hard
 * edge where it met the body.
 *
 * What this does, all in the browser, once per picture (then cached):
 *
 *   1. FIND THE FACE. A face box read off the picture's own cut-out shape
 *      (guessFaceBox). It puts the chin and the eyes in the same place on
 *      the body for every photo. (TinyFaceDetector was tried first and
 *      dropped: on 6 test faces it found nothing on 2 and returned a box
 *      1.5-2x the face on 3, so heads came out at wildly different sizes.)
 *   2. CUT THE HEAD OUT. Keep the head and hair, fade the photo's own neck
 *      out a little under the chin, and throw away its shirt collar. A photo
 *      with a background (a phone upload) has the background flood-filled
 *      away from the edges, inside a head-shaped oval.
 *   3. MATCH THE SKIN. The cheeks are sampled; that tone is handed back so
 *      the body's neck, arms, hands and legs are painted in it.
 *   4. SAME LIGHT AS THE BODY. The body is lit from the left (limb() in
 *      heroFigure.ts); the face gets the same: brighter on its left, a
 *      shade darker on its right, and the photo's neck sits in the head's
 *      shadow. The rim lights are added to the whole figure, head included,
 *      by compositeLit afterwards, so they already match.
 *   5. A LIGHT STYLISE. Gentle smoothing (skin pores and JPEG noise go), a
 *      touch more saturation and contrast so it sits with the drawn kit.
 *
 * Nothing here draws on screen: fitFace returns a small canvas plus where
 * its chin is, and paintHeroFigure (heroFigure.ts) places it.
 */

import { SCAN_LAYOUT, SCAN_EYE_TO_CHIN, looksScanned } from "./faceScanLayout";

export interface FaceBox { x: number; y: number; width: number; height: number }

export interface FittedHead {
  /** The processed head, transparent round it. */
  canvas: HTMLCanvasElement;
  /** Where the chin is in `canvas` pixels, and the face box height there —
   *  the placement anchors (eyebrows-to-chin maps to a fixed body size). */
  chinX: number;
  chinY: number;
  faceH: number;
  /** The sampled skin tone, "#rrggbb", for the body. */
  skin: string;
}

/** Tunables — kept together so a by-eye pass only edits this block. */
export const FACE_FIT = {
  /** Working height of the processed head canvas, px. */
  workH: 180,
  /** How far under the chin the photo's own neck is kept (× face box h). */
  neckKeep: 0.2,
  /** Fade length at the bottom of that neck (× face box h). */
  neckFade: 0.22,
  /** Light model — matches limb(): lit from the left. */
  keyLight: 0.10,
  shadowSide: 0.16,
  /** Stylise. */
  smooth: 2,
  saturation: 1.1,
  contrast: 1.06,
  /** A scanned portrait (faceScan.ts) puts the face in a known spot. Its
   *  face box, in eye-to-chin lengths, sized so a scanned head comes out
   *  the same size on the body as a fake face (set by eye on 3 fake faces
   *  drawn both ways side by side on the A2 body). */
  scanBoxH: 1.17,
  scanBoxW: 1.12,
  // A cel-shade (luminance snapped to 6 bands, 45% mix) was tried and
  // dropped: at avatar size it only showed as orange blotches on darker
  // skin (Lavia) and did nothing visible on lighter skin.
};

// ── Small colour helpers ────────────────────────────────────────────────────

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
export const rgbHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** Is this pixel plausibly skin (any tone)? A loose test — it only has to
 *  reject hair, eyes, teeth, beard shadow and the background. */
export function looksLikeSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 35 || max > 250) return false;
  if (!(r >= g && g >= b * 0.85)) return false; // skin runs red ≥ green ≥ blue
  const sat = (max - min) / max;
  return sat > 0.08 && sat < 0.72;
}

/** Median of each channel over a list of [r,g,b] (median resists stray hair
 *  and highlight pixels better than a mean). */
export function medianColour(px: [number, number, number][]): [number, number, number] | null {
  if (!px.length) return null;
  const ch = (i: 0 | 1 | 2) => { const v = px.map((p) => p[i]).sort((a, b) => a - b); return v[v.length >> 1]; };
  return [ch(0), ch(1), ch(2)];
}

// ── 1. Where is the face? ───────────────────────────────────────────────────

/** Does the picture have a real cut-out (transparent round the head)? */
export function hasCutout(data: Uint8ClampedArray, w: number, h: number): boolean {
  let clear = 0, n = 0;
  for (let x = 0; x < w; x += Math.max(1, w >> 5)) {
    for (const y of [0, 1, Math.floor(h * 0.05)]) { n++; if (data[(y * w + x) * 4 + 3] < 40) clear++; }
  }
  return clear / n > 0.6;
}

/**
 * A face box read off the cut-out's own shape, for before face detection
 * answers (or if it never does). Reads the opaque width row by row: the head
 * widens to the ears, the width drops at the bottom of the ears onto the
 * neck, then widens again at the shoulders. The chin sits a quarter of a
 * head below that ear drop (measured on SoFIFA renders and the fake faces).
 */
export function guessFaceBox(data: Uint8ClampedArray, w: number, h: number): FaceBox {
  const width: number[] = [];
  const mid: number[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0, sx = 0;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 128) { n++; sx += x; }
    width.push(n); mid.push(n ? sx / n : w / 2);
  }
  let top = width.findIndex((n) => n > w * 0.03);
  if (top < 0) top = 0;
  // The shoulders: the first row (below the head) that is nearly full width.
  let shoulders = h - 1;
  for (let y = top + Math.floor((h - top) * 0.45); y < h; y++) if (width[y] > w * 0.9) { shoulders = y; break; }
  // The neck: the narrowest row between half-way down and the shoulders.
  let neck = shoulders, neckW = Infinity;
  for (let y = top + Math.floor((shoulders - top) * 0.5); y < shoulders; y++) if (width[y] > 0 && width[y] < neckW) { neckW = width[y]; neck = y; }
  // The ear drop: the last row above the neck that is clearly wider than it.
  let ear = Math.floor(top + (neck - top) * 0.7);
  for (let y = neck; y > top; y--) if (width[y] > neckW * 1.1) { ear = y; break; }
  const span = Math.max(8, ear - top);
  const chin = Math.min(shoulders, ear + span * 0.27);
  const headW = Math.max(...width.slice(top, ear + 1));
  const bh = (chin - top) * 0.6;
  const bw = headW * 0.78;
  const cx = mid[Math.floor(top + (chin - top) * 0.55)] ?? w / 2;
  return { x: cx - bw / 2, y: chin - bh, width: bw, height: bh };
}

/** For a photo with no cut-out and no detection: the face is in the middle,
 *  as the photo picker frames it. */
export function centredFaceBox(w: number, h: number): FaceBox {
  const bw = w * 0.44, bh = h * 0.46;
  return { x: (w - bw) / 2, y: h * 0.3, width: bw, height: bh };
}

// ── 3. Skin ─────────────────────────────────────────────────────────────────

/** The skin tone, from both cheeks and the bridge of the nose. */
export function sampleSkin(data: Uint8ClampedArray, w: number, h: number, box: FaceBox): [number, number, number] | null {
  const spots: [number, number][] = [[0.24, 0.6], [0.76, 0.6], [0.5, 0.48], [0.3, 0.72], [0.7, 0.72]];
  const px: [number, number, number][] = [];
  const rad = Math.max(1, Math.round(box.width * 0.07));
  for (const [fx, fy] of spots) {
    const cx = Math.round(box.x + box.width * fx), cy = Math.round(box.y + box.height * fy);
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      if (looksLikeSkin(data[i], data[i + 1], data[i + 2])) px.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  return medianColour(px);
}

// ── 2 + 4 + 5. Cut, light and stylise ───────────────────────────────────────

/**
 * Flood-fill the background away from the edges of an opaque photo: a pixel
 * joins the background when it is close in colour to the neighbour it was
 * reached from AND not far from the average edge colour. `keep` marks pixels
 * that are never removed (the middle of the face).
 */
function backgroundMask(d: Uint8ClampedArray, w: number, h: number, keep: (x: number, y: number) => boolean): Uint8Array {
  const bg = new Uint8Array(w * h);
  let mr = 0, mg = 0, mb = 0, n = 0;
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  for (const p of edge) { mr += d[p * 4]; mg += d[p * 4 + 1]; mb += d[p * 4 + 2]; n++; }
  mr /= n; mg /= n; mb /= n;
  const dist = (a: number, r: number, g: number, b: number) => Math.hypot(d[a * 4] - r, d[a * 4 + 1] - g, d[a * 4 + 2] - b);
  const stack: number[] = [];
  for (const p of edge) if (dist(p, mr, mg, mb) < 70) { bg[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (bg[q] || keep(nx, ny)) continue;
      if (dist(q, d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) < 22 && dist(q, mr, mg, mb) < 80) { bg[q] = 1; stack.push(q); }
    }
  }
  return bg;
}

/** Edge-preserving smoothing (a small bilateral filter): skin evens out,
 *  eyes, brows and the hairline stay sharp. */
function smoothRGB(d: Uint8ClampedArray, w: number, h: number, rad: number): void {
  if (rad <= 0) return;
  const src = new Uint8ClampedArray(d);
  const sc = 2 * 26 * 26, ss = 2 * rad * rad;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3] === 0) continue;
    let r = 0, g = 0, b = 0, tw = 0;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] < 30) continue;
      const dc = (src[j] - src[i]) ** 2 + (src[j + 1] - src[i + 1]) ** 2 + (src[j + 2] - src[i + 2]) ** 2;
      const wt = Math.exp(-(dx * dx + dy * dy) / ss - dc / sc);
      r += src[j] * wt; g += src[j + 1] * wt; b += src[j + 2] * wt; tw += wt;
    }
    if (tw > 0) { d[i] = r / tw; d[i + 1] = g / tw; d[i + 2] = b / tw; }
  }
}

/**
 * Build the fitted head. `img` must be loaded and readable (same origin, a
 * data URL, or served with CORS and loaded with crossOrigin) — a tainted
 * canvas throws on getImageData, and this returns null so the caller can
 * fall back to the plain pasted head.
 */
export function fitFace(img: HTMLImageElement | ImageBitmap, maxSide?: number, srcHint?: string): FittedHead | null {
  if (typeof document === "undefined") return null;
  // An ImageBitmap (figure3d.ts decodes and shrinks the photo off the main
  // thread first) or a loaded <img>, as the home avatar passes.
  const w0 = "naturalWidth" in img ? (img.complete ? img.naturalWidth : 0) : img.width;
  const h0 = "naturalHeight" in img ? img.naturalHeight : img.height;
  if (!w0 || !h0) return null;
  // `maxSide`: work on a smaller copy. The in-match heads (figure3d.ts) are
  // a few dozen pixels tall, so a 1,400-pixel photo is shrunk first — the
  // pixel passes below then cost a sixteenth as much. The home avatar leaves
  // it out and works at full size, exactly as before.
  const k0 = maxSide ? Math.min(1, maxSide / Math.max(w0, h0)) : 1;
  const W = Math.max(1, Math.round(w0 * k0)), H = Math.max(1, Math.round(h0 * k0));
  const src = document.createElement("canvas");
  src.width = W; src.height = H;
  const sx = src.getContext("2d", { willReadFrequently: true });
  if (!sx) return null;
  sx.drawImage(img, 0, 0, W, H);
  let full: ImageData;
  try { full = sx.getImageData(0, 0, W, H); } catch { return null; }
  // A photo with a background (a phone upload): flood the background away
  // from the edges first, so it becomes a cut-out like every other face and
  // the same shape reading finds its head. A busy background that barely
  // floods keeps the photo whole and falls back to a centred face.
  let cutout = hasCutout(full.data, W, H);
  // A scanned portrait (faceScan.ts): already cut out, straightened and
  // placed, so the face box is known rather than guessed, and the whole
  // square is kept (it is framed already, hair and all).
  const px = (x: number, y: number) => full.data[(y * W + x) * 4 + 3];
  // An ImageBitmap has no src, so figure3d.ts passes the photo's url as `srcHint`.
  const srcUrl = "src" in img ? img.src : (srcHint ?? "");
  const scanned = looksScanned(srcUrl, W, H, [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)]);
  if (!cutout && !scanned) {
    const keepMid = (x: number, y: number) => ((x - W * 0.5) / (W * 0.22)) ** 2 + ((y - H * 0.45) / (H * 0.3)) ** 2 < 1;
    const bg = backgroundMask(full.data, W, H, keepMid);
    let n = 0;
    for (let i = 0; i < bg.length; i++) if (bg[i]) { full.data[i * 4 + 3] = 0; n++; }
    if (n > bg.length * 0.12) { sx.putImageData(full, 0, 0); cutout = true; }
  }
  const scanD = SCAN_EYE_TO_CHIN * W;
  const box = scanned
    ? {
      x: SCAN_LAYOUT.cx * W - (FACE_FIT.scanBoxW * scanD) / 2,
      y: SCAN_LAYOUT.chinY * H - FACE_FIT.scanBoxH * scanD,
      width: FACE_FIT.scanBoxW * scanD,
      height: FACE_FIT.scanBoxH * scanD,
    }
    : cutout ? guessFaceBox(full.data, W, H) : centredFaceBox(W, H);
  if (scanned) cutout = true;
  const skinRGB = sampleSkin(full.data, W, H, box) ?? [198, 150, 118];

  // The crop: a head-and-a-bit around the face box.
  const chinY = box.y + box.height;
  const cx = box.x + box.width / 2;
  const cropTop = scanned ? 0 : Math.max(0, box.y - box.height * 0.95);
  const cropBot = Math.min(H, chinY + box.height * (FACE_FIT.neckKeep + 0.02));
  const cropHalfW = scanned ? W / 2 : box.width * 0.95;
  const cropL = Math.max(0, cx - cropHalfW), cropR = Math.min(W, cx + cropHalfW);
  const k = FACE_FIT.workH / Math.max(1, cropBot - cropTop);
  const ow = Math.max(8, Math.round((cropR - cropL) * k)), oh = Math.max(8, Math.round((cropBot - cropTop) * k));
  const out = document.createElement("canvas");
  out.width = ow; out.height = oh;
  const ox = out.getContext("2d", { willReadFrequently: true });
  if (!ox) return null;
  ox.imageSmoothingQuality = "high";
  ox.drawImage(src, cropL, cropTop, cropR - cropL, cropBot - cropTop, 0, 0, ow, oh);
  const id = ox.getImageData(0, 0, ow, oh);
  const d = id.data;

  // Box in output pixels.
  const b = { x: (box.x - cropL) * k, y: (box.y - cropTop) * k, w: box.width * k, h: box.height * k };
  const ocx = b.x + b.w / 2, ochin = b.y + b.h;

  // ── Cut: the head shape. ──
  // An oval that holds the head and hair (never a circle: it follows the
  // face box's own proportions), then the photo's neck is kept only a short
  // way under the chin and faded out, so its collar never shows.
  const ovalCy = b.y + b.h * 0.2, ovalRy = b.h * 1.08, ovalRx = b.w * 0.84;
  const inOval = (x: number, y: number) => ((x - ocx) / ovalRx) ** 2 + ((y - ovalCy) / ovalRy) ** 2;
  const neckEnd = ochin + b.h * FACE_FIT.neckKeep, fade = b.h * FACE_FIT.neckFade;
  const neckHalf = b.w * 0.36;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = (y * ow + x) * 4;
    let a = d[i + 3] / 255;
    if (!cutout) {
      // A photo whose background would not flood away: the oval is the
      // head's outline, feathered.
      const o = inOval(x, y);
      a *= o < 0.86 ? 1 : o > 1 ? 0 : (1 - o) / 0.14;
    }
    if (y > ochin - b.h * 0.12) {
      // Under the jaw only a neck-wide column survives …
      const side = Math.abs(x - ocx) - neckHalf;
      if (y > ochin && side > 0) a *= Math.max(0, 1 - side / (b.w * 0.08));
      // … and it fades out before the collar.
      if (y > neckEnd - fade) a *= Math.max(0, (neckEnd - y) / fade);
    }
    d[i + 3] = Math.round(a * 255);
  }

  // ── Stylise: smooth, then saturation and contrast. ──
  smoothRGB(d, ow, oh, FACE_FIT.smooth);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i], g = d[i + 1], bl = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = l + (r - l) * FACE_FIT.saturation; g = l + (g - l) * FACE_FIT.saturation; bl = l + (bl - l) * FACE_FIT.saturation;
    r = 128 + (r - 128) * FACE_FIT.contrast; g = 128 + (g - 128) * FACE_FIT.contrast; bl = 128 + (bl - 128) * FACE_FIT.contrast;
    d[i] = r; d[i + 1] = g; d[i + 2] = bl;
  }

  // ── Light: the body's model. Lit from the left, shade on the right, and
  // the neck under the chin in the head's shadow. ──
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = (y * ow + x) * 4;
    if (!d[i + 3]) continue;
    const u = Math.max(-1, Math.min(1, (x - ocx) / (b.w * 0.75))); // -1 left … 1 right
    let f = 1 + FACE_FIT.keyLight * Math.max(0, -u) - FACE_FIT.shadowSide * Math.max(0, u) ** 1.5;
    // Under the chin the neck sits in the head's shadow — a soft ramp, not a
    // band, so it runs smoothly into the drawn neck below.
    const under = (y - (ochin - b.h * 0.05)) / (b.h * 0.18);
    if (under > 0) f *= 1 - 0.26 * Math.min(1, under);
    // Warm the lit side a touch (the key light is warm white).
    d[i] = d[i] * f + (u < 0 ? 6 * -u : 0);
    d[i + 1] = d[i + 1] * f;
    d[i + 2] = d[i + 2] * f * (u > 0 ? 1.02 : 1);
  }
  ox.putImageData(id, 0, 0);

  return {
    canvas: out,
    chinX: ocx,
    chinY: ochin,
    faceH: b.h,
    skin: rgbHex(skinRGB[0], skinRGB[1], skinRGB[2]),
  };
}

// ── The cache ───────────────────────────────────────────────────────────────

const fitted = new Map<string, FittedHead>();
const images = new Map<string, HTMLImageElement>();

/** A readable copy of the picture (crossOrigin, so a CORS-enabled Supabase
 *  portrait can be read), shared by everyone who asks for the same URL. */
export function fitImage(url: string): HTMLImageElement {
  let img = images.get(url);
  if (!img) {
    img = new Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.src = url;
    images.set(url, img);
  }
  return img;
}

/** The fitted head for `url`, built once and then reused (null until the
 *  readable copy of the picture has loaded, or if it cannot be read). */
export function getFittedHead(url: string): FittedHead | null {
  const hit = fitted.get(url);
  if (hit) return hit;
  const img = fitImage(url);
  if (!img.complete || !img.naturalWidth) return null;
  const f = fitFace(img);
  if (f) fitted.set(url, f);
  return f;
}
