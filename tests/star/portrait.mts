import {
  clampOffset, coverScale, initialView, portraitBytes, sourceRect, MAX_PORTRAIT_BYTES,
} from "../../lib/star/portrait";
import { CROP_ZOOM_RANGE } from "../../lib/star/faceStyle";

/**
 * THE CROP.
 *
 * Everything about a photograph in this game is geometry, and geometry is the
 * part that fails quietly: a crop that lets you drag past the edge exports a
 * square with a strip of blank canvas down one side, and the export happens
 * offscreen so nobody sees it happen. So the invariant is stated once and then
 * fuzzed — whatever the picture's shape and wherever it has been dragged,
 * while zoomed in enough to cover the square, the rectangle taken from it
 * lies entirely inside it.
 *
 * Below zoom 1 (real player/fake-face crops only — PortraitPicker's own
 * "Your photo" export never allows it, its slider stays 1-3) a different
 * invariant takes over on whichever dimension no longer covers: the picture
 * centres in it instead, which means the sampled rectangle can legitimately
 * extend past the picture's own edge on that axis — not a bug, the actual
 * fix for a real reported one. Both regimes are fuzzed below, separately.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const V = 224;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// ── Cover, not contain ──────────────────────────────────────────────────────
{
  // A phone photograph: tall. The square has to be filled by its width.
  check(near(coverScale(1080, 1920, V), V / 1080), "a tall picture is scaled by its width");
  // A laptop webcam: wide. Filled by its height.
  check(near(coverScale(1920, 1080, V), V / 1080), "a wide picture is scaled by its height");
  check(near(coverScale(500, 500, V), V / 500), "a square picture fits exactly");
  check(coverScale(0, 0, V) === 1, "a picture with no size does not divide by zero");
}

// ── It opens centred ────────────────────────────────────────────────────────
{
  const v = initialView(1080, 1920, V);
  check(v.zoom === 1, "it opens at the scale that just covers");
  check(near(v.x, 0), "a tall picture has no room to move sideways");
  check(v.y < 0, `and is pulled up to centre it (${v.y.toFixed(1)})`);

  const w = initialView(1920, 1080, V);
  check(w.x < 0 && near(w.y, 0), "a wide one is centred the other way");

  // Centred means centred: the source rectangle sits in the middle.
  const r = sourceRect(v, 1080, 1920, V);
  check(near(r.sx, 0) && near(r.sw, 1080), "the full width of a tall picture is used");
  check(near(r.sy, (1920 - 1080) / 2), `and the middle of its height (${r.sy})`);
}

// ── Zoomed in enough to cover, the square still stays covered ───────────────
{
  const rng = mulberry(4);
  let escaped = 0, outside = 0;
  for (let i = 0; i < 4000; i++) {
    const iw = 60 + Math.floor(rng() * 4000);
    const ih = 60 + Math.floor(rng() * 4000);
    // Drags well past both edges. Zoom stays >= 1 here, the regime where the
    // picture can never be smaller than the viewport — zoom < 1 (deliberately
    // now allowed — see the next section) gets its own invariant below,
    // since centring, not covering, is the right behaviour there.
    const dragged = {
      zoom: 1 + rng() * 3,
      x: (rng() - 0.5) * 4000,
      y: (rng() - 0.5) * 4000,
    };
    const c = clampOffset(dragged, iw, ih, V);
    const s = coverScale(iw, ih, V) * c.zoom;

    if (c.zoom < 1) escaped++;
    // The drawn image must still reach both far edges of the viewport.
    if (c.x > 1e-6 || c.y > 1e-6 || c.x + iw * s < V - 1e-6 || c.y + ih * s < V - 1e-6) escaped++;

    const r = sourceRect(dragged, iw, ih, V);
    if (r.sx < -1e-6 || r.sy < -1e-6 || r.sx + r.sw > iw + 1e-6 || r.sy + r.sh > ih + 1e-6) outside++;
  }
  check(escaped === 0, `no drag can uncover the square while zoomed in enough to cover it (${escaped} of 4000)`);
  check(outside === 0, `and no crop takes pixels the picture does not have (${outside} of 4000)`);
}

// ── Below zoom 1, a dimension smaller than the viewport centres instead ─────
//
// The actual fix for a real reported bug: "even with like the 0% zoom on
// the crop thing it still doesnt fit in the whole face and its cut off on
// top or bottom" — see faceStyle.ts's own CROP_ZOOM_RANGE comment for the
// measured numbers. clampOffset used to force zoom to at least 1 and pin a
// picture smaller than the viewport to its top-left corner (0); both are
// gone now. This checks BOTH dimensions independently, since a picture can
// have one dimension still covering (clamped to the edge as always) while
// the other has zoomed out past covering (centred) — the zoom range spans
// both sides of 1 specifically to exercise that mixed case too, not just
// the fully-zoomed-out one.
{
  const rng = mulberry(7);
  let wrongX = 0, wrongY = 0, notFinite = 0;
  for (let i = 0; i < 4000; i++) {
    const iw = 60 + Math.floor(rng() * 4000);
    const ih = 60 + Math.floor(rng() * 4000);
    const dragged = { zoom: 0.02 + rng() * 1.2, x: (rng() - 0.5) * 4000, y: (rng() - 0.5) * 4000 };
    const c = clampOffset(dragged, iw, ih, V);
    const s = coverScale(iw, ih, V) * c.zoom;
    const w = iw * s, h = ih * s;

    if (w <= V) { if (!near(c.x, (V - w) / 2, 1e-3)) wrongX++; }
    else { if (c.x > 1e-6 || c.x + w < V - 1e-6) wrongX++; }
    if (h <= V) { if (!near(c.y, (V - h) / 2, 1e-3)) wrongY++; }
    else { if (c.y > 1e-6 || c.y + h < V - 1e-6) wrongY++; }

    const r = sourceRect(dragged, iw, ih, V);
    if (!Number.isFinite(r.sx) || !Number.isFinite(r.sy) || !(r.sw > 0) || !(r.sh > 0)) notFinite++;
  }
  check(wrongX === 0, `x centres once its dimension no longer covers, otherwise still clamps to the edge, regardless of drag (${wrongX} of 4000)`);
  check(wrongY === 0, `same for y (${wrongY} of 4000)`);
  check(notFinite === 0, `the sampled rectangle stays finite and positive-sized at every zoom tried, however far out (${notFinite} of 4000)`);
}

// ── A degenerate zoom never produces NaN/Infinity ────────────────────────────
//
// Never reachable via any real slider (CROP_ZOOM_RANGE's own floor stops
// well short of this), but clampOffset is a shared utility — worth a real
// guard, not just an assumption nothing will ever call it with 0.
{
  for (const z of [0, -1, -100]) {
    const c = clampOffset({ zoom: z, x: 0, y: 0 }, 1000, 1000, V);
    check(Number.isFinite(c.zoom) && c.zoom > 0, `zoom ${z} is guarded to something positive and finite (${c.zoom})`);
    const r = sourceRect({ zoom: z, x: 0, y: 0 }, 1000, 1000, V);
    check(Number.isFinite(r.sw) && r.sw > 0 && Number.isFinite(r.sh) && r.sh > 0, `…and sourceRect still returns a usable rectangle (sw=${r.sw}, sh=${r.sh})`);
  }
}

// ── The exact real fake-face shape: the whole picture actually fits now ─────
{
  const IW = 1091, IH = 1442; // measured directly off the PNG headers, all seven images, ratio ≈ 0.757

  // Sanity check on the bug itself, not just the fix: at the OLD floor
  // (zoom 1), height genuinely overflowed — some part of the face was
  // always cropped away, whichever way it was panned.
  const atOldFloor = sourceRect({ zoom: 1, x: 0, y: 0 }, IW, IH, V);
  check(atOldFloor.sy > 1e-6 || atOldFloor.sy + atOldFloor.sh < IH - 1e-6,
    `sanity check: zoom 1 genuinely could not show the whole height (sy=${atOldFloor.sy.toFixed(1)}, sy+sh=${(atOldFloor.sy + atOldFloor.sh).toFixed(1)}, ih=${IH})`);

  // At the new floor, the whole picture — both dimensions — is contained
  // within the sampled rectangle: nothing cropped, top, bottom, or sides.
  const atNewFloor = sourceRect({ zoom: CROP_ZOOM_RANGE[0], x: 0, y: 0 }, IW, IH, V);
  check(atNewFloor.sx <= 1e-6 && atNewFloor.sx + atNewFloor.sw >= IW - 1e-6,
    `the new floor shows the full width (sx=${atNewFloor.sx.toFixed(1)}, sx+sw=${(atNewFloor.sx + atNewFloor.sw).toFixed(1)}, iw=${IW})`);
  check(atNewFloor.sy <= 1e-6 && atNewFloor.sy + atNewFloor.sh >= IH - 1e-6,
    `…and the full height — the actual fix (sy=${atNewFloor.sy.toFixed(1)}, sy+sh=${(atNewFloor.sy + atNewFloor.sh).toFixed(1)}, ih=${IH})`);
}

// ── Zooming in takes less of the picture ────────────────────────────────────
{
  const a = sourceRect({ zoom: 1, x: 0, y: 0 }, 1000, 1000, V);
  const b = sourceRect({ zoom: 2, x: 0, y: 0 }, 1000, 1000, V);
  check(b.sw < a.sw, `zoomed in is a smaller crop (${b.sw.toFixed(0)} < ${a.sw.toFixed(0)})`);
  check(near(b.sw, a.sw / 2), "and twice the zoom is half the crop");
  check(near(a.sw, a.sh) && near(b.sw, b.sh), "the crop is always square");
}

// ── The size guard ──────────────────────────────────────────────────────────
{
  // Base64 is four characters for every three bytes, and the header is not data.
  const uri = "data:image/webp;base64," + "A".repeat(4000);
  check(Math.abs(portraitBytes(uri) - 3000) <= 1, `bytes are counted, not characters (${portraitBytes(uri)})`);
  check(portraitBytes("nonsense") === 8, "a string that is not a data URI is measured as itself");
  // A career that will not save is worse than a career with no photograph on it,
  // and the failure arrives on a later write with nothing to connect it to.
  check(MAX_PORTRAIT_BYTES < 200_000, `the cap leaves the save budget alone (${MAX_PORTRAIT_BYTES})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — a square crop that stays inside the picture while zoomed in enough to cover it, and centres the picture instead of pinning it to a corner once it isn't");
