/**
 * HAIR, WHEN THE PHOTO CUTS IT OFF.
 *
 * Harry, 28 Sep 2026: "we need to try and recreate hair somehow, everyone
 * can't be bald". A phone selfie or a tight portrait often crops the top of
 * the head, so a scanned head came out with a flat top. The scan
 * (faceScan.ts) measures the hair it CAN see, and this file:
 *
 *   1. pickHairStyle — chooses one of five shapes from those measurements;
 *   2. paintHair     — draws that shape in the home avatar's art style (lit
 *                      from the left like the A2 body, soft strands, no
 *                      outline), in the colour of the visible hair.
 *
 * The real hair is always kept. The drawn piece only goes where the photo
 * has nothing — a dome standing on the photo's own cut, exactly as wide as
 * the head is there — plus a thin band over the seam.
 *
 * A real shaved or bald head is left alone: if the top of the skull is in
 * the picture and the segmenter sees skin there, not hair, nothing is drawn.
 *
 * The style choice is plain numbers, tested directly (tests/star/faceScan.mts).
 */

export type HairStyle = "buzz" | "crop" | "curly" | "swept" | "long";

/** What the scan measured about the visible hair. Distances are in eye-to-
 *  chin lengths (D); widths are in face widths (cheek to cheek). */
export interface HairStats {
  /** The photo cuts off the top of the head (hair touches the top edge, or
   *  the forehead sits too close to it). */
  cropped: boolean;
  /** Hair pixels, in D². 0 = none found. */
  area: number;
  /** How far the visible hair rises above the top of the forehead, in D
   *  (only a lower bound when cropped). */
  topAbove: number;
  /** The widest run of hair above the eyes, in face widths. */
  width: number;
  /** Hair hanging beside the neck below the chin, in D². */
  below: number;
  /** Hair hanging beside the cheeks (between the eyes and the chin, outside
   *  the face), in D² — braids, dreads, a bob. */
  sides: number;
  /** How coily the visible hair is, 0 (smooth) … 1 (tight curls). */
  texture: number;
  /** How solid the hair is on the top of the head, 0 … 1 (a buzz cut lets
   *  the scalp show through, so the segmenter is only half sure). */
  density: number;
  /** The top of the skull is in the picture and it is skin, not hair. */
  scalpVisible: boolean;
}

export interface HairChoice {
  style: HairStyle | null;
  /** In plain words, why — shown in the dev readout and the report. */
  why: string;
}

/** The thresholds, together so a by-eye pass edits one block. */
export const HAIR_RULES = {
  /** Hair below the chin beside the neck that makes it long. */
  longBelow: 0.1,
  /** Hair beside the cheeks that makes it long/tied (braids, dreads). */
  longSides: 0.012, // measured: braids 0.019-0.024, every other test photo 0-0.003
  /** Wider than this many face widths → curly/afro volume. */
  curlyWidth: 1.32,
  /** Texture above this → curly. Measured on the test photos, the texture
   *  number sat between 0.39 and 0.63 for every kind of hair, swept and
   *  curly alike, so it only decides the very coiliest; width does most. */
  curlyTexture: 0.8,
  /** Less hair than this is "none found". */
  noHair: 0.05,
  /** Rising at least this far above the forehead → swept (medium). */
  sweptTop: 0.3,
  /** Solid less than this on top → a buzz cut. */
  buzzDensity: 0.42,
};

/** Choose the drawn hair piece, or null when the photo's own hair (or a real
 *  bald head) should stand. */
export function pickHairStyle(s: HairStats): HairChoice {
  const R = HAIR_RULES;
  if (!s.cropped) {
    if (s.area >= R.noHair) return { style: null, why: "the whole head is in the photo — its own hair is kept" };
    if (s.scalpVisible) return { style: null, why: "no hair and the scalp is showing — a real shaved or bald head, left alone" };
    return { style: "crop", why: "no hair found and the top of the head is not clear — a short crop is drawn" };
  }
  if (s.below > R.longBelow || s.sides > R.longSides) return { style: "long", why: s.below > R.longBelow ? "hair hangs past the chin beside the neck" : "hair hangs down beside the cheeks" };
  if (s.width > R.curlyWidth || s.texture > R.curlyTexture) {
    return { style: "curly", why: s.width > R.curlyWidth ? "the hair stands out wider than the face" : "the hair is tightly coiled" };
  }
  if (s.area < R.noHair) return { style: "crop", why: "the top of the head is cut off and no hair shows — a short crop, in the eyebrow colour" };
  if (s.topAbove >= R.sweptTop) return { style: "swept", why: "the hair already stands tall where the photo cuts it" };
  if (s.density < R.buzzDensity) return { style: "buzz", why: "the scalp shows through the hair — cropped close" };
  return { style: "crop", why: "short hair cut off by the photo" };
}

