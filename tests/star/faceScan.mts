import { alignTransform, ramp, portraitKey, isScannablePortrait } from "../../lib/star/faceScan";
import { SCAN_LAYOUT, SCAN_EYE_TO_CHIN, looksScanned } from "../../lib/star/faceScanLayout";
import { pickHairStyle, domePoints, skullTopOf, HAIR_SHAPE, type HairStats, type HairGeo, type HairStyle } from "../../lib/star/faceHair";

/**
 * THE FACE SCAN — the parts that are plain geometry and rules.
 *
 * The models (MediaPipe) only run in a browser, so they are checked by the
 * picture sheets (before/after on the A2 avatar). What runs here is what
 * decides where every scanned face lands, which hair piece is drawn, and
 * how an old photo is told apart from a scanned one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 1. Every face lands in the same spot, whatever its tilt, size, place ──
{
  const r = mulberry(7);
  const S = 512;
  for (let n = 0; n < 2000; n++) {
    // A made-up face: eyes a random distance apart, rotated, somewhere.
    const cx = 100 + r() * 800, cy = 100 + r() * 800, gap = 20 + r() * 300;
    const tilt = (r() - 0.5) * 1.2; // ±34°
    const drop = gap * (1.1 + r() * 0.5); // eye line to chin
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const rot = (x: number, y: number) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c });
    const eyeL = rot(-gap / 2, 0), eyeR = rot(gap / 2, 0), chin = rot(0, drop);
    // Hand them over in either order: the transform must not care.
    const T = r() < 0.5 ? alignTransform(eyeL, eyeR, chin, S) : alignTransform(eyeR, eyeL, chin, S);
    const a = T.apply(eyeL), b = T.apply(eyeR), ch = T.apply(chin);
    check(near(a.y, b.y, 1e-6), `eyes level (${a.y} vs ${b.y})`);
    check(near((a.x + b.x) / 2, SCAN_LAYOUT.cx * S, 1e-6), "eye midpoint centred");
    check(near(a.y, SCAN_LAYOUT.eyeY * S, 1e-6), "eye line at eyeY");
    check(near(ch.y, SCAN_LAYOUT.chinY * S, 1e-6), `chin at chinY (${ch.y})`);
    check(near(ch.x, SCAN_LAYOUT.cx * S, 1e-6), "chin straight under the eyes");
    check(near(T.theta, tilt, 1e-9), "reports the tilt it straightened");
    check(a.x < b.x, "left eye stays on the left");
  }
  check(SCAN_EYE_TO_CHIN > 0.2 && SCAN_LAYOUT.chinY < 0.85, "the layout leaves room for a neck below the chin");
  check(SCAN_LAYOUT.eyeY - SCAN_EYE_TO_CHIN * 1.1 > 0, "the layout leaves room above the head for hair");
}

// ── 2. ramp ──
check(ramp(0, 0.2, 0.6) === 0 && ramp(1, 0.2, 0.6) === 1 && near(ramp(0.4, 0.2, 0.6), 0.5), "ramp ends and middle");

// ── 3. Old photo vs scanned photo ──
{
  const solid = [255, 255, 255, 255], clear = [0, 0, 0, 0];
  check(looksScanned("data:image/webp;base64,x", 320, 320, clear), "a see-through square data URL is a scan");
  check(!looksScanned("data:image/webp;base64,x", 256, 256, solid), "an old solid crop is not a scan");
  check(!looksScanned("data:image/png;base64,x", 1091, 1442, clear), "a portrait-shaped cut-out is not a scan");
  check(!looksScanned("/ChatGPT Image.png", 320, 320, clear), "a file on the site is not a scan");
  check(isScannablePortrait("data:image/webp;base64,AAAA"), "an old uploaded photo can be scanned");
  check(isScannablePortrait("data:image/jpeg;base64,AAAA"), "an old JPEG photo can be scanned");
  check(!isScannablePortrait("/ChatGPT Image Sep 15, 2026, 11_23_12 PM.png"), "a fake face is never scanned");
  check(!isScannablePortrait(undefined), "no photo, nothing to scan");
  const k1 = portraitKey("data:image/webp;base64," + "A".repeat(20000));
  const k2 = portraitKey("data:image/webp;base64," + "A".repeat(19999) + "B");
  check(k1 !== k2 && k1 === portraitKey("data:image/webp;base64," + "A".repeat(20000)), "the cache key is stable and tells near-identical photos apart");
}

// ── 4. Which hair is drawn ──
{
  const base: HairStats = { cropped: false, area: 0.6, topAbove: 0.6, width: 1.2, below: 0, sides: 0, texture: 0.5, density: 0.7, scalpVisible: false };
  const pick = (o: Partial<HairStats>) => pickHairStyle({ ...base, ...o }).style;
  check(pick({}) === null, "whole head in frame: the photo's own hair is kept");
  check(pick({ area: 0, scalpVisible: true }) === null, "a real shaved head is left alone");
  check(pick({ area: 0, scalpVisible: false }) === "crop", "no hair and no clear scalp: a short crop");
  check(pick({ cropped: true, below: 0.2 }) === "long", "cut off + hair past the chin: long");
  check(pick({ cropped: true, sides: 0.02 }) === "long", "cut off + braids by the cheeks: long");
  check(pick({ cropped: true, width: 1.5 }) === "curly", "cut off + hair wider than the face: curly");
  check(pick({ cropped: true, area: 0.01 }) === "crop", "cut off, no hair seen: a short crop");
  check(pick({ cropped: true, topAbove: 0.4 }) === "swept", "cut off, hair already tall: swept");
  check(pick({ cropped: true, topAbove: 0.2, density: 0.35 }) === "buzz", "cut off, scalp showing through: buzz");
  check(pick({ cropped: true, topAbove: 0.2, density: 0.7 }) === "crop", "cut off, short solid hair: crop");
  // Measured on the test photos (see the report): these must keep choosing
  // what they chose there.
  check(pick({ cropped: true, topAbove: 0.23, width: 1.23, density: 0.8, texture: 0.57 }) === "crop", "test photo: dark swept, cut off → crop");
  check(pick({ cropped: true, topAbove: 0.27, width: 1.09, density: 0.39, texture: 0.36 }) === "buzz", "test photo: buzz, cut off → buzz");
  check(pick({ cropped: true, topAbove: 0.23, width: 1.13, density: 0.32, sides: 0.024 }) === "long", "test photo: braids, cut off → long");
  for (const s of [{}, { cropped: true }, { area: 0 }]) check(pickHairStyle({ ...base, ...s }).why.length > 10, "every choice says why");
}

// ── 5. The drawn dome joins the photo and sits on the head ──
{
  const r = mulberry(3);
  for (let n = 0; n < 500; n++) {
    const D = 60 + r() * 120, fore = 150 + r() * 100;
    const y0 = fore - r() * 0.3 * D; // the photo's cut, at or above the forehead
    const w = D * (1 + r() * 0.6);
    const g: HairGeo = { foreheadY: fore, D, baseL: { x: 250 - w / 2, y: y0 + (r() - 0.5) * 6 }, baseR: { x: 250 + w / 2, y: y0 + (r() - 0.5) * 6 } };
    for (const style of Object.keys(HAIR_SHAPE) as HairStyle[]) {
      const pts = domePoints(style, g);
      const first = pts[0], last = pts[pts.length - 1];
      check(Math.abs(first.y - g.baseL.y) < 1e-6 && Math.abs(last.y - g.baseR.y) < 1e-6, `${style}: the dome's ends sit on the cut`);
      const top = Math.min(...pts.map((p) => p.y));
      check(top <= skullTopOf(g) - HAIR_SHAPE[style].top * D + 1e-6, `${style}: rises to the skull plus its volume`);
      check(pts.every((p) => p.y <= Math.max(g.baseL.y, g.baseR.y) + 1e-6), `${style}: never hangs below the cut`);
    }
  }
  // More volume for the bigger styles.
  check(HAIR_SHAPE.buzz.top < HAIR_SHAPE.crop.top && HAIR_SHAPE.crop.top < HAIR_SHAPE.swept.top && HAIR_SHAPE.swept.top < HAIR_SHAPE.curly.top, "buzz < crop < swept < curly in height");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of [...new Set(problems)].slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — every scanned face lands eyes-level in the same spot, old photos are told from scans, the hair piece is chosen by the stated rules and its dome sits on the photo's cut");
