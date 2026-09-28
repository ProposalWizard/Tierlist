/**
 * BLENDER 3D FOOTBALLER — recolour one render into any club's kit, in the
 * browser (route (a) in tools/blender-footballer/NOTES.md).
 *
 * The figure was rendered ONCE in Blender with every kit panel in neutral
 * grey (albedo 0.5, linear). Beside the picture the render saved:
 *   light   the diffuse light that landed on the cloth (sRGB-encoded, /4)
 *   kitA    shirt, sleeves, shorts   (coverage, stored LINEAR — not sRGB)
 *   kitB    socks, trim, sock band
 *   crest   the crest's u, v and coverage             (where it shows)
 *   num     the number's u, v and coverage
 *
 * No data lives in an alpha channel (a canvas premultiplies alpha, which
 * would wipe it) — only the picture's own alpha, in `base`.
 *
 * Per pixel, in linear light, premultiplied:
 *
 *   out = base + light * Σ mask_r * (club_r − 0.5)
 *
 * The crest and the number are looked up in any image through the stored
 * u,v, so they sit on the chest and the shorts in perspective.
 *
 * Pure maths, no DOM: the page (app/star-blender-dev) loads the pictures
 * into ImageData and calls `recolourPixels` once per club picked — never
 * per frame, there is no animation loop.
 */
import type { Kit } from "./kits";

/** The grey the kit was rendered in (linear). */
export const KIT_BASE = 0.5;

export type Lin = [number, number, number];

export interface KitColours {
  shirt: Lin; sleeve: Lin; shorts: Lin; socks: Lin; trim: Lin; band: Lin;
}

/** One decoded picture (RGBA, 8-bit), as ImageData holds it. */
export interface Px { data: Uint8ClampedArray | Uint8Array; width: number; height: number }

export interface LayerPack { base: Px; light: Px; kitA: Px; kitB: Px; crest: Px; num: Px }

const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** Linear 0..1 to an sRGB byte, through a 4096-step table. */
const L2S = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) {
  const l = i / 4096;
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  L2S[i] = Math.round(Math.min(1, Math.max(0, s)) * 255);
}
const enc = (l: number) => L2S[l <= 0 ? 0 : l >= 1 ? 4096 : Math.round(l * 4096)];

export function hexToLin(hex: string): Lin {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0x808080;
  return [S2L[(v >> 16) & 255], S2L[(v >> 8) & 255], S2L[v & 255]];
}

/** Perceived brightness of a hex colour, 0..1. */
export function luminanceOf(hex: string): number {
  const [r, g, b] = hexToLin(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The game's kits are two colours: shirt and trim, and the trim is the
 * shorts (kits.ts: "each side's shirt clashes with the other side's
 * shorts"). The A2 home-screen figure paints shirt / shorts = trim / trim,
 * and so does this: shirt and sleeves in the shirt colour, shorts and the
 * collar/cuff trim in the trim colour, socks in the shirt colour with a
 * trim-coloured band.
 */
export function kitColours(kit: Kit): KitColours {
  const shirt = hexToLin(kit.shirt);
  const trim = hexToLin(kit.trim);
  return { shirt, sleeve: shirt, shorts: trim, socks: shirt, trim, band: trim };
}

/** The squad number's ink on the shorts: the shirt colour on light shorts,
 *  white on dark ones (the same rule the A2 figure uses). */
export function numberInk(kit: Kit): string {
  return luminanceOf(kit.trim) > 0.36 ? kit.shirt : "#ffffff";
}

/** Nearest-texel lookup of a straight-alpha RGBA picture at u,v (v up). */
function texel(img: Px, u: number, v: number): [number, number, number, number] {
  const x = Math.min(img.width - 1, Math.max(0, Math.round(u * (img.width - 1))));
  const y = Math.min(img.height - 1, Math.max(0, Math.round((1 - v) * (img.height - 1))));
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

/**
 * Recolour one layer pack. `crest` and `number` are pictures to print on the
 * chest and the shorts (null leaves that decal in the garment's own colour).
 * Returns straight-alpha RGBA bytes the size of `pack.base`.
 */
export function recolourPixels(pack: LayerPack, kit: KitColours, crest: Px | null, number: Px | null): Uint8ClampedArray<ArrayBuffer> {
  const n = pack.base.width * pack.base.height;
  const out = new Uint8ClampedArray(n * 4);
  const B = pack.base.data, L = pack.light.data, KA = pack.kitA.data, KB = pack.kitB.data;
  const C = pack.crest.data, N = pack.num.data;
  const regions: [Lin, Uint8ClampedArray | Uint8Array, number][] = [
    [kit.shirt, KA, 0], [kit.sleeve, KA, 1], [kit.shorts, KA, 2],
    [kit.socks, KB, 0], [kit.trim, KB, 1], [kit.band, KB, 2],
  ];
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = B[i + 3];
    out[i + 3] = a;
    if (a === 0) continue;
    const al = a / 255;
    let dr = 0, dg = 0, db = 0;
    for (const [c, src, ch] of regions) {
      const m = src[i + ch];
      if (m === 0) continue;
      const w = m / 255; // masks are stored linear, not sRGB
      dr += w * (c[0] - KIT_BASE); dg += w * (c[1] - KIT_BASE); db += w * (c[2] - KIT_BASE);
    }
    // Decals: the picture over the garment it sits on.
    for (const [img, D, under] of [[crest, C, kit.shirt], [number, N, kit.shorts]] as const) {
      const cov8 = D[i + 2];
      if (cov8 === 0) continue;
      const cov = cov8 / 255; // linear, like the masks
      let col: Lin = under;
      if (img) {
        const t = texel(img, D[i] / 255, D[i + 1] / 255);
        const ta = t[3] / 255;
        col = [S2L[t[0]] * ta + under[0] * (1 - ta), S2L[t[1]] * ta + under[1] * (1 - ta), S2L[t[2]] * ta + under[2] * (1 - ta)];
      }
      dr += cov * (col[0] - KIT_BASE); dg += cov * (col[1] - KIT_BASE); db += cov * (col[2] - KIT_BASE);
    }
    // light is stored /4; the base is straight, so premultiply, add, divide back.
    const sr = S2L[L[i]] * 4, sg = S2L[L[i + 1]] * 4, sb = S2L[L[i + 2]] * 4;
    out[i] = enc(S2L[B[i]] + (sr * dr) / al);
    out[i + 1] = enc(S2L[B[i + 1]] + (sg * dg) / al);
    out[i + 2] = enc(S2L[B[i + 2]] + (sb * db) / al);
  }
  return out;
}