/**
 * Where the drawn hair goes. The piece is a dome that stands on the photo's
 * own cut: its base runs along the top edge of the photo (baseL → baseR,
 * exactly as wide as the head is there, so it joins without a step) and it
 * rises to the top of the skull plus the style's volume.
 */
export interface HairGeo {
  /** Top of the forehead (the face mesh's top point). */
  foreheadY: number;
  /** Eye line to chin, px. */
  D: number;
  /** The two ends of the dome's base, on the photo's cut. */
  baseL: { x: number; y: number };
  baseR: { x: number; y: number };
}

type RGB = [number, number, number];
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (c: RGB, a = 1) => `rgba(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])},${a})`;
const shade = (c: RGB, k: number): RGB => (k >= 0
  ? [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k]
  : [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)]);
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A small seeded random, so the same photo always draws the same hair. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Per style: how far the hair rises above the skull (× D), how much wider
 *  than the head it stands (× the base width), and how far the crown leans
 *  towards the lit side (× the half width). */
export const HAIR_SHAPE: Record<HairStyle, { top: number; widen: number; lean: number }> = {
  buzz: { top: 0.02, widen: 0.0, lean: 0 },
  crop: { top: 0.1, widen: 0.03, lean: 0.05 },
  swept: { top: 0.2, widen: 0.05, lean: 0.22 },
  curly: { top: 0.3, widen: 0.12, lean: 0 },
  long: { top: 0.12, widen: 0.05, lean: 0.08 },
};

/** The top of the skull: half an eye-to-chin length above the forehead point
 *  (measured: a buzz cut and braids both rose 0.52-0.53 above it on the test photos). */
export const skullTopOf = (g: HairGeo) => g.foreheadY - 0.46 * g.D;

/** The dome, as points from baseL over the top to baseR. */
export function domePoints(style: HairStyle, g: HairGeo, n = 40): { x: number; y: number }[] {
  const sh = HAIR_SHAPE[style];
  const span = Math.max(1, g.baseR.x - g.baseL.x);
  const half = (span / 2) * (1 + sh.widen);
  const mid = (g.baseL.x + g.baseR.x) / 2;
  const baseY = (g.baseL.y + g.baseR.y) / 2;
  const top = Math.min(skullTopOf(g) - sh.top * g.D, Math.min(g.baseL.y, g.baseR.y) - 0.06 * g.D);
  // The dome is the top of an ellipse centred inside the head (not sitting
  // on the cut), so at the cut its sides already lean inwards, carrying on
  // the head's own curve. (A half-ellipse standing on the cut has upright
  // sides and reads as a cap.)
  const cy = Math.max(baseY + 0.05 * g.D, g.foreheadY + 0.15 * g.D);
  const ry = cy - top;
  const k = Math.min(0.95, (cy - baseY) / ry); // sin of the angle where the arc meets the cut
  const rx = half / Math.sqrt(1 - k * k);
  const t0 = Math.asin(k);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - t0 - (i / n) * (Math.PI - 2 * t0); // left end → over the top → right end
    const v = (Math.sin(t) - k) / Math.max(1e-6, 1 - k); // 0 at the cut … 1 at the crown
    const x0 = mid + Math.cos(t) * rx;
    // The crown leans towards the lit (left) side for a swept cut.
    pts.push({ x: x0 - sh.lean * half * v * v, y: cy - Math.sin(t) * ry + (i === 0 ? g.baseL.y - baseY : i === n ? g.baseR.y - baseY : 0) });
  }
  return pts;
}

/** Paint the hair piece: the dome, shaded like the A2 body (lit from the
 *  left), with strands, coils or stubble on top. */
export function paintHair(
  ctx: CanvasRenderingContext2D, style: HairStyle, g: HairGeo,
  colour: RGB, skin: RGB, seed = 7,
): void {
  const pts = domePoints(style, g);
  const r = rng(seed);
  const base: RGB = style === "buzz" ? mix(colour, skin, 0.15) : colour;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const L = Math.min(...xs), R = Math.max(...xs), T = Math.min(...ys);
  const B = Math.max(g.baseL.y, g.baseR.y) + 0.05 * g.D;
  const w = R - L, h = Math.max(1, B - T);
  ctx.save();
  ctx.fillStyle = rgb(base);
  // Curly: the edge is a ring of soft bumps, not a clean line.
  if (style === "curly") {
    const cr = 0.075 * g.D;
    for (let i = 2; i < pts.length - 2; i += 2) {
      const p = pts[i];
      ctx.beginPath(); ctx.arc(p.x, p.y + cr * 0.35, cr * (0.9 + r() * 0.3), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  // Close along the base, dipping a little so it tucks under the photo.
  ctx.lineTo(g.baseR.x, g.baseR.y + 0.05 * g.D);
  ctx.lineTo(g.baseL.x, g.baseL.y + 0.05 * g.D);
  ctx.closePath();
  ctx.fill();
  // Everything else paints only on the hair already there.
  ctx.globalCompositeOperation = "source-atop";
  // Volume: lit from the upper left, shadow to the right and underneath.
  // (The bottom stays the plain hair colour, so it meets the photo's own
  // hair at the cut without a dark stripe.)
  const lit = ctx.createLinearGradient(L, 0, R, 0);
  lit.addColorStop(0, rgb(shade(base, 0.2)));
  lit.addColorStop(0.45, rgb(base));
  lit.addColorStop(1, rgb(shade(base, -0.32)));
  ctx.fillStyle = lit;
  ctx.fillRect(L - w, T - h, w * 3, h * 3);
  const crown = ctx.createLinearGradient(0, T, 0, T + h * 0.6);
  crown.addColorStop(0, "rgba(255,255,255,0.10)");
  crown.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = crown;
  ctx.fillRect(L - w, T - h, w * 3, h * 3);

  const dark = rgb(shade(base, -0.45), 0.28);
  const light = rgb(shade(base, 0.35), 0.22);
  ctx.lineCap = "round";
  if (style === "curly") {
    // Coils: short dark crescents, each lit on its upper left.
    const cr = 0.05 * g.D;
    for (let y = T; y < B + cr; y += cr * 1.6) {
      const row = Math.round((y - T) / (cr * 1.6));
      for (let x = L + (row % 2) * cr * 0.8; x < R; x += cr * 1.7) {
        const jx = x + (r() - 0.5) * cr, jy = y + (r() - 0.5) * cr;
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, cr * 0.45);
        ctx.beginPath(); ctx.arc(jx, jy, cr * 0.7, 0.2, Math.PI * 1.1); ctx.stroke();
        ctx.strokeStyle = light; ctx.lineWidth = Math.max(0.8, cr * 0.3);
        ctx.beginPath(); ctx.arc(jx, jy, cr * 0.7, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();
      }
    }
  } else if (style === "buzz") {
    ctx.fillStyle = rgb(shade(colour, -0.2), 0.5);
    const n = Math.round(w * h * 0.06);
    for (let i = 0; i < n; i++) ctx.fillRect(L + r() * w, T + r() * h, 1.1, 1.1);
  } else {
    // Tufts: many short, soft strokes lying the way the hair is combed —
    // up and over from the front, to one side for a swept cut, down for
    // long hair. (Long strands from crown to base read as a knitted cap.)
    const n = Math.round(w * h / (g.D * g.D) * 70);
    const lean = style === "swept" ? -0.9 : style === "long" ? 0 : -0.35;
    for (let i = 0; i < n; i++) {
      const x0 = L + r() * w, y0 = T + r() * h;
      const len = g.D * (0.07 + r() * 0.07);
      const up = style === "long" ? 1 : -1;
      const ang = Math.atan2(up, lean + (x0 - (L + w / 2)) / w) + (r() - 0.5) * 0.5;
      const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
      ctx.strokeStyle = r() < 0.3 ? light : dark;
      ctx.lineWidth = Math.max(0.8, g.D * 0.012);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + dx * 0.6 + dy * 0.15, y0 + dy * 0.6 - dx * 0.15, x0 + dx, y0 + dy);
      ctx.stroke();
    }
  }
  // The shine: a soft arc across the crown on the lit side.
  ctx.strokeStyle = rgb(shade(base, 0.5), 0.28);
  ctx.lineWidth = Math.max(1.5, g.D * 0.045);
  ctx.beginPath();
  ctx.ellipse(L + w * 0.5, B, w * 0.4, h * 0.8, 0, Math.PI * 1.18, Math.PI * 1.45);
  ctx.stroke();
  // A soft shadow just inside the outer edge, so the dome reads round.
  ctx.strokeStyle = rgb(shade(base, -0.55), 0.35);
  ctx.lineWidth = Math.max(1.5, g.D * 0.05);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}
